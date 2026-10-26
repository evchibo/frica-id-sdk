#!/usr/bin/env python3
"""Tag a validated main revision and dispatch publishing from that immutable tag."""
import json
import os
import pathlib
import re
import urllib.error
import urllib.request

API = 'https://api.github.com'

def request(url, method='GET', data=None, token=None):
    headers = {'Accept': 'application/json', 'User-Agent': 'Frica-SDK-release'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = None if data is None else json.dumps(data).encode()
    if body is not None:
        headers['Content-Type'] = 'application/json'
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        if error.code == 404 and method == 'GET':
            return None
        raise

def release(version, registry_url, env, send=request):
    if env.get('GITHUB_EVENT_NAME') != 'push' or env.get('GITHUB_REF') != 'refs/heads/main':
        raise RuntimeError('Release is restricted to a validated push to main')
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version):
        raise RuntimeError('Release version must be stable semantic version')
    repo, sha = env['GITHUB_REPOSITORY'], env['GITHUB_SHA']
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo) or not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise RuntimeError('Invalid repository or commit')
    token = env['GH_TOKEN']
    def github(path, method='GET', data=None):
        return send(API + '/repos/' + repo + path, method=method, data=data, token=token)
    current = github('/git/ref/heads/main')
    if current['object']['sha'] != sha:
        return 'Skipped an older main revision'
    published = send(registry_url)
    if published is not None:
        if published.get('version') != version:
            raise RuntimeError('Registry returned an unexpected version')
        return 'Version ' + version + ' is already published'
    tag = 'v' + version
    existing = github('/git/ref/tags/' + tag)
    if existing is not None:
        if existing['object']['type'] != 'commit' or existing['object']['sha'] != sha:
            raise RuntimeError('Existing release tag differs; refusing to move it')
    else:
        github('/git/refs', 'POST', {'ref': 'refs/tags/' + tag, 'sha': sha})
    # GITHUB_TOKEN-created tag pushes do not trigger workflows. Explicit dispatch does,
    # and passing the tag gives registry OIDC verification an actual tag ref.
    github('/actions/workflows/publish.yml/dispatches', 'POST', {'ref': tag})
    return 'Publishing dispatched from ' + tag

def main():
    root = pathlib.Path(__file__).resolve().parents[1]
    if (root / 'package.json').exists():
        package = json.loads((root / 'package.json').read_text())
        if package['name'] != '@frica/id-sdk':
            raise RuntimeError('Unexpected npm package')
        version = package['version']
        registry = 'https://registry.npmjs.org/@frica%2fid-sdk/' + version
    else:
        manifest = (root / 'pubspec.yaml').read_text()
        if not re.search(r'^name: frica_id_flutter\s*$', manifest, re.M):
            raise RuntimeError('Unexpected Dart package')
        match = re.search(r'^version: ([0-9]+\.[0-9]+\.[0-9]+)\s*$', manifest, re.M)
        if not match:
            raise RuntimeError('Missing stable Dart version')
        version = match.group(1)
        registry = 'https://pub.dev/api/packages/frica_id_flutter/versions/' + version
    print(release(version, registry, os.environ))

if __name__ == '__main__':
    main()

