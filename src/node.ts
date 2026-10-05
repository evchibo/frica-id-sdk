import { FricaUser } from './types.js';

export interface TokenVerificationOptions {
  issuerUrl?: string;
  clientId?: string;
}

export interface IntrospectionResult {
  active: boolean;
  scope?: string;
  clientId?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  [key: string]: any;
}

/**
 * Node.js helper to introspect an OAuth 2.1 access token against the Frica ID server.
 */
export async function introspectToken(
  token: string,
  options: {
    clientId: string;
    clientSecret?: string;
    issuerUrl?: string;
  }
): Promise<IntrospectionResult> {
  const issuerUrl = (options.issuerUrl || 'https://api.frica.id').replace(/\/+$/, '');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (options.clientSecret) {
    const credentials = Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const res = await fetch(`${issuerUrl}/oauth/introspect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      token,
      client_id: options.clientId
    })
  });

  if (!res.ok) {
    return { active: false };
  }

  const data = await res.json().catch(() => ({ active: false }));
  return data.data ?? data;
}

/**
 * Fetches the user profile associated with an access token on the backend.
 */
export async function getUserFromToken(
  accessToken: string,
  issuerUrl: string = 'https://api.frica.id'
): Promise<FricaUser | null> {
  const base = issuerUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/oauth/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.data ?? data;
}

/**
 * Express / Connect compatible middleware for protecting API endpoints with Frica ID.
 */
export function fricaAuthMiddleware(options: {
  clientId: string;
  issuerUrl?: string;
  optional?: boolean;
}) {
  return async (req: any, res: any, next: (err?: any) => void) => {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (options.optional) return next();
      return res.status(401).json({ error: 'Unauthorized', message: 'Bearer token required' });
    }

    const token = authHeader.substring(7).trim();
    const user = await getUserFromToken(token, options.issuerUrl);

    if (!user) {
      if (options.optional) return next();
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired Frica ID token' });
    }

    req.fricaUser = user;
    req.fricaToken = token;
    next();
  };
}
