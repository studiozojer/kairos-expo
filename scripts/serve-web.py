#!/usr/bin/env python3
"""Local desktop shell: static Expo web + read-only account access + macOS FFI.

Account credentials live in process memory and never reach browser storage.
No account upload, conversion, sync push, or deletion endpoint is exposed.
"""
import argparse
import ctypes
import http.cookies
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import threading
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
PRIMARY = Path(subprocess.check_output(
    ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=ROOT, text=True
).strip()).parent
API = 'https://api.kairos.solar'
sessions = {}
engine_lock = threading.Lock()
engine = None


class Result(ctypes.Structure):
    _fields_ = [('success', ctypes.c_bool), ('data', ctypes.c_void_p), ('error', ctypes.c_void_p)]


def unwrap(lib, result, parse=True):
    try:
        if not result.success:
            raise ValueError(ctypes.string_at(result.error).decode() if result.error else 'Engine failed')
        text = ctypes.string_at(result.data).decode()
        return json.loads(text) if parse else text
    finally:
        lib.kairos_result_free(result)


def calculate(body):
    global engine
    with engine_lock:
        if engine is None:
            engine_root = Path(os.environ.get('KAIROS_ENGINE_PATH', PRIMARY.parent / 'kairos-engine'))
            library = Path(os.environ.get('KAIROS_WEB_LIBRARY', engine_root / 'target/debug/libkairos.dylib'))
            if not library.is_file():
                raise ValueError('Build the macOS engine first: cargo build -p kairos-ffi in kairos-engine')
            lib = ctypes.CDLL(str(library))
            lib.kairos_init.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
            lib.kairos_init.restype = Result
            lib.kairos_calculate_chart.argtypes = [ctypes.c_char_p]
            lib.kairos_calculate_chart.restype = Result
            lib.kairos_result_free.argtypes = [Result]
            assets = PRIMARY / 'modules/kairos/assets'
            unwrap(lib, lib.kairos_init(
                f'sqlite://{assets / "Atlas/atlas.db"}?mode=ro'.encode(),
                str(assets / 'Ephemeris').encode()), parse=False)
            engine = lib
        return unwrap(engine, engine.kairos_calculate_chart(json.dumps(body).encode()))


def upstream(path, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = urllib.request.Request(API + path, headers=headers,
                                     data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def log_message(self, format, *args):
        pass  # No URLs, auth codes, personal chart data, or tokens in logs.

    def safe_request(self):
        host = f'127.0.0.1:{self.server.server_port}'
        return (self.headers.get('Host') == host
                and self.headers.get('Origin', f'http://{host}') == f'http://{host}'
                and self.headers.get('Sec-Fetch-Site') not in ('cross-site', 'same-site'))

    def reply(self, body, status=200, cookie=None):
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(encoded)

    def session_id(self):
        cookies = http.cookies.SimpleCookie(self.headers.get('Cookie', ''))
        value = cookies.get('kairos_desktop')
        return value.value if value else None

    def local(self):
        if not self.safe_request():
            return self.reply({'error': 'This viewer only accepts requests from its own local page.'}, 403)
        path = urllib.parse.urlsplit(self.path)
        session_id = self.session_id()
        token = sessions.get(session_id)
        body = None
        if self.command == 'POST':
            if not self.headers.get('Content-Type', '').startswith('application/json'):
                return self.reply({'error': 'Expected JSON'}, 415)
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 1024 * 1024:
                return self.reply({'error': 'Invalid request size'}, 413)
            body = json.loads(self.rfile.read(length))
        if path.path == '/local/session' and self.command == 'GET':
            if not token:
                return self.reply({'account': None})
            account = upstream('/api/auth/session', token)
            sessions[session_id] = account.pop('refreshed_token', None) or token
            return self.reply({'account': {'did': account['did'], 'handle': account['handle']}})
        if path.path == '/local/sign-in' and self.command == 'POST':
            code = body.get('code', '')
            if not isinstance(code, str) or not re.fullmatch(r'[a-fA-F0-9]{32,128}', code):
                raise ValueError('Paste the one-time code from the sign-in page.')
            result = upstream('/oauth/exchange', body={'code': code})
            account = upstream('/api/auth/session', result['session_token'])
            if session_id:
                sessions.pop(session_id, None)
            session_id = secrets.token_urlsafe(32)
            sessions[session_id] = account.get('refreshed_token') or result['session_token']
            return self.reply({'account': {'did': account['did'], 'handle': account['handle']}},
                              cookie=f'kairos_desktop={session_id}; HttpOnly; SameSite=Strict; Path=/')
        if path.path == '/local/sign-out' and self.command == 'POST':
            sessions.pop(session_id, None)
            return self.reply({}, cookie='kairos_desktop=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/')
        if path.path == '/local/calculate' and self.command == 'POST':
            return self.reply(calculate(body))
        if not token:
            return self.reply({'error': 'Sign in to load your account charts.'}, 401)
        if self.command == 'GET' and path.path in ('/local/changes', '/local/transfers'):
            cursor = urllib.parse.parse_qs(path.query).get('cursor', ['0'])[0]
            if not re.fullmatch(r'\d{1,16}', cursor):
                raise ValueError('Invalid cursor')
            route = '/api/chart-sync/v2' if path.path == '/local/changes' else '/api/chart-transfers/v1'
            return self.reply(upstream(f'{route}/changes?cursor={cursor}&limit=100', token))
        if self.command == 'POST' and path.path == '/local/previews':
            ids = body.get('snapshotIds')
            if not isinstance(ids, list) or not 0 < len(ids) <= 100 or not all(
                    isinstance(value, str) and re.fullmatch(r'[a-fA-F0-9-]{36}', value) for value in ids):
                raise ValueError('Invalid chart snapshots')
            return self.reply(upstream('/api/chart-transfers/v1/conversion-previews', token, {'snapshotIds': ids}))
        self.reply({'error': 'Unknown local operation'}, 404)

    def dispatch_local(self):
        try:
            self.local()
        except urllib.error.HTTPError as error:
            if error.code == 401:
                sessions.pop(self.session_id(), None)
            self.reply({'error': 'Sign-in expired. Sign in again.' if error.code == 401 else
                        f'Account server returned HTTP {error.code}. Retry in a moment.'}, error.code)
        except (ValueError, OSError, urllib.error.URLError) as error:
            self.reply({'error': str(error)}, 400)
        except Exception:
            self.reply({'error': 'The local chart viewer could not complete this request.'}, 500)

    def do_GET(self):
        if self.path.startswith('/local/'):
            return self.dispatch_local()
        if not self.safe_request():
            return self.reply({'error': 'Open the printed 127.0.0.1 URL.'}, 403)
        super().do_GET()

    def do_POST(self):
        self.dispatch_local()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-build', action='store_true')
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not args.skip_build:
        subprocess.run(['npm', 'run', 'web:build'], cwd=ROOT, check=True)
    wasm = ROOT / 'node_modules/canvaskit-wasm/bin/full/canvaskit.wasm'
    shutil.copyfile(wasm, ROOT / 'dist/canvaskit.wasm')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Kairōs charts: http://127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
