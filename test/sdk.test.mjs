import { test } from 'node:test';
import assert from 'node:assert';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateRandomString,
  createFricaClient,
  MemoryStorage
} from '../dist/index.js';

test('PKCE Generator produces valid RFC 7636 verifier and challenge', async () => {
  const verifier = generateCodeVerifier(64);
  assert.strictEqual(verifier.length, 64);
  assert.match(verifier, /^[A-Za-z0-9\-._~]+$/);

  const challenge = await generateCodeChallenge(verifier);
  assert.ok(challenge.length >= 43);
  assert.doesNotMatch(challenge, /=/); // No padding
  assert.match(challenge, /^[A-Za-z0-9\-_]+$/); // URL safe base64
});

test('PKCE Generator clamps verifier to valid 43-128 range', () => {
  const shortVerifier = generateCodeVerifier(20);
  assert.strictEqual(shortVerifier.length, 43);

  const longVerifier = generateCodeVerifier(200);
  assert.strictEqual(longVerifier.length, 128);
});

test('FricaClient generates proper authorization URL with PKCE parameters', async () => {
  const storage = new MemoryStorage();
  const client = createFricaClient({
    clientId: 'fcli_test_123',
    redirectUri: 'https://myapp.com/callback',
    defaultScope: 'openid profile email',
    storage
  });

  const { url, state, codeVerifier } = await client.getAuthorizationUrl({
    scope: 'openid profile email phone',
    state: 'test_custom_state'
  });

  assert.strictEqual(state, 'test_custom_state');
  assert.ok(codeVerifier.length >= 43);

  const parsedUrl = new URL(url);
  assert.strictEqual(parsedUrl.origin, 'https://api.frica.id');
  assert.strictEqual(parsedUrl.pathname, '/oauth/authorize');
  assert.strictEqual(parsedUrl.searchParams.get('client_id'), 'fcli_test_123');
  assert.strictEqual(parsedUrl.searchParams.get('redirect_uri'), 'https://myapp.com/callback');
  assert.strictEqual(parsedUrl.searchParams.get('response_type'), 'code');
  assert.strictEqual(parsedUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(parsedUrl.searchParams.get('state'), 'test_custom_state');
  assert.strictEqual(parsedUrl.searchParams.get('scope'), 'openid profile email phone');

  // Verify storage persisted state and verifier
  const storedVerifier = await storage.getItem('frica_pkce_verifier');
  const storedState = await storage.getItem('frica_oauth_state');
  assert.strictEqual(storedVerifier, codeVerifier);
  assert.strictEqual(storedState, 'test_custom_state');
});

test('MemoryStorage set, get, and delete operations', async () => {
  const storage = new MemoryStorage();
  await storage.setItem('test_key', 'test_val');
  assert.strictEqual(await storage.getItem('test_key'), 'test_val');

  await storage.removeItem('test_key');
  assert.strictEqual(await storage.getItem('test_key'), null);
});
