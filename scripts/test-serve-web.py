"""Exercise the local account boundary without real account credentials."""
import http.client
import importlib.util
import json
from pathlib import Path
import threading
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('desktop', Path(__file__).with_name('serve-web.py'))
desktop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(desktop)


class AccountBoundary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = desktop.ThreadingHTTPServer(('127.0.0.1', 0), desktop.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        desktop.sessions.clear()

    def request(self, path, body=None, cookie=None, origin=None):
        client = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Content-Type': 'application/json'}
        if cookie:
            headers['Cookie'] = cookie
        if origin:
            headers['Origin'] = origin
        client.request('POST' if body is not None else 'GET', path,
                       json.dumps(body) if body is not None else None, headers)
        response = client.getresponse()
        result = response.status, dict(response.getheaders()), json.loads(response.read())
        client.close()
        return result

    def test_sign_in_keeps_token_out_of_browser(self):
        with patch.object(desktop, 'upstream', side_effect=[
            {'session_token': 'secret-original'},
            {'did': 'did:plc:fixture', 'handle': 'fixture.test', 'refreshed_token': 'secret-renewed'},
        ]):
            status, headers, body = self.request('/local/sign-in', {'code': 'a' * 64})
        self.assertEqual(status, 200)
        self.assertEqual(body, {'account': {'did': 'did:plc:fixture', 'handle': 'fixture.test'}})
        self.assertNotIn('secret-', json.dumps(body) + str(headers))
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Strict', headers['Set-Cookie'])
        self.assertEqual(list(desktop.sessions.values()), ['secret-renewed'])

    def test_other_origin_cannot_exchange_or_read_account(self):
        desktop.sessions['fixture'] = 'secret-token'
        with patch.object(desktop, 'upstream') as remote:
            for path, body in [('/local/sign-in', {'code': 'a' * 64}), ('/local/changes', None)]:
                status, _, _ = self.request(path, body, 'kairos_desktop=fixture', 'https://other.example')
                self.assertEqual(status, 403)
            remote.assert_not_called()

    def test_anonymous_cannot_read_account(self):
        with patch.object(desktop, 'upstream') as remote:
            self.assertEqual(self.request('/local/changes')[0], 401)
            remote.assert_not_called()

    def test_only_allowlisted_account_reads_and_sign_out(self):
        desktop.sessions['fixture'] = 'secret-token'
        cookie = 'kairos_desktop=fixture'
        with patch.object(desktop, 'upstream', return_value={'records': [], 'cursor': 3, 'hasMore': False}) as remote:
            self.assertEqual(self.request('/local/changes?cursor=3', cookie=cookie)[0], 200)
            remote.assert_called_once_with('/api/chart-sync/v2/changes?cursor=3&limit=100', 'secret-token')
            self.assertEqual(self.request('/local/push', {'operations': []}, cookie)[0], 404)
            self.assertEqual(remote.call_count, 1)
            self.assertEqual(self.request('/local/sign-out', {}, cookie)[0], 200)
            self.assertEqual(self.request('/local/changes', cookie=cookie)[0], 401)
            self.assertFalse(desktop.sessions)


if __name__ == '__main__':
    unittest.main()
