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

test('FricaClient properly extracts and maps KYC claims from userinfo endpoint', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (url.toString().includes('/oauth/userinfo')) {
        return {
          ok: true,
          json: async () => ({
            sub: 'frica_user_123',
            name: 'Amina Bello',
            email: 'amina@example.com',
            email_verified: true,
            kyc_status: 'APPROVED',
            kyc_tier: 'TIER_2',
            kyc_verified_at: '2026-10-13T12:00:00Z',
            kyc_legal_first_name: 'Amina',
            kyc_legal_last_name: 'Bello',
            kyc_date_of_birth: '1995-05-15',
            kyc_nationality: 'NG',
            kyc_country_of_residence: 'NG'
          })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    };

    const client = createFricaClient({
      clientId: 'fcli_test_123',
      redirectUri: 'https://myapp.com/callback',
      storage: new MemoryStorage()
    });

    const user = await client.getUserInfo('mock_access_token');
    assert.strictEqual(user.sub, 'frica_user_123');
    assert.strictEqual(user.name, 'Amina Bello');
    assert.strictEqual(user.kycStatus, 'APPROVED');
    assert.strictEqual(user.kycTier, 'TIER_2');
    assert.strictEqual(user.kycVerifiedAt, '2026-10-13T12:00:00Z');
    assert.strictEqual(user.kycLegalFirstName, 'Amina');
    assert.strictEqual(user.kycLegalLastName, 'Bello');
    assert.strictEqual(user.kycNationality, 'NG');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Developer Wallet and KYC token methods in Node.js SDK', async () => {
  const { getDeveloperWallet, topupDeveloperWallet, verifyDigitalPassport } = await import('../dist/index.js');
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/developer/wallet/topup')) {
        const body = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            success: true,
            bonusTokens: 5,
            wallet: {
              id: 'wal_dev_99',
              ownerId: 'app_123',
              ownerType: 'DEVELOPER_ORG',
              currency: 'FRICA',
              availableBalance: body.amountUsd + 5,
              lockedBalance: 0,
              totalToppedUp: body.amountUsd
            }
          })
        };
      }
      if (urlStr.includes('/v1/developer/wallet')) {
        return {
          ok: true,
          json: async () => ({
            wallet: {
              id: 'wal_dev_99',
              ownerId: 'app_123',
              ownerType: 'DEVELOPER_ORG',
              currency: 'FRICA',
              availableBalance: 45.0,
              lockedBalance: 0,
              totalToppedUp: 50.0
            }
          })
        };
      }
      if (urlStr.includes('/v1/kyc/passport/verify/FRICA-PASSPORT-12345')) {
        return {
          ok: true,
          json: async () => ({
            verified: true,
            identifier: 'FRICA-PASSPORT-12345',
            fullName: 'Kwame Mensah',
            country: 'GH',
            status: 'APPROVED'
          })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    };

    const wallet = await getDeveloperWallet({ apiKey: 'fkey_live_test_123' });
    assert.strictEqual(wallet.availableBalance, 45.0);
    assert.strictEqual(wallet.currency, 'FRICA');

    const topup = await topupDeveloperWallet({
      amountUsd: 100,
      paymentMethod: 'MOBILE_MONEY',
      mobileMoneyProvider: 'MPESA'
    }, { apiKey: 'fkey_live_test_123' });
    assert.strictEqual(topup.success, true);
    assert.strictEqual(topup.bonusTokens, 5);
    assert.strictEqual(topup.wallet.availableBalance, 105);

    const passport = await verifyDigitalPassport('FRICA-PASSPORT-12345');
    assert.strictEqual(passport.verified, true);
    assert.strictEqual(passport.fullName, 'Kwame Mensah');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FricaClient user wallet and token operations', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.includes('/v1/wallet/pay-service')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            wallet: {
              id: 'wal_usr_11',
              availableBalance: 20.01,
              currency: 'FRICA'
            }
          })
        };
      }
      if (urlStr.includes('/v1/wallet')) {
        return {
          ok: true,
          json: async () => ({
            wallet: {
              id: 'wal_usr_11',
              ownerId: 'frica_usr_11',
              ownerType: 'USER',
              currency: 'FRICA',
              availableBalance: 25.0,
              lockedBalance: 0,
              totalToppedUp: 25.0
            }
          })
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    };

    const storage = new MemoryStorage();
    await storage.setItem('frica_access_token', 'mock_token_abc');

    const client = createFricaClient({
      clientId: 'fcli_test_123',
      redirectUri: 'https://myapp.com/callback',
      storage
    });

    const wallet = await client.getUserWallet();
    assert.strictEqual(wallet.availableBalance, 25.0);

    const payResult = await client.payServiceWithTokens({
      serviceType: 'PRO_SUBSCRIPTION',
      amountTokens: 4.99
    });
    assert.strictEqual(payResult.success, true);
    assert.strictEqual(payResult.wallet.availableBalance, 20.01);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('UserInfo exposes optional Public Frica ID without changing the OAuth subject', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const subject = 'usr_opaque_account_reference';
    for (const [claims, expected] of [
      [{ public_id: 'FID-7K9MX4QP2N8C' }, 'FID-7K9MX4QP2N8C'],
      [{ publicId: 'FID-7K9MX4QP2N8C' }, 'FID-7K9MX4QP2N8C'],
      [{ public_id: 'FID-7K9MX4QP2N8C', publicId: 'stale-alias' }, 'FID-7K9MX4QP2N8C'],
      [{}, undefined],
      [{ public_id: 42, publicId: false }, undefined],
    ]) {
      const storage = new MemoryStorage();
      const client = createFricaClient({ clientId: 'test-public-id', redirectUri: 'https://example.test/callback', storage });
      const picture = 'https://api.frica.id/users/FID-7K9MX4QP2N8C/avatar';
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ sub: subject, name: 'Frica member', picture, ...claims }) });
      const user = await client.getUserInfo('test-access-token');
      assert.equal(user.publicId, expected);
      assert.equal(user.sub, subject);
      assert.equal(user.avatarUrl, picture);
      assert.equal((await client.getUser()).publicId, expected);
    }
  } finally { globalThis.fetch = originalFetch; }
});
