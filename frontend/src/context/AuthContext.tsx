import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Tenant } from '../types';
import { apiRequest, setAuthToken, getAuthToken } from '../api/client';
import { applyTenantTheme } from '../lib/theme';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  loading: boolean;
  loginPlatform: (email: string, password: string) => Promise<void>;
  loginTenant: (email: string, password: string) => Promise<void>;
  updateTenant: (updates: Partial<Tenant>) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('auth_user');
      return null;
    }
  });
  const [tenant, setTenant] = useState<Tenant | null>(() => {
    try {
      const saved = localStorage.getItem('auth_tenant');
      const parsed = saved ? (JSON.parse(saved) as Tenant) : null;
      if (parsed?.primary_color) {
        applyTenantTheme(parsed.primary_color);
      }
      return parsed;
    } catch {
      localStorage.removeItem('auth_tenant');
      return null;
    }
  });
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (tenant?.primary_color) {
      applyTenantTheme(tenant.primary_color);
    }
  }, [tenant?.primary_color]);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }

      // إذا كان المستخدم المحفوظ platform_admin لا نتحقق عبر tenant endpoint
      const savedUser = (() => {
        try {
          const s = localStorage.getItem('auth_user');
          return s ? (JSON.parse(s) as User) : null;
        } catch {
          return null;
        }
      })();

      if (savedUser?.role === 'platform_admin') {
        // لا نُرسل طلب tenant/auth/me لأن المنصة لا تحتاج tenant context
        applyTenantTheme(null);
        setLoading(false);
        return;
      }

      try {
        // التحقق من جلسة مستخدم المعهد
        const res = await apiRequest<{ success: boolean; user: User; tenant?: Tenant }>('/api/v1/tenant/auth/me');
        if (res && res.user) {
          setUser(res.user);
          localStorage.setItem('auth_user', JSON.stringify(res.user));
          if (res.tenant) {
            setTenant(res.tenant);
            localStorage.setItem('auth_tenant', JSON.stringify(res.tenant));
            if (res.tenant.primary_color) {
              applyTenantTheme(res.tenant.primary_color);
            }
          }
        }
      } catch {
        // التوكن منتهي أو غير صالح — نتجاهل ونترك المستخدم المحفوظ
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const updateTenant = (updates: Partial<Tenant>) => {
    setTenant((prev) => {
      const updated = prev ? { ...prev, ...updates } : (updates as Tenant);
      localStorage.setItem('auth_tenant', JSON.stringify(updated));
      if (updates.primary_color) {
        applyTenantTheme(updates.primary_color);
      }
      return updated;
    });
  };

  const loginPlatform = async (email: string, password: string) => {
    const res = await apiRequest<{ success: boolean; token: string; user: User }>('/api/v1/platform/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    setTenant(null);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    localStorage.removeItem('auth_tenant');
    applyTenantTheme(null);
  };

  const loginTenant = async (email: string, password: string) => {
    const res = await apiRequest<{ success: boolean; token: string; user: User }>('/api/v1/tenant/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    localStorage.setItem('auth_user', JSON.stringify(res.user));

    // Try fetching tenant info
    try {
      const meRes = await apiRequest<{ success: boolean; user: User; tenant?: Tenant }>('/api/v1/tenant/auth/me');
      if (meRes.tenant) {
        setTenant(meRes.tenant);
        localStorage.setItem('auth_tenant', JSON.stringify(meRes.tenant));
        if (meRes.tenant.primary_color) {
          applyTenantTheme(meRes.tenant.primary_color);
        }
      }
    } catch {
      // Continue even if me info isn't immediately loaded
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/v1/tenant/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
      setTenant(null);
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_tenant');
      applyTenantTheme(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, tenant, token, loading, loginPlatform, loginTenant, updateTenant, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
