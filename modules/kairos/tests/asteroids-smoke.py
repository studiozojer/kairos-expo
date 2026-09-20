"""Host C ABI check against the app's bundled data.

Usage: python3 modules/kairos/tests/asteroids-smoke.py /path/to/libkairos.dylib
Add --write-fixture to regenerate the Seattle fixture from real engine output.
"""
import ctypes as c
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
          'Uranus', 'Neptune', 'Pluto', 'MeanNode', 'MeanApogee',
          'Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Eros', 'Pholus']


class Result(c.Structure):
    _fields_ = [('success', c.c_bool), ('data', c.c_void_p), ('error', c.c_void_p)]


lib = c.CDLL(sys.argv[1])
lib.kairos_init.argtypes = [c.c_char_p, c.c_char_p]
lib.kairos_init.restype = Result
lib.kairos_calculate_chart.argtypes = [c.c_char_p]
lib.kairos_calculate_chart.restype = Result
lib.kairos_result_free.argtypes = [Result]


def take(result):
    try:
        text = c.string_at(result.data if result.success else result.error).decode()
        if not result.success:
            raise RuntimeError(text)
        return text
    finally:
        lib.kairos_result_free(result)


take(lib.kairos_init(b':memory:', str(ROOT / 'modules/kairos/assets/Ephemeris').encode()))
dates = [f'{year}-01-01T00:00:00Z' for year in range(1900, 2100, 10)]
dates += ['2099-12-31T23:59:59Z', '2026-09-13T19:00:00Z', '2026-09-14T19:00:00Z']
charts = []
for date in dates:
    request = dict(datetime=date, latitude=47.6062, longitude=-122.3321,
                   chart_kind='Transit', house_system='Placidus', zodiac_system='Tropical',
                   enabled_bodies=BODIES)
    chart = json.loads(take(lib.kairos_calculate_chart(json.dumps(request).encode())))
    assert chart['chart_metadata']['chart_type'] == 'Transit'
    assert chart['chart_metadata']['datetime'] == date
    nodes = chart['celestial']['nodes']
    assert set(BODIES) <= {node['body'] for node in nodes}, date
    ids = {node['id'] for node in nodes}
    assert all(edge['from'] in ids and edge['to'] in ids for edge in chart['celestial']['edges'])
    charts.append(chart)

before, after = charts[-2:]
for body in BODIES[-7:]:
    positions = [next(n['position']['longitude'] for n in chart['celestial']['nodes']
                      if n['body'] == body) for chart in (before, after)]
    assert positions[0] != positions[1], body
if '--write-fixture' in sys.argv:
    (ROOT / 'src/features/chart/fixtures/engine/seattle-2026.json').write_text(json.dumps(before, indent=2) + '\n')
print(f'PASS: all 19 requested bodies at {len(dates)} dates; all seven asteroids move across a day step.')
