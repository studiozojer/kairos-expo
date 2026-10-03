#!/usr/bin/env python3
"""Stage synthetic native comparison for EAS. Never compiles locally."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('destination', type=Path)
parser.add_argument('--swift-app', type=Path, default=root.parent / 'kairos-ios')
parser.add_argument('--swift-engine', type=Path, default=root.parent / 'kairos-engine')
args = parser.parse_args()
stage = args.destination.resolve()
if stage.exists():
    raise ValueError('Use a new staging directory')
stage.mkdir(parents=True)
config = args.swift_app / 'scripts/eas-native'
for name in ['app.json', 'package.json', 'package-lock.json']:
    shutil.copy2(config / name, stage / name)
(stage / 'eas.json').write_text(json.dumps({'cli': {'version': '>= 24.10.0', 'appVersionSource': 'local'}, 'build': {'native-parity': {'distribution': 'internal', 'config': 'parity.yml', 'ios': {'simulator': True, 'image': 'latest'}}}}, indent=2))
# Native project metadata lets EAS identify the existing Swift project; no app
# compilation or signing credentials are used by this custom comparison job.
for name in ['kairos.swift.xcodeproj', 'kairos-swift/Info.plist']:
    source = args.swift_app / name
    target = stage / 'ios' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, target, ignore=shutil.ignore_patterns('xcuserdata'))
    else:
        shutil.copy2(source, target)
(stage / 'ios/Secrets.xcconfig').write_text('KAIROS_API_URL = https:/$()/api.kairos.solar\nAIRTABLE_API_KEY =\nAIRTABLE_BASE_ID =\nAIRTABLE_TABLE_ID =\n')
inputs = stage / 'parity-inputs'
inputs.mkdir()
for name, source, expected in [
    ('swift/libkairos-sim.a', args.swift_engine / 'swift/KairosCore/libkairos.xcframework/ios-arm64-simulator/libkairos-sim.a', '9265b960d4bbe800e85de15d97a4211e19a163884ad54b568cc34b059a3f76af'),
    ('expo/libkairos.a', root / 'modules/kairos/ios/KairosEngine.xcframework/ios-arm64-simulator/libkairos.a', 'da2368040a429262e4147f09678f8da7f59b50bdcc97393c2388a92050c762cb'),
]:
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
        raise ValueError(f'{name} changed: re-evaluate conversion profile before uploading')
    target = inputs / name
    target.parent.mkdir(parents=True)
    shutil.copy2(source, target)
shutil.copytree(root / 'modules/kairos/include', inputs / 'include')
ephemeris = root / 'modules/kairos/assets/Ephemeris'
for name, expected in json.loads((ephemeris / 'manifest.json').read_text()).items():
    if hashlib.sha256((ephemeris / name).read_bytes()).hexdigest() != expected:
        raise ValueError(f'Ephemeris checksum mismatch: {name}')
shutil.copytree(ephemeris, inputs / 'Ephemeris')
shutil.copy2(root / 'modules/kairos/tests/transfer-parity.c', inputs / 'transfer-parity.c')
shutil.copy2(root / 'scripts/verify-transfer-native-parity.py', stage / 'verify-transfer-native-parity.py')
build = stage / '.eas/build'
build.mkdir(parents=True)
(build / 'parity.yml').write_text('''build:
  name: Swift and Expo native transfer parity
  steps:
    - eas/checkout
    - eas/start_ios_simulator
    - run:
        name: Compare bundled Swift and Expo calculations
        command: python3 verify-transfer-native-parity.py
    - eas/upload_artifact:
        inputs:
          type: build-artifact
          path: artifacts/native-parity.json
''')
(stage / '.easignore').write_text('node_modules/\n.git/\n')
print(stage)
