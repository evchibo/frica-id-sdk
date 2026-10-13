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
 * KYC verification status.
 */
export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/**
 * KYC verification tier level.
 */
export type KycTier = 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';

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

  /**
   * KYC Verification Status (returned when 'kyc.status' or 'kyc:read' scope is requested).
   */
  kycStatus?: KycStatus;

  /**
   * Verified KYC Tier level (e.g. TIER_0, TIER_1, TIER_2, TIER_3).
   */
  kycTier?: KycTier;

  /**
   * Timestamp when KYC verification was approved.
   */
  kycVerifiedAt?: string;

  /**
   * Legal first name from verified government ID (requires 'kyc.identity' scope).
   */
  kycLegalFirstName?: string;

  /**
   * Legal last name from verified government ID (requires 'kyc.identity' scope).
   */
  kycLegalLastName?: string;

  /**
   * Date of birth from verified identity document (requires 'kyc.identity' scope).
   */
  kycDateOfBirth?: string;

  /**
   * Verified nationality ISO country code (requires 'kyc.identity' scope).
   */
  kycNationality?: string;

  /**
   * Verified country of residence ISO country code (requires 'kyc.identity' scope).
   */
  kycCountryOfResidence?: string;

  [key: string]: any;
}

/**
 * Parameters for creating a hosted developer KYC session.
 */
export interface CreateKycSessionOptions {
  /**
   * Target Frica user ID or client-specific external user reference.
   */
  targetUserId?: string;

  /**
   * Desired KYC verification tier. Defaults to TIER_2 if unspecified.
   */
  requestedTier?: 'TIER_1' | 'TIER_2' | 'TIER_3';

  /**
   * Optional custom webhook or redirect callback URL upon completion.
   */
  callbackUrl?: string;
}

/**
 * Response from initiating a hosted KYC verification session.
 */
export interface KycSessionResult {
  sessionId: string;
  clientSecret: string;
  hostedUrl: string;
  expiresAt: string;
  targetUserId?: string;
  requestedTier?: string;
}

/**
 * Detailed KYC verification outcome and extracted claims.
 */
export interface KycVerificationDetails {
  verificationId: string;
  userId: string;
  status: KycStatus;
  tier: KycTier;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  claims?: {
    legalFirstName?: string;
    legalLastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    country?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Request payload for instant server-to-server KYC identity verification.
 */
export interface InstantCheckOptions {
  country: string;
  idType: 'BVN' | 'NIN' | string;
  idNumber: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

/**
 * Result returned from an instant KYC check against official identity registries.
 */
export interface InstantCheckResult {
  verified: boolean;
  confidenceScore?: number;
  matchDetails?: {
    nameMatched?: boolean;
    dobMatched?: boolean;
    [key: string]: any;
  };
  providerReference?: string;
  [key: string]: any;
}

/**
 * Authentication options for developer KYC API queries.
 */
export interface DeveloperAuthOptions {
  apiKey?: string;
  accessToken?: string;
  issuerUrl?: string;
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
