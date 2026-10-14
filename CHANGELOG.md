# Changelog

All notable changes to the Frica ID JavaScript/TypeScript SDK are documented here.

## 1.1.0

- Added Sovereign Wallet & Frica Token (`FRICA`) Support:
  - Added `FricaWallet`, `FricaWalletTransaction`, `WalletTopupOptions`, `WalletPaymentRail`, and `PayServiceWithTokensOptions` types.
  - Added Node.js backend developer methods:
    - `getDeveloperWallet()`: Query organization token balance and verification runway (0.45 FRICA per check).
    - `topupDeveloperWallet()`: Programmatically top up tokens via Card, Mobile Money, Crypto, or Admin Sandbox.
  - Added client-side wallet methods on `FricaClient`:
    - `getUserWallet()`: Retrieve sovereign user token wallet.
    - `topupUserWallet()`: Initiate user token top-up with multi-rail payments and bonus token calculation.
    - `payServiceWithTokens()`: Pay for account upgrades (Pro, Pro+, Business) directly with tokens.
- Added Digital Passport Authenticity Verification:
  - Added `verifyDigitalPassport(identifier)` in both client and Node.js SDK to verify scanned passport QR codes and public authenticity.
- Enhanced KYC API Parity & Robustness:
  - Added seamless mapping of `returnUrl` / `callbackUrl`, and `customer` / `targetUserId` in `createDeveloperKycSession()`.
  - Added auto-mapping of `idType` <-> `documentType` and `idNumber` <-> `documentNumber` in `instantDeveloperKycCheck()`.
- Rebuilt distribution files and added comprehensive automated test coverage.

## 1.0.5

- Added comprehensive KYC and identity verification support:
  - Added strongly-typed KYC claims on `FricaUser` (`kycStatus`, `kycTier`, `kycVerifiedAt`, `kycLegalFirstName`, `kycLegalLastName`, `kycDateOfBirth`, `kycNationality`, `kycCountryOfResidence`).
  - Added automated mapping of `/oauth/userinfo` KYC claims for `kyc.status` and `kyc.identity` OAuth scopes.
  - Added `FricaClient.createKycSession()` and `FricaClient.getKycVerification()` methods for client-side hosted verification integration.
  - Added `FricaClient.launchKycVerification()` browser redirection and popup helper.
  - Added backend developer KYC helpers in `@frica/id-sdk/node`: `createDeveloperKycSession()`, `getDeveloperKycVerification()`, and `instantDeveloperKycCheck()` supporting API keys and Bearer tokens.
  - Added unit tests for KYC claim parsing and model transformations.

## 1.0.4

- Added automated CI validation for builds, tests, and package contents.
- Added secure npm trusted publishing through GitHub Actions and OIDC.
- Added package lifecycle validation before publishing.
- Added the Apache 2.0 license file to the published package.
- Added this changelog for release tracking.

## 1.0.3

- Previous published release.
