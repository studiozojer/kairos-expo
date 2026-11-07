"""Public calculation-only WSGI service; static files are served by Caddy."""
import importlib.util
import json
import math
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('kairos_local', Path(__file__).with_name('serve-web.py'))
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


def application(environ, start_response):
    status, result = '200 OK', None
    if environ['PATH_INFO'] == '/health' and environ['REQUEST_METHOD'] == 'GET':
        result = {'ok': True}
    elif environ['PATH_INFO'] != '/local/calculate':
        status, result = '404 Not Found', {'error': 'Not found'}
    elif environ['REQUEST_METHOD'] != 'POST':
        status, result = '405 Method Not Allowed', {'error': 'Use POST'}
    else:
        try:
            if environ.get('CONTENT_TYPE', '').split(';')[0] != 'application/json':
                raise ValueError('Expected JSON')
            length = int(environ.get('CONTENT_LENGTH', '0'))
            if not 0 < length <= 65536:
                raise ValueError('Invalid request size')
            body = json.loads(environ['wsgi.input'].read(length))
            instant = datetime.fromisoformat(body['datetime'].replace('Z', '+00:00'))
            if instant.tzinfo is None or not datetime(1900, 1, 1, tzinfo=timezone.utc) <= instant < datetime(2100, 1, 1, tzinfo=timezone.utc):
                raise ValueError('Chart time must be between 1900 and 2100')
            for key, limit in [('latitude', 90), ('longitude', 180), ('elevation', 100000)]:
                value = body.get(key, 0)
                if not isinstance(value, (float, int)) or not math.isfinite(value) or abs(value) > limit:
                    raise ValueError('Invalid coordinates')
            if body.get('chart_kind') != 'Transit':
                raise ValueError('Unsupported chart kind')
            for key in ['enabled_bodies', 'enabled_stars', 'selected_star_names']:
                values = body.get(key, [])
                if not isinstance(values, list) or len(values) > 100 or not all(isinstance(v, str) and len(v) <= 100 for v in values):
                    raise ValueError('Invalid chart bodies')
        except (ValueError, KeyError, TypeError, AttributeError):
            status, result = '400 Bad Request', {'error': 'Invalid chart request. Check the date and location.'}
        else:
            try:
                result = engine.calculate(body)
            except Exception:
                status, result = '503 Service Unavailable', {'error': 'Chart calculation is temporarily unavailable. Please try again.'}
    encoded = json.dumps(result).encode()
    start_response(status, [('Content-Type', 'application/json'), ('Content-Length', str(len(encoded))), ('Cache-Control', 'no-store')])
    return [encoded]
