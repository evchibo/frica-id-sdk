import {
  FricaConfig,
  TokenResponse,
  FricaUser,
  AuthorizeOptions,
  TokenStorage,
  AuthResult
} from './types.js';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateRandomString
} from './pkce.js';
import { getDefaultStorage } from './storage.js';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'frica_access_token',
  REFRESH_TOKEN: 'frica_refresh_token',
  ID_TOKEN: 'frica_id_token',
  EXPIRES_AT: 'frica_token_expires_at',
  USER_PROFILE: 'frica_user_profile',
  PKCE_VERIFIER: 'frica_pkce_verifier',
  OAUTH_STATE: 'frica_oauth_state'
};

export class FricaClient {
  public readonly clientId: string;
  public readonly redirectUri: string;
  public readonly issuerUrl: string;
  public readonly portalUrl: string;
  public readonly defaultScope: string;
  private readonly storage: TokenStorage;

  constructor(config: FricaConfig) {
    if (!config.clientId) {
      throw new Error('FricaClient: clientId is required');
    }
    if (!config.redirectUri) {
      throw new Error('FricaClient: redirectUri is required');
    }

    this.clientId = config.clientId;
    this.redirectUri = config.redirectUri;
    this.issuerUrl = (config.issuerUrl || 'https://api.frica.id').replace(/\/+$/, '');
    this.portalUrl = (config.portalUrl || 'https://frica.id').replace(/\/+$/, '');
    this.defaultScope = config.defaultScope || 'openid profile email';
    this.storage = config.storage || getDefaultStorage();
  }

  /**
   * Generates the OAuth 2.1 PKCE authorization URL and stores verifier in storage.
   */
  async getAuthorizationUrl(options: AuthorizeOptions = {}): Promise<{
    url: string;
    state: string;
    codeVerifier: string;
  }> {
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = options.state || generateRandomString(24);
    const scope = options.scope || this.defaultScope;
    const nonce = options.nonce || generateRandomString(24);

    // Persist PKCE verifier and state for verification on return
    await this.storage.setItem(STORAGE_KEYS.PKCE_VERIFIER, codeVerifier);
    await this.storage.setItem(STORAGE_KEYS.OAUTH_STATE, state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce
    });

    if (options.prompt) {
      params.set('prompt', options.prompt);
    }

    // Direct user to authorization endpoint
    const url = `${this.issuerUrl}/oauth/authorize?${params.toString()}`;
    return { url, state, codeVerifier };
  }

  /**
   * Initiates standard browser redirect to Frica ID sign-in portal.
   */
  async signInWithRedirect(options: AuthorizeOptions = {}): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('signInWithRedirect can only be used in a browser environment');
    }
    const { url } = await this.getAuthorizationUrl(options);
    window.location.assign(url);
  }

  /**
   * Initiates sign-in in a popup window.
   */
  async signInWithPopup(options: AuthorizeOptions = {}): Promise<AuthResult> {
    if (typeof window === 'undefined') {
      throw new Error('signInWithPopup can only be used in a browser environment');
    }

    const { url, state } = await this.getAuthorizationUrl(options);
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      'frica_id_login',
      `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes`
    );

    if (!popup) {
      throw new Error('Popup blocked by browser. Please allow popups or use signInWithRedirect().');
    }

    return new Promise<AuthResult>((resolve, reject) => {
      const pollTimer = window.setInterval(async () => {
        try {
          if (!popup || popup.closed) {
            window.clearInterval(pollTimer);
            reject(new Error('User closed the login popup window'));
            return;
          }

          const popupUrl = popup.location.href;
          if (popupUrl && popupUrl.startsWith(this.redirectUri)) {
            window.clearInterval(pollTimer);
            popup.close();

            const result = await this.handleRedirectCallback(popupUrl);
            resolve(result);
          }
        } catch {
          // Cross-origin access error while on frica.id domain - expected until redirect to redirectUri
        }
      }, 300);
    });
  }

  /**
   * Processes the incoming redirect callback from Frica ID.
   * Extracts authorization code, validates state, and exchanges code for tokens.
   */
  async handleRedirectCallback(callbackUrl?: string): Promise<AuthResult> {
    let urlString = callbackUrl;
    if (!urlString && typeof window !== 'undefined') {
      urlString = window.location.href;
    }
    if (!urlString) {
      throw new Error('Callback URL is required to process redirect');
    }

    const url = new URL(urlString);
    const error = url.searchParams.get('error');
    if (error) {
      const description = url.searchParams.get('error_description') || error;
      throw new Error(`Authentication error: ${description}`);
    }

    const code = url.searchParams.get('code');
    if (!code) {
      throw new Error('No authorization code found in callback URL');
    }

    const returnedState = url.searchParams.get('state');
    const storedState = await this.storage.getItem(STORAGE_KEYS.OAUTH_STATE);
    if (storedState && returnedState && storedState !== returnedState) {
      throw new Error('State parameter mismatch. Possible CSRF attack detected.');
    }

    const codeVerifier = await this.storage.getItem(STORAGE_KEYS.PKCE_VERIFIER);
    if (!codeVerifier) {
      throw new Error('PKCE code verifier not found in storage. Ensure login was initiated by this client.');
    }

    // Clean up temporary authorization state
    await this.storage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);
    await this.storage.removeItem(STORAGE_KEYS.OAUTH_STATE);

    // Exchange code for tokens
    const tokens = await this.exchangeCode(code, codeVerifier);

    // Retrieve user profile
    const user = await this.getUserInfo(tokens.accessToken);

    // Store profile
    await this.storage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));

    return { tokens, user, state: returnedState || undefined };
  }

  /**
   * Exchanges an authorization code for an OAuth 2.1 Access Token and ID Token.
   */
  async exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
    const res = await fetch(`${this.issuerUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.error_description || data?.error || data?.message || 'Token exchange failed';
      throw new Error(errorMsg);
    }

    const tokenResponse: TokenResponse = {
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in || 3600,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      scope: data.scope,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000
    };

    await this.storeTokens(tokenResponse);
    return tokenResponse;
  }

  /**
   * Refreshes the active access token using the stored refresh token.
   */
  async refreshToken(overrideRefreshToken?: string): Promise<TokenResponse> {
    const token = overrideRefreshToken || (await this.storage.getItem(STORAGE_KEYS.REFRESH_TOKEN));
    if (!token) {
      throw new Error('No refresh token available');
    }

    const res = await fetch(`${this.issuerUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        refresh_token: token
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      await this.clearStorage();
      const errorMsg = data?.error_description || data?.error || 'Token refresh failed';
      throw new Error(errorMsg);
    }

    const tokenResponse: TokenResponse = {
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in || 3600,
      refreshToken: data.refresh_token || token,
      idToken: data.id_token,
      scope: data.scope,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000
    };

    await this.storeTokens(tokenResponse);
    return tokenResponse;
  }

  /**
   * Fetches user profile information with the access token.
   */
  async getUserInfo(accessToken?: string): Promise<FricaUser> {
    let token = accessToken;
    if (!token) {
      token = (await this.getValidAccessToken()) || undefined;
    }
    if (!token) {
      throw new Error('No access token available to fetch user info');
    }

    const res = await fetch(`${this.issuerUrl}/oauth/userinfo`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || 'Failed to fetch user info');
    }

    const user: FricaUser = data.data ?? data;
    await this.storage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));
    return user;
  }

  /**
   * Revokes an active token.
   */
  async revokeToken(token?: string): Promise<void> {
    const targetToken = token || (await this.storage.getItem(STORAGE_KEYS.REFRESH_TOKEN)) || (await this.storage.getItem(STORAGE_KEYS.ACCESS_TOKEN));
    if (!targetToken) return;

    await fetch(`${this.issuerUrl}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: targetToken,
        client_id: this.clientId
      })
    }).catch(() => null);

    await this.clearStorage();
  }

  /**
   * Signs the user out and purges stored credentials.
   */
  async signOut(): Promise<void> {
    await this.revokeToken();
    await this.clearStorage();
  }

  /**
   * Checks if user has an active, valid session (auto-refreshes if expired).
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return token !== null;
  }

  /**
   * Retrieves the current authenticated user from storage.
   */
  async getUser(): Promise<FricaUser | null> {
    const raw = await this.storage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Returns a valid access token, auto-refreshing via refresh token if expired.
   */
  async getValidAccessToken(): Promise<string | null> {
    const token = await this.storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const expiresAtRaw = await this.storage.getItem(STORAGE_KEYS.EXPIRES_AT);
    if (!token) return null;

    const expiresAt = expiresAtRaw ? parseInt(expiresAtRaw, 10) : 0;
    // Buffer of 60 seconds before expiration
    if (expiresAt > 0 && Date.now() > expiresAt - 60000) {
      try {
        const refreshed = await this.refreshToken();
        return refreshed.accessToken;
      } catch {
        return null;
      }
    }

    return token;
  }

  /**
   * Returns all stored tokens.
   */
  async getTokens(): Promise<TokenResponse | null> {
    const accessToken = await this.storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!accessToken) return null;

    const refreshToken = (await this.storage.getItem(STORAGE_KEYS.REFRESH_TOKEN)) || undefined;
    const idToken = (await this.storage.getItem(STORAGE_KEYS.ID_TOKEN)) || undefined;
    const expiresAt = (await this.storage.getItem(STORAGE_KEYS.EXPIRES_AT)) || undefined;

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshToken,
      idToken,
      expiresAt: expiresAt ? parseInt(expiresAt, 10) : undefined
    };
  }

  private async storeTokens(tokens: TokenResponse): Promise<void> {
    await this.storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    if (tokens.refreshToken) {
      await this.storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    }
    if (tokens.idToken) {
      await this.storage.setItem(STORAGE_KEYS.ID_TOKEN, tokens.idToken);
    }
    if (tokens.expiresAt) {
      await this.storage.setItem(STORAGE_KEYS.EXPIRES_AT, tokens.expiresAt.toString());
    }
  }

  private async clearStorage(): Promise<void> {
    await this.storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    await this.storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    await this.storage.removeItem(STORAGE_KEYS.ID_TOKEN);
    await this.storage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    await this.storage.removeItem(STORAGE_KEYS.USER_PROFILE);
    await this.storage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);
    await this.storage.removeItem(STORAGE_KEYS.OAUTH_STATE);
  }
}

/**
 * Convenience factory to create a FricaClient instance.
 */
export function createFricaClient(config: FricaConfig): FricaClient {
  return new FricaClient(config);
}
