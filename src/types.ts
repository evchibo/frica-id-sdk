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
   * Customer identification details.
   */
  customer?: {
    externalUserId: string;
    email?: string;
    name?: string;
  };

  /**
   * Desired KYC verification tier. Defaults to TIER_2 if unspecified.
   */
  requestedTier?: 'TIER_1' | 'TIER_2' | 'TIER_3';

  /**
   * Return URL after user completes or exits the KYC verification flow.
   */
  returnUrl?: string;

  /**
   * Optional custom webhook or redirect callback URL (alias for returnUrl).
   */
  callbackUrl?: string;

  /**
   * Optional URL to redirect if applicant cancels verification.
   */
  cancelUrl?: string;

  /**
   * Custom developer tracking reference.
   */
  customReference?: string;

  /**
   * Allowed document types for this session.
   */
  allowedDocumentTypes?: ('PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'VOTER_ID' | 'RESIDENCE_PERMIT')[];

  /**
   * Arbitrary metadata stored with this session.
   */
  metadata?: Record<string, any>;
}

/**
 * Response from initiating a hosted KYC verification session.
 */
export interface KycSessionResult {
  sessionId: string;
  clientSecret: string;
  hostedUrl: string;
  sessionUrl?: string;
  expiresAt: string;
  targetUserId?: string;
  requestedTier?: string;
  applicationId?: string;
  applicationName?: string;
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
  idType?: 'BVN' | 'NIN' | 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | string;
  idNumber?: string;
  documentType?: 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'VOTER_ID' | 'RESIDENCE_PERMIT' | string;
  documentNumber?: string;
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
  matchConfidence?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  watchlistHit?: boolean;
  mrzValid?: boolean;
  message?: string;
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

/**
 * Sovereign Frica Wallet holding FRICA tokens (1 FRICA = 1 USD).
 */
export interface FricaWallet {
  id: string;
  ownerId: string;
  ownerType: 'USER' | 'DEVELOPER_ORG';
  currency: string;
  availableBalance: number;
  lockedBalance: number;
  totalToppedUp: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Payment rails supported for wallet top-up and token acquisition.
 */
export type WalletPaymentRail =
  | 'CARD'
  | 'MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'CRYPTO'
  | 'TOKEN_BALANCE'
  | 'SANDBOX'
  | 'MOCK'
  | string;

/**
 * Frica Wallet Ledger Transaction.
 */
export interface FricaWalletTransaction {
  id: string;
  walletId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  type: 'TOPUP' | 'PAYMENT' | 'KYC_DEDUCTION' | 'REFUND' | 'BONUS_GRANT' | string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | string;
  reference: string;
  paymentMethod?: WalletPaymentRail;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

/**
 * Options for topping up Frica Tokens in a developer or user wallet.
 */
export interface WalletTopupOptions {
  /**
   * Amount in USD to top up (converts 1:1 to FRICA tokens plus tiered bonuses).
   */
  amountUsd: number;

  /**
   * Payment rail. Use 'SANDBOX' or 'MOCK' when testing with admin/sandbox credentials.
   */
  paymentMethod: WalletPaymentRail;

  /**
   * Mobile Money provider (e.g. 'MPESA', 'MTN_MOMO', 'ORANGE_MONEY', 'AIRTEL_MONEY') if paymentMethod is MOBILE_MONEY.
   */
  mobileMoneyProvider?: string;

  /**
   * Phone number in international format (+234, +254, etc.) for Mobile Money STK push.
   */
  phoneNumber?: string;

  /**
   * Optional payment reference from gateway.
   */
  paymentReference?: string;

  /**
   * Whether to run in sandbox simulation mode.
   */
  isSandbox?: boolean;
}

/**
 * Options for paying for services using token balance.
 */
export interface PayServiceWithTokensOptions {
  serviceType: 'PRO_SUBSCRIPTION' | 'PRO_PLUS_SUBSCRIPTION' | 'BUSINESS_SUBSCRIPTION' | string;
  tier?: 'PRO' | 'PRO_PLUS' | 'BUSINESS' | string;
  amountTokens?: number;
}

/**
 * Public Digital Passport authenticity verification result.
 */
export interface DigitalPassportVerificationResult {
  verified: boolean;
  identifier: string;
  fullName?: string;
  country?: string;
  status?: string;
  tier?: string;
  issuedAt?: string;
  expiresAt?: string;
  qrVerified?: boolean;
  message?: string;
  [key: string]: any;
}
