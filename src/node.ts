import {
  FricaUser,
  CreateKycSessionOptions,
  KycSessionResult,
  KycVerificationDetails,
  InstantCheckOptions,
  InstantCheckResult,
  DeveloperAuthOptions,
  FricaWallet,
  WalletTopupOptions,
  DigitalPassportVerificationResult
} from './types.js';

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
  const raw = data?.data ?? data;
  if (!raw) return null;

  return {
    sub: String(raw.sub || raw.id || ''),
    id: raw.id ? String(raw.id) : undefined,
    name: String(raw.name || raw.preferred_username || raw.given_name || ''),
    email: String(raw.email || raw.email_address || ''),
    emailVerified: raw.email_verified === true || raw.emailVerified === true,
    phoneNumber: raw.phone_number || raw.phoneNumber || raw.phone || undefined,
    avatarUrl: raw.avatar_url || raw.avatarUrl || raw.picture || undefined,
    picture: raw.picture || raw.avatar_url || raw.avatarUrl || undefined,
    country: raw.country || undefined,
    role: raw.role || undefined,
    status: raw.status || undefined,
    kycStatus: raw.kyc_status || raw.kycStatus || undefined,
    kycTier: raw.kyc_tier || raw.kycTier || undefined,
    kycVerifiedAt: raw.kyc_verified_at || raw.kycVerifiedAt || undefined,
    kycLegalFirstName: raw.kyc_legal_first_name || raw.kycLegalFirstName || undefined,
    kycLegalLastName: raw.kyc_legal_last_name || raw.kycLegalLastName || undefined,
    kycDateOfBirth: raw.kyc_date_of_birth || raw.kycDateOfBirth || undefined,
    kycNationality: raw.kyc_nationality || raw.kycNationality || undefined,
    kycCountryOfResidence: raw.kyc_country_of_residence || raw.kycCountryOfResidence || undefined,
    ...raw
  };
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

/**
 * Creates a hosted developer KYC session via server API key or access token.
 */
export async function createDeveloperKycSession(
  options: CreateKycSessionOptions,
  auth: DeveloperAuthOptions
): Promise<KycSessionResult> {
  const issuerUrl = (auth.issuerUrl || 'https://api.frica.id').replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (auth.apiKey) {
    headers['x-api-key'] = auth.apiKey;
  } else if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  } else {
    throw new Error('Either apiKey or accessToken must be provided for developer KYC session creation');
  }

  // Gracefully format body to adhere to API schema
  const payload = {
    requestedTier: options.requestedTier || 'TIER_2',
    returnUrl: options.returnUrl || options.callbackUrl || 'https://frica.id/callback',
    cancelUrl: options.cancelUrl,
    customReference: options.customReference,
    allowedDocumentTypes: options.allowedDocumentTypes,
    customer: options.customer || {
      externalUserId: options.targetUserId || `ext_${Date.now()}`
    },
    metadata: options.metadata
  };

  const res = await fetch(`${issuerUrl}/v1/developer/kyc/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Failed to create KYC session');
  }

  const raw = data?.data ?? data;
  return {
    ...raw,
    hostedUrl: raw.sessionUrl || raw.hostedUrl
  };
}

/**
 * Queries KYC verification status and details by verification session ID.
 */
export async function getDeveloperKycVerification(
  verificationId: string,
  auth: DeveloperAuthOptions
): Promise<KycVerificationDetails> {
  const issuerUrl = (auth.issuerUrl || 'https://api.frica.id').replace(/\/+$/, '');
  const headers: Record<string, string> = {
    Accept: 'application/json'
  };

  if (auth.apiKey) {
    headers['x-api-key'] = auth.apiKey;
  } else if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  } else {
    throw new Error('Either apiKey or accessToken must be provided');
  }

  const res = await fetch(`${issuerUrl}/v1/developer/kyc/verifications/${verificationId}`, {
    method: 'GET',
    headers
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Failed to fetch KYC verification');
  }

  return data?.data ?? data;
}

/**
 * Runs an instant server-to-server KYC check (e.g. BVN, NIN, Passport) against official registries.
 */
export async function instantDeveloperKycCheck(
  input: InstantCheckOptions,
  auth: DeveloperAuthOptions
): Promise<InstantCheckResult> {
  const issuerUrl = (auth.issuerUrl || 'https://api.frica.id').replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (auth.apiKey) {
    headers['x-api-key'] = auth.apiKey;
  } else if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  } else {
    throw new Error('Either apiKey or accessToken must be provided');
  }

  const payload = {
    country: input.country,
    documentType: input.documentType || (input.idType === 'NIN' || input.idType === 'BVN' ? 'NATIONAL_ID' : input.idType) || 'NATIONAL_ID',
    documentNumber: input.documentNumber || input.idNumber || '000000',
    firstName: input.firstName || 'Verified',
    lastName: input.lastName || 'User',
    dateOfBirth: input.dateOfBirth || '1990-01-01',
    idType: input.idType,
    idNumber: input.idNumber
  };

  const res = await fetch(`${issuerUrl}/v1/developer/kyc/instant-check`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Failed to perform instant KYC check');
  }

  return data?.data ?? data;
}

/**
 * Retrieves the developer organization token wallet and remaining verification runway.
 */
export async function getDeveloperWallet(
  auth: DeveloperAuthOptions
): Promise<FricaWallet> {
  const issuerUrl = (auth.issuerUrl || 'https://api.frica.id').replace(/\/+$/, '');
  const headers: Record<string, string> = {
    Accept: 'application/json'
  };

  if (auth.apiKey) {
    headers['x-api-key'] = auth.apiKey;
  } else if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  } else {
    throw new Error('Either apiKey or accessToken must be provided');
  }

  const res = await fetch(`${issuerUrl}/v1/developer/wallet`, {
    method: 'GET',
    headers
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Failed to fetch developer wallet');
  }

  return data?.wallet ?? data?.data ?? data;
}

/**
 * Tops up Frica Tokens in the developer organization wallet.
 */
export async function topupDeveloperWallet(
  options: WalletTopupOptions,
  auth: DeveloperAuthOptions
): Promise<{ success: boolean; wallet: FricaWallet; bonusTokens?: number }> {
  const issuerUrl = (auth.issuerUrl || 'https://api.frica.id').replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (auth.apiKey) {
    headers['x-api-key'] = auth.apiKey;
  } else if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  } else {
    throw new Error('Either apiKey or accessToken must be provided');
  }

  const res = await fetch(`${issuerUrl}/v1/developer/wallet/topup`, {
    method: 'POST',
    headers,
    body: JSON.stringify(options)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Failed to top up developer wallet');
  }

  return data?.data ?? data;
}

/**
 * Verifies public authenticity of a digital passport identifier or QR code.
 */
export async function verifyDigitalPassport(
  identifier: string,
  issuerUrl: string = 'https://api.frica.id'
): Promise<DigitalPassportVerificationResult> {
  const base = issuerUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/v1/kyc/passport/verify/${encodeURIComponent(identifier)}`, {
    headers: { Accept: 'application/json' }
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      verified: false,
      identifier,
      message: data?.message || 'Digital passport authenticity verification failed'
    };
  }

  return data?.data ?? data;
}
