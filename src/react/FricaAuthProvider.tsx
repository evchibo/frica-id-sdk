import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { FricaClient } from '../client.js';
import { FricaUser, TokenResponse, AuthorizeOptions, AuthResult } from '../types.js';

export interface FricaAuthContextValue {
  client: FricaClient;
  user: FricaUser | null;
  tokens: TokenResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithRedirect: (options?: AuthorizeOptions) => Promise<void>;
  loginWithPopup: (options?: AuthorizeOptions) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<TokenResponse>;
}

const FricaAuthContext = createContext<FricaAuthContextValue | undefined>(undefined);

export interface FricaAuthProviderProps {
  client: FricaClient;
  children: ReactNode;
}

export function FricaAuthProvider({ client, children }: FricaAuthProviderProps) {
  const [user, setUser] = useState<FricaUser | null>(null);
  const [tokens, setTokens] = useState<TokenResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const authenticated = await client.isAuthenticated();
      if (authenticated) {
        const storedTokens = await client.getTokens();
        const storedUser = await client.getUser();
        setTokens(storedTokens);
        setUser(storedUser);
      } else {
        setTokens(null);
        setUser(null);
      }
    } catch {
      setTokens(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const loginWithRedirect = useCallback(
    async (options?: AuthorizeOptions) => {
      await client.signInWithRedirect(options);
    },
    [client]
  );

  const loginWithPopup = useCallback(
    async (options?: AuthorizeOptions) => {
      const result = await client.signInWithPopup(options);
      setTokens(result.tokens);
      setUser(result.user);
      return result;
    },
    [client]
  );

  const logout = useCallback(async () => {
    await client.signOut();
    setTokens(null);
    setUser(null);
  }, [client]);

  const refreshToken = useCallback(async () => {
    const refreshed = await client.refreshToken();
    setTokens(refreshed);
    return refreshed;
  }, [client]);

  const value: FricaAuthContextValue = {
    client,
    user,
    tokens,
    isAuthenticated: !!user && !!tokens,
    isLoading,
    loginWithRedirect,
    loginWithPopup,
    logout,
    refreshToken
  };

  return <FricaAuthContext.Provider value={value}>{children}</FricaAuthContext.Provider>;
}

/**
 * React hook to consume Frica ID Authentication state and methods.
 */
export function useFricaAuth(): FricaAuthContextValue {
  const context = useContext(FricaAuthContext);
  if (!context) {
    throw new Error('useFricaAuth must be used within a <FricaAuthProvider>');
  }
  return context;
}
