# @frica/id-sdk

The official TypeScript/JavaScript SDK for **Sign in with Frica ID**. Implements OAuth 2.1 with PKCE, user authentication, session token refresh, and ready-to-use React components.

[![npm version](https://img.shields.io/npm/v/@frica/id-sdk.svg)](https://www.npmjs.com/package/@frica/id-sdk)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

---

## Features

- 🔐 **OAuth 2.1 PKCE by Default:** Full RFC 7636 security. No client secrets required on the frontend.
- ⚡️ **Lightweight & Universal:** Works seamlessly in all modern browsers and Node.js backend environments.
- ⚛️ **Official React Support:** Built-in `<FricaAuthProvider>` and `useFricaAuth()` hook.
- 🎨 **Branded Button Widget:** Pure AMOLED black (`#000000`) and glowing Frica Gold (`#FFCC00`) `<FricaSignInButton />`.
- 🔄 **Automatic Token Lifecycle:** Manages token expiration, refresh token rotation, and in-memory/localStorage caching.
- 🛠️ **Node.js Express / Connect Middleware:** Backend route protection and token introspection helpers.

---

## Installation

```bash
npm install @frica/id-sdk
# or
yarn add @frica/id-sdk
# or
pnpm add @frica/id-sdk
```

---

## 1. Quickstart: React / Next.js

### Step 1: Wrap your application in `<FricaAuthProvider>`

```tsx
// app/providers.tsx or index.tsx
import React from 'react';
import { createFricaClient, FricaAuthProvider } from '@frica/id-sdk';

const fricaClient = createFricaClient({
  clientId: 'YOUR_CLIENT_ID', // Registered in https://frica.id/dashboard/developer
  redirectUri: 'https://myapp.com/auth/callback',
  defaultScope: 'openid profile email'
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <FricaAuthProvider client={fricaClient}>{children}</FricaAuthProvider>;
}
```

### Step 2: Use the `<FricaSignInButton />` component

```tsx
import { FricaSignInButton, useFricaAuth } from '@frica/id-sdk';

export function LoginCard() {
  const { user, isAuthenticated, logout } = useFricaAuth();

  if (isAuthenticated && user) {
    return (
      <div className="p-4 bg-black text-white rounded-2xl border border-neutral-800">
        <p className="text-sm">Welcome back, <strong>{user.name}</strong>!</p>
        <p className="text-xs text-neutral-400">{user.email}</p>
        <button onClick={logout} className="mt-3 px-3 py-1 bg-red-600 rounded-lg text-xs">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Dark AMOLED Black theme (Default) */}
      <FricaSignInButton theme="dark" size="md" />

      {/* High-contrast Frica Gold theme */}
      <FricaSignInButton theme="gold" size="md" />

      {/* Light Clean theme */}
      <FricaSignInButton theme="light" size="md" />
    </div>
  );
}
```

### Step 3: Handle the Redirect Callback

On your callback route (`/auth/callback`):

```tsx
// app/auth/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createFricaClient } from '@frica/id-sdk';

const client = createFricaClient({
  clientId: 'YOUR_CLIENT_ID',
  redirectUri: 'https://myapp.com/auth/callback'
});

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    client.handleRedirectCallback()
      .then(({ user, tokens }) => {
        console.log('Logged in as:', user.email);
        router.push('/dashboard');
      })
      .catch((err) => {
        console.error('Login failed:', err);
      });
  }, [router]);

  return <div className="p-8 text-center text-white">Signing in with Frica ID...</div>;
}
```

---

## 2. Vanilla JavaScript / SPA Integration

```typescript
import { createFricaClient } from '@frica/id-sdk';

const client = createFricaClient({
  clientId: 'fcli_my_web_app',
  redirectUri: window.location.origin + '/callback.html',
  defaultScope: 'openid profile email'
});

// Trigger login redirect
document.getElementById('login-btn').addEventListener('click', () => {
  client.signInWithRedirect();
});

// On callback page (callback.html):
client.handleRedirectCallback().then(({ user, tokens }) => {
  console.log('Authenticated:', user);
  window.location.href = '/dashboard.html';
});
```

---

## 3. Node.js Backend Verification & Express Middleware

Protect your backend APIs by verifying Frica ID Bearer tokens:

```typescript
import express from 'express';
import { fricaAuthMiddleware, getUserFromToken, introspectToken } from '@frica/id-sdk';

const app = express();

// Protect a route with the built-in middleware
app.get('/api/protected', fricaAuthMiddleware({ clientId: 'YOUR_CLIENT_ID' }), (req, res) => {
  // Access authenticated Frica User Profile
  res.json({
    message: 'Hello from protected API',
    user: (req as any).fricaUser
  });
});

// Or introspect token directly
app.post('/api/verify', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const introspection = await introspectToken(token, {
    clientId: 'YOUR_CLIENT_ID'
  });

  if (!introspection.active) {
    return res.status(401).json({ error: 'Token invalid or revoked' });
  }

  res.json({ valid: true, sub: introspection.sub });
});
```

---

## API Reference

### `createFricaClient(config)`

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `clientId` | `string` | **Yes** | Client ID obtained from Frica Developer Console |
| `redirectUri` | `string` | **Yes** | Registered callback URL |
| `issuerUrl` | `string` | No | Base API URL (defaults to `https://api.frica.id`) |
| `portalUrl` | `string` | No | Auth Portal URL (defaults to `https://frica.id`) |
| `defaultScope` | `string` | No | Space-delimited scopes (defaults to `openid profile email`) |

### Client Methods

- `signInWithRedirect(options?)`: Redirects user to Frica ID sign-in page.
- `signInWithPopup(options?)`: Opens a centered popup and resolves once complete.
- `handleRedirectCallback(url?)`: Exchanges auth code for tokens and returns user claims.
- `getUser()`: Returns the stored `FricaUser` profile.
- `getValidAccessToken()`: Returns a non-expired access token, auto-refreshing if necessary.
- `refreshToken()`: Refreshes access token with the refresh token.
- `signOut()`: Revokes active tokens and clears client storage.
- `isAuthenticated()`: Returns `true` if a valid session exists.

---

## License

Apache-2.0 © Frica ID Team
