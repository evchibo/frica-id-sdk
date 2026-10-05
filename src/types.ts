/**
 * Configuration options for FricaClient.
 */
export interface FricaConfig {
  /**
   * The registered OAuth 2.1 Client ID obtained from the Frica ID Developer Console.
   */
  clientId: string;

  /**
   * The callback redirect URI registered for this application.
   */
  redirectUri: string;

  /**
   * Optional base URL of the Frica ID server.
   * Defaults to 'https://api.frica.id' in production.
   */
  issuerUrl?: string;

  /**
   * Optional frontend web portal URL for interactive authorization and consent.
   * Defaults to 'https://frica.id' in production.
   */
  portalUrl?: string;

  /**
   * Default scopes requested during authorization.
   * Defaults to 'openid profile email'.
   */
  defaultScope?: string;

  /**
   * Custom token storage implementation.
   * Defaults to localStorage in browser environments, or in-memory fallback.
   */
  storage?: TokenStorage;
}

/**
 * OAuth 2.1 Token Response returned after code exchange or token refresh.
 */
export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  idToken?: string;
  scope?: string;
  expiresAt?: number; // Calculated epoch timestamp (ms)
}

/**
 * Authenticated Frica User Profile Claims.
 */
export interface FricaUser {
  /**
   * Unique subject identifier prefixed with frica_ (e.g. frica_00c2...).
   */
  sub: string;
  id?: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber?: string;
  avatarUrl?: string;
  picture?: string;
  country?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  [key: string]: any;
}

/**
 * Options for initiating an interactive authorization flow.
 */
export interface AuthorizeOptions {
  /**
   * Scopes to request for this authorization session.
   */
  scope?: string;

  /**
   * Cryptographic state parameter to prevent CSRF.
   */
  state?: string;

  /**
   * Nonce to associate with client session and ID Token.
   */
  nonce?: string;

  /**
   * Optional prompt behavior.
   */
  prompt?: 'login' | 'consent' | 'none';
}

/**
 * Pluggable token storage adapter.
 */
export interface TokenStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/**
 * Result of exchanging an authorization code.
 */
export interface AuthResult {
  tokens: TokenResponse;
  user: FricaUser;
  state?: string;
}
