import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('release', pathlib.Path(__file__).parents[1] / 'tools/release.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.sha = 'a' * 40
        self.env = {'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/main', 'GITHUB_REPOSITORY': 'evchibo/sdk', 'GITHUB_SHA': self.sha, 'GH_TOKEN': 'fake-test-token'}
        self.calls = []
        self.published = None
        self.tag = None
        self.main = self.sha

    def send(self, url, method='GET', data=None, token=None):
        self.calls.append((url, method, data, token))
        if url == 'https://registry.example/version':
            self.assertIsNone(token)
            return self.published
        self.assertTrue(url.startswith('https://api.github.com/repos/evchibo/sdk/'))
        self.assertEqual(token, 'fake-test-token')
        if url.endswith('/git/ref/heads/main'):
            return {'object': {'sha': self.main}}
        if '/git/ref/tags/' in url:
            return self.tag
        return {}

    def run_release(self):
        return module.release('1.2.0', 'https://registry.example/version', self.env, self.send)

    def test_tags_and_dispatches_immutable_tag(self):
        self.run_release()
        writes = [x for x in self.calls if x[1] == 'POST']
        self.assertEqual(writes[0][2], {'ref': 'refs/tags/v1.2.0', 'sha': self.sha})
        self.assertEqual(writes[1][2], {'ref': 'v1.2.0'})

    def test_published_version_is_not_republished(self):
        self.published = {'version': '1.2.0'}
        self.run_release()
        self.assertFalse(any(x[1] == 'POST' for x in self.calls))

    def test_old_main_is_skipped(self):
        self.main = 'b' * 40
        self.run_release()
        self.assertEqual(len(self.calls), 1)

    def test_existing_tag_cannot_be_moved(self):
        self.tag = {'object': {'type': 'commit', 'sha': 'b' * 40}}
        with self.assertRaises(RuntimeError):
            self.run_release()
        self.assertFalse(any(x[1] == 'POST' for x in self.calls))

    def test_same_tag_allows_retry(self):
        self.tag = {'object': {'type': 'commit', 'sha': self.sha}}
        self.run_release()
        self.assertEqual(len([x for x in self.calls if x[1] == 'POST']), 1)

    def test_pull_requests_cannot_release(self):
        self.env['GITHUB_EVENT_NAME'] = 'pull_request'
        with self.assertRaises(RuntimeError):
            self.run_release()
        self.assertEqual(self.calls, [])

    def test_registry_failure_stops_release(self):
        self.published = {'version': 'other'}
        with self.assertRaises(RuntimeError):
            self.run_release()
        self.assertFalse(any(x[1] == 'POST' for x in self.calls))

    def test_network_failure_stops_release(self):
        def broken(*args, **kwargs):
            raise OSError('test connection failed')
        with self.assertRaises(OSError):
            module.release('1.2.0', 'https://registry.example/version', self.env, broken)

if __name__ == '__main__':
    unittest.main()

