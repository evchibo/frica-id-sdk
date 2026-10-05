import React from 'react';
import { useFricaAuth } from './FricaAuthProvider.js';
import { AuthorizeOptions } from '../types.js';

export interface FricaSignInButtonProps {
  /**
   * Visual theme of the button.
   * - 'dark': Pure AMOLED black button with Frica Gold accent and white text (Default)
   * - 'light': Crisp white button with border and dark text
   * - 'gold': High-contrast Frica Gold button with pure black text
   */
  theme?: 'dark' | 'light' | 'gold';

  /**
   * Size variant.
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Mode of authentication interaction.
   * - 'redirect': Full-page navigation to frica.id (Default)
   * - 'popup': Centered popup window
   */
  mode?: 'redirect' | 'popup';

  /**
   * Optional custom button label text. Defaults to "Sign in with Frica ID".
   */
  text?: string;

  /**
   * Optional OAuth authorization parameters (e.g. custom scope, state).
   */
  options?: AuthorizeOptions;

  /**
   * Callback fired on successful popup login.
   */
  onSuccess?: (auth: any) => void;

  /**
   * Callback fired on error.
   */
  onError?: (error: Error) => void;

  /**
   * Additional custom CSS classes.
   */
  className?: string;

  /**
   * Inline CSS overrides.
   */
  style?: React.CSSProperties;

  disabled?: boolean;
}

/**
 * Official Frica ID Vector Icon.
 */
function FricaIdIcon({ size = 20, color = '#FFCC00' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="8" fill="#000000" />
      <path
        d="M9 7H23C23.5523 7 24 7.44772 24 8V11C24 11.5523 23.5523 12 23 12H14V14H21C21.5523 14 22 14.4477 22 15V18C22 18.5523 21.5523 19 21 19H14V25H9V7Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Official "Sign in with Frica ID" Branded Component.
 */
export function FricaSignInButton({
  theme = 'dark',
  size = 'md',
  mode = 'redirect',
  text = 'Sign in with Frica ID',
  options,
  onSuccess,
  onError,
  className = '',
  style = {},
  disabled = false
}: FricaSignInButtonProps) {
  const { loginWithRedirect, loginWithPopup, isLoading } = useFricaAuth();

  const handleClick = async () => {
    if (disabled || isLoading) return;
    try {
      if (mode === 'popup') {
        const result = await loginWithPopup(options);
        onSuccess?.(result);
      } else {
        await loginWithRedirect(options);
      }
    } catch (err: any) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Size styling
  const sizeStyles: Record<string, { padding: string; fontSize: string; iconSize: number; height: string }> = {
    sm: { padding: '0 12px', fontSize: '12px', iconSize: 16, height: '36px' },
    md: { padding: '0 18px', fontSize: '14px', iconSize: 20, height: '44px' },
    lg: { padding: '0 24px', fontSize: '15px', iconSize: 24, height: '52px' }
  };

  // Theme styling
  const themeStyles: Record<string, { bg: string; color: string; border: string; iconColor: string; hoverBg: string }> = {
    dark: {
      bg: '#000000',
      color: '#FFFFFF',
      border: '1px solid #282828',
      iconColor: '#FFCC00',
      hoverBg: '#111111'
    },
    light: {
      bg: '#FFFFFF',
      color: '#000000',
      border: '1px solid #E5E7EB',
      iconColor: '#D97706',
      hoverBg: '#F9FAFB'
    },
    gold: {
      bg: '#FFCC00',
      color: '#000000',
      border: '1px solid #E6B800',
      iconColor: '#000000',
      hoverBg: '#E6B800'
    }
  };

  const currentSize = sizeStyles[size] || sizeStyles.md;
  const currentTheme = themeStyles[theme] || themeStyles.dark;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    height: currentSize.height,
    padding: currentSize.padding,
    backgroundColor: currentTheme.bg,
    color: currentTheme.color,
    border: currentTheme.border,
    borderRadius: '12px',
    fontSize: currentSize.fontSize,
    fontWeight: 700,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: theme === 'gold' ? '0 2px 8px rgba(255, 204, 0, 0.25)' : '0 1px 3px rgba(0, 0, 0, 0.3)',
    userSelect: 'none',
    outline: 'none',
    ...style
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`frica-signin-btn ${className}`}
      style={baseStyle}
      aria-label="Sign in with Frica ID"
    >
      <FricaIdIcon size={currentSize.iconSize} color={currentTheme.iconColor} />
      <span>{text}</span>
    </button>
  );
}
