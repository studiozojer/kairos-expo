"""EAS-only iOS simulator comparison of the two packaged native libraries."""
import hashlib
import json
import math
import pathlib
import subprocess

root = pathlib.Path.cwd()
out = root / 'artifacts'
out.mkdir(exist_ok=True)
systems = ['Whole Sign', 'Placidus', 'Equal', 'Koch', 'Porphyrius', 'Regiomontanus', 'Campanus', 'Meridian', 'Morinus', 'Alcabitus', 'Topocentric', 'Vehlow', 'Equal (MC)']
bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'MeanNode', 'MeanApogee', 'Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Eros', 'Pholus']
instants = [
    ('1900-01-01T00:00:00Z', 0, 0, 0),
    ('1950-06-15T12:34:56Z', -33.86, 151.21, 40),
    ('2026-09-13T19:00:00Z', 47.6062, -122.3321, 0),
    ('2099-12-31T23:59:59Z', 60, 15, 1000),
    ('1900-01-01T00:00:00.123Z', 0, 0, 0),
    ('1950-06-15T12:34:56.999Z', -33.86, 151.21, 40),
    ('2026-09-13T19:00:00.456Z', 47.6062, -122.3321, 0),
    ('2099-12-31T23:59:59.123Z', 60, 15, 1000),
]
cases = [(date, lat, lon, elevation, house, node, lilith, lots)
    for house in systems for date, lat, lon, elevation in instants
    for node in ['Mean', 'True'] for lilith in ['Mean', 'Osculating'] for lots in ['Traditional', 'Fixed']]
for name in ['swift', 'expo']:
    requests = []
    for date, lat, lon, elevation, house, node, lilith, lots in cases:
        selected = ['TrueNode' if body == 'MeanNode' and node == 'True' else 'OscuApogee' if body == 'MeanApogee' and lilith == 'Osculating' else body for body in bodies]
        value = dict(datetime=date, latitude=lat, longitude=lon, elevation=elevation, house_system=house, zodiac_system='Tropical', lunar_node_type=node, black_moon_lilith_type=lilith, fortune_calculation_method=lots, enabled_bodies=selected, enabled_stars=[])
        if name == 'expo': value['chart_kind'] = 'Transit'
        requests.append(json.dumps(value))
    (out / f'{name}-requests.jsonl').write_text('\n'.join(requests) + '\n')

sdk = subprocess.check_output(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path'], text=True).strip()
libraries = {'swift': root / 'parity-inputs/swift/libkairos-sim.a', 'expo': root / 'parity-inputs/expo/libkairos.a'}
results = {}
for name, library in libraries.items():
    executable = out / f'{name}-probe'
    subprocess.run(['xcrun', '--sdk', 'iphonesimulator', 'clang', '-arch', 'arm64', '-isysroot', sdk, '-mios-simulator-version-min=18.0', '-I', 'parity-inputs/include', 'parity-inputs/transfer-parity.c', str(library), '-lc++', '-lsqlite3', '-lz', '-liconv', '-lresolv', '-framework', 'Security', '-framework', 'SystemConfiguration', '-framework', 'Foundation', '-o', str(executable)], check=True)
    subprocess.run(['codesign', '--force', '--sign', '-', str(executable)], check=True)
    text = subprocess.check_output(['xcrun', 'simctl', 'spawn', 'booted', str(executable), str(root / 'parity-inputs/Ephemeris'), str(out / f'{name}-requests.jsonl')], text=True)
    results[name] = [json.loads(line) for line in text.splitlines() if line.startswith('{')]
    assert len(results[name]) == len(cases), (name, len(results[name]))

maximum = 0.0
def close(a, b, angle=False):
    global maximum
    assert math.isfinite(a) and math.isfinite(b)
    delta = abs(a-b)
    if angle: delta = min(delta % 360, 360-delta % 360)
    maximum = max(maximum, delta)
    assert delta <= 1e-7, (a, b, delta)

for old, new in zip(results['swift'], results['expo']):
    old_nodes = {node['body']: node for node in old['celestial']['nodes']}
    new_nodes = {node['body']: node for node in new['celestial']['nodes']}
    assert set(old_nodes) == set(new_nodes)
    for body in old_nodes:
        a, b = old_nodes[body]['position'], new_nodes[body]['position']
        close(a['longitude'], b['longitude'], True)
        close(a['speed_longitude'], b['speed_longitude'])
    old_ids = {n['id']: n['body'] for n in old['celestial']['nodes']}
    new_ids = {n['id']: n['body'] for n in new['celestial']['nodes']}
    def edges(chart, ids):
        return {(*sorted((ids[e['from']], ids[e['to']])), e['aspect_type']): e for e in chart['celestial']['edges']}
    old_edges, new_edges = edges(old, old_ids), edges(new, new_ids)
    assert set(old_edges) == set(new_edges)
    for key, edge in old_edges.items():
        close(edge['orb'], new_edges[key]['orb'])
        close(edge['strength'], new_edges[key]['strength'])
        assert edge['is_applying'] == new_edges[key]['is_applying']
    assert len(old['houses']['nodes']) == len(new['houses']['nodes']) == 12
    for a, b in zip(old['houses']['nodes'], new['houses']['nodes']):
        close(a['cusp_longitude'], b['cusp_longitude'], True)
report = {'profileVersion': 'swift-tropical-settings-v2', 'nodeTypes': ['Mean', 'True'], 'lilithTypes': ['Mean', 'Osculating'], 'lotMethods': ['Traditional', 'Fixed'], 'fractionalSecondsCompared': True, 'platform': 'ios-arm64-simulator', 'cases': len(cases), 'houses': systems, 'bodies': sorted(old_nodes), 'aspectsCompared': True, 'maxDelta': maximum, 'tolerance': 1e-7, 'libraries': {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in libraries.items()}}
(out / 'native-parity.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report))
