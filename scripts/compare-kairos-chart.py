"""Compare native smoke output to host Rust's fixed Seattle chart."""
import json
import math
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
expected = json.loads((root / 'src/features/chart/fixtures/engine/seattle-2026.json').read_text())
actual = json.loads(Path(sys.argv[1]).read_text())

def compare(a, b, path='chart'):
    if isinstance(a, dict):
        assert set(a) == set(b), path
        for key in a:
            if key != 'chart_id':  # engine assigns a fresh UUID on each calculation
                compare(a[key], b[key], f'{path}.{key}')
    elif isinstance(a, list):
        assert len(a) == len(b), path
        for index, (x, y) in enumerate(zip(a, b)):
            compare(x, y, f'{path}[{index}]')
    elif isinstance(a, (int, float)) and not isinstance(a, bool):
        assert math.isclose(a, b, rel_tol=0, abs_tol=1e-8), (path, a, b)
    else:
        assert a == b, (path, a, b)

compare(expected, actual)
print('Native chart matches host Rust output (absolute tolerance 1e-8; UUID excluded).')
