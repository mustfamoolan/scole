/**
 * Dynamic Brand Color Theming for Multi-Tenant Institutes.
 * Automatically translates hex color codes to Shadcn UI HSL CSS variables (--primary, --ring, --primary-foreground)
 * so that changing the institute's primary color immediately cascades through all UI components (buttons, badges, active tabs).
 */

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Converts a hex color string (e.g. #2563eb or #fff) to HSL values.
 */
export const hexToHsl = (hex: string): HSLColor => {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    // Default fallback to blue (221.2, 83.2%, 53.3%)
    return { h: 221.2, s: 83.2, l: 53.3 };
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360 * 10) / 10,
    s: Math.round(s * 100 * 10) / 10,
    l: Math.round(l * 100 * 10) / 10,
  };
};

/**
 * Computes whether black or white text should be used over the primary color.
 * Returns HSL string in Shadcn format (e.g. "0 0% 100%" or "222.2 84% 4.9%").
 */
export const getContrastForeground = (hex: string): string => {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return '210 40% 98%';
  }

  // Relative luminance formula (sRGB)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '222.2 84% 4.9%' : '210 40% 98%';
};

/**
 * Applies the tenant's brand color globally across the application
 * by updating CSS custom properties on document.documentElement.
 */
export const applyTenantTheme = (primaryColor?: string | null): void => {
  if (typeof document === 'undefined') return;

  if (!primaryColor) {
    // Reset to default platform blue
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--ring');
    document.documentElement.style.removeProperty('--primary-foreground');
    return;
  }

  try {
    const { h, s, l } = hexToHsl(primaryColor);
    const hslString = `${h} ${s}% ${l}%`;
    const foregroundHsl = getContrastForeground(primaryColor);

    document.documentElement.style.setProperty('--primary', hslString);
    document.documentElement.style.setProperty('--ring', hslString);
    document.documentElement.style.setProperty('--primary-foreground', foregroundHsl);
  } catch (e) {
    console.error('Failed to apply tenant theme color:', e);
  }
};
