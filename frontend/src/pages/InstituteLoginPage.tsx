import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorAlert, LoadingSpinner } from '../components/common';
import { apiRequest, AppAPIError } from '../api/client';
import { getCurrentTenantSubdomain, buildTenantUrl } from '../lib/tenant';
import { applyTenantTheme } from '../lib/theme';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Globe,
  Copy,
  Check,
  Building2,
  HelpCircle,
} from 'lucide-react';

interface CurrentTenantData {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  primary_color?: string | null;
  status: string;
}

export const InstituteLoginPage: React.FC = () => {
  const { slug: routeSlug } = useParams<{ slug?: string }>();
  const detectedSubdomain = routeSlug || getCurrentTenantSubdomain();
  const { loginTenant } = useAuth();

  const [tenantInfo, setTenantInfo] = useState<CurrentTenantData | null>(null);
  const [loadingTenant, setLoadingTenant] = useState<boolean>(!!detectedSubdomain);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  // Slug selector state for direct /login without slug
  const [inputSlug, setInputSlug] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!detectedSubdomain) {
      document.title = 'بوابة المعاهد | تسجيل الدخول';
      setLoadingTenant(false);
      return;
    }

    let isMounted = true;
    const fetchTenant = async () => {
      try {
        const res = await apiRequest<{ success: boolean; data: CurrentTenantData }>('/api/v1/tenant/current');
        if (isMounted && res?.data) {
          setTenantInfo(res.data);
          document.title = `${res.data.name} | تسجيل الدخول`;
          if (res.data.primary_color) {
            applyTenantTheme(res.data.primary_color);
          }
        }
      } catch {
        if (isMounted) {
          const fallbackData = {
            id: detectedSubdomain,
            name: `معهد ${detectedSubdomain}`,
            slug: detectedSubdomain,
            status: 'active',
          };
          setTenantInfo(fallbackData);
          document.title = `${fallbackData.name} | تسجيل الدخول`;
        }
      } finally {
        if (isMounted) {
          setLoadingTenant(false);
        }
      }
    };

    fetchTenant();
    return () => {
      isMounted = false;
    };
  }, [detectedSubdomain]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError({ message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
      return;
    }

    setLoginLoading(true);
    setError(null);

    try {
      await loginTenant(email, password);
      const search = window.location.search;
      const targetDashboard = search ? `/tenant${search}` : '/tenant';
      window.location.href = targetDashboard;
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'تعذر تسجيل الدخول، تأكد من صحة البيانات المسجلة لمعهدك' });
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSlugLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = inputSlug.trim().toLowerCase();
    if (!cleanSlug) return;
    window.location.href = buildTenantUrl(cleanSlug, '/login');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loadingTenant) {
    return <LoadingSpinner message="جاري التحقق من هوية المعهد..." />;
  }

  // Fallback: When visited without a specific institute slug (Direct /login)
  // Fully isolated: Does NOT expose or list other institutes on the platform
  if (!detectedSubdomain) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col justify-center items-center p-4 relative overflow-hidden font-['Cairo',sans-serif]">
        {/* Abstract decorative blobs in background */}
        <div className="absolute right-[-5%] top-[15%] w-[420px] h-[420px] bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[45%_55%_65%_35%/50%_60%_40%_50%] opacity-90 blur-sm pointer-events-none" />
        <div className="absolute right-[10%] top-[30%] w-[380px] h-[380px] bg-cyan-300 rounded-[55%_45%_35%_65%/60%_50%_50%_40%] opacity-80 pointer-events-none" />

        <div className="w-full max-w-[420px] bg-white rounded-[32px] p-8 sm:p-10 shadow-[0_25px_60px_-15px_rgba(30,58,138,0.12)] border border-slate-100 relative z-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 flex items-center justify-center text-blue-600 shadow-xs">
            <Building2 className="w-7 h-7 text-blue-600" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-2">بوابة دخول المعهد</h1>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            لكل مؤسسة أو معهد بوابة دخول خاصة ومستقلة تماماً. يرجى إدخال اسم أو معرّف معهدك للانتقال إلى بوابتك الرسمية.
          </p>

          <form onSubmit={handleSlugLookup} className="space-y-4 text-right mb-6">
            <div className="relative border-b-2 border-slate-200 focus-within:border-blue-600 transition pb-1">
              <input
                type="text"
                dir="ltr"
                value={inputSlug}
                onChange={(e) => setInputSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="معرّف المعهد (مثال: alnoor)"
                className="w-full px-2 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent font-medium"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              <span>انتقال إلى صفحة المعهد</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2 text-xs text-slate-500">
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-bold transition">
              تسجيل معهد أو مدرسة جديدة في المنصة
            </Link>
            <Link to="/" className="text-slate-400 hover:text-slate-600 transition">
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const primaryBtnColor = tenantInfo?.primary_color || '#2563eb';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col justify-center items-center py-10 px-4 sm:px-6 relative overflow-hidden font-['Cairo',sans-serif] selection:bg-blue-500 selection:text-white">
      {/* 
        Decorative organic shapes matching the requested design:
        - Royal Blue fluid blob
        - Mint/Cyan fluid blob
        - Delicate gold/amber line contour
      */}
      <div className="absolute top-1/2 left-1/2 -translate-y-[45%] translate-x-[-15%] sm:translate-x-[5%] w-[340px] sm:w-[480px] h-[360px] sm:h-[500px] pointer-events-none select-none z-0">
        {/* Cyan/Mint organic blob */}
        <div
          className="absolute -top-10 -right-12 sm:-right-20 w-[260px] sm:w-[380px] h-[260px] sm:h-[380px] rounded-[60%_40%_55%_45%/50%_60%_40%_50%] opacity-85 transition-all duration-700"
          style={{ backgroundColor: '#6ee7b7' }}
        />
        {/* Royal Blue organic blob */}
        <div
          className="absolute top-12 -right-4 sm:-right-8 w-[240px] sm:w-[340px] h-[240px] sm:h-[340px] rounded-[45%_55%_65%_35%/55%_45%_55%_45%] opacity-95 shadow-xl transition-all duration-700"
          style={{ backgroundColor: primaryBtnColor }}
        />
        {/* Subtle decorative curved gold contour line */}
        <svg
          className="absolute -bottom-6 right-2 sm:right-6 w-[200px] sm:w-[280px] h-[160px] sm:h-[220px] pointer-events-none opacity-80"
          viewBox="0 0 280 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20 180 C 80 220, 220 200, 260 120 C 300 40, 200 10, 150 40 C 90 80, 50 140, 120 170"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Main Centered Login Card */}
      <div className="w-full max-w-[390px] sm:max-w-[420px] bg-white rounded-[32px] p-8 sm:p-11 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.12)] border border-slate-100/80 relative z-10 transition-all duration-200">
        {/* Top Circle Ring Emblem */}
        <div className="flex justify-center mb-3">
          {tenantInfo?.logo_url ? (
            <img
              src={tenantInfo.logo_url}
              alt={tenantInfo.name}
              className="w-14 h-14 rounded-2xl object-cover shadow-sm ring-4 ring-slate-100"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-md"
              style={{ backgroundColor: primaryBtnColor }}
            >
              {tenantInfo?.name ? tenantInfo.name.charAt(0) : detectedSubdomain?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight" dir="rtl">
            {tenantInfo?.name || `معهد ${detectedSubdomain}`}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            بوابة تسجيل الدخول الرسمية
          </p>
          <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400 font-medium">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[11px] font-mono border border-slate-200/60" dir="ltr">
              <Globe className="w-3 h-3 text-slate-400" />
              {detectedSubdomain}
              <button
                type="button"
                onClick={handleCopyLink}
                title="نسخ الرابط"
                className="text-slate-400 hover:text-slate-700 transition"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-5">
            <ErrorAlert
              message={error.message}
              requestId={error.requestId}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        {/* Minimal Underline Input Form */}
        <form onSubmit={handleLogin} className="space-y-6" dir="ltr">
          {/* Email Field with Underline */}
          <div
            className="relative border-b-2 transition-colors pb-1.5"
            style={{ borderColor: primaryBtnColor }}
          >
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 flex-shrink-0" style={{ color: primaryBtnColor }} />
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@institute.com"
                className="w-full text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent font-medium"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Password Field with Underline */}
          <div className="relative border-b border-slate-200 focus-within:border-slate-400 transition-colors pb-1.5">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-slate-300 flex-shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600 transition p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loginLoading}
            style={{ backgroundColor: primaryBtnColor }}
            className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white hover:opacity-95 active:scale-[0.99] transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {loginLoading ? (
              <span>جاري تسجيل الدخول...</span>
            ) : (
              <span>تسجيل الدخول</span>
            )}
          </button>

          {/* Forgot password */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => alert('لإعادة تعيين كلمة المرور، يرجى التواصل مع إدارة المعهد')}
              className="text-xs text-slate-400 hover:text-slate-600 transition font-medium"
            >
              نسيت كلمة المرور؟
            </button>
          </div>
        </form>

        {/* Portals Access for Students, Guardians and Teachers */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 gap-2" dir="rtl">
          <Link
            to={detectedSubdomain ? `/student?slug=${detectedSubdomain}` : '/student'}
            className="py-2 px-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-center text-[11px] font-bold text-slate-700 transition flex items-center justify-center shadow-sm"
          >
            <span>بوابة الطالب</span>
          </Link>
          <Link
            to={detectedSubdomain ? `/guardian?slug=${detectedSubdomain}` : '/guardian'}
            className="py-2 px-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-center text-[11px] font-bold text-slate-700 transition flex items-center justify-center shadow-sm"
          >
            <span>ولي الأمر</span>
          </Link>
          <Link
            to={detectedSubdomain ? `/teacher?slug=${detectedSubdomain}` : '/teacher'}
            className="py-2 px-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200/80 text-center text-[11px] font-bold text-purple-700 transition flex items-center justify-center shadow-sm"
          >
            <span>بوابة المدرس</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
