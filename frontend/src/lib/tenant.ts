/**
 * Multi-tenant domain and host resolution utilities
 */

export function extractSubdomain(hostname: string): string | null {
  const host = hostname.toLowerCase().trim();
  // Strip port if present
  const cleanHost = host.split(':')[0];
  if (!cleanHost || cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '::1') {
    return null;
  }

  // Pure IP addresses are root platform, not subdomains
  if (/^\d+\.\d+\.\d+\.\d+$/.test(cleanHost)) {
    return null;
  }

  // Split hostname into parts
  const parts = cleanHost.split('.');

  // e.g., "alnoor.localhost" -> parts = ["alnoor", "localhost"]
  // e.g., "alnoor.academy.iq" -> parts = ["alnoor", "academy", "iq"]
  if (parts.length >= 2) {
    const sub = parts[0];
    // Ignore reserved / platform prefixes
    const reserved = ['www', 'api', 'admin', 'platform', 'app', 'cdn', 'static', 'mail'];
    if (reserved.includes(sub)) {
      return null;
    }
    return sub;
  }

  return null;
}

export function getCurrentTenantSubdomain(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check host subdomain (e.g., alnoor.localhost or alnoor.fistudy.iq)
  const sub = extractSubdomain(window.location.hostname);
  if (sub) return sub;

  // 2. Check query params (?slug=alnoor or ?tenant=alnoor or ?institute=alnoor)
  try {
    const params = new URLSearchParams(window.location.search);
    const querySlug = params.get('slug') || params.get('tenant') || params.get('institute');
    if (querySlug && querySlug.trim()) {
      return querySlug.trim().toLowerCase();
    }
  } catch {}

  // 3. Check path prefix (e.g., /i/alnoor or /institute/alnoor)
  try {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'i' || parts[0] === 'institute' || parts[0] === 'tenant')) {
      return parts[1].toLowerCase();
    }
  } catch {}

  return null;
}

export function buildTenantUrl(slug: string, path: string = '/login'): string {
  if (typeof window === 'undefined') return `${path}?slug=${slug}`;
  const port = window.location.port ? `:${window.location.port}` : '';
  const protocol = window.location.protocol;
  const host = window.location.hostname.toLowerCase();

  // If on localhost or pure IP where wildcard subdomains may fail in Windows DNS
  if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return `${protocol}//${host}${port}${path}?slug=${slug}`;
  }

  // If in local development with existing subdomain (e.g. mahd2.localhost)
  if (host.endsWith('.localhost')) {
    return `${protocol}//${slug}.localhost${port}${path}`;
  }

  // If in production with custom domain or base domain (e.g., academy.iq)
  const parts = host.split('.');
  if (parts.length >= 2) {
    const baseDomain = parts.slice(-2).join('.');
    return `${protocol}//${slug}.${baseDomain}${port}${path}`;
  }

  return `${protocol}//${slug}.${host}${port}${path}`;
}
