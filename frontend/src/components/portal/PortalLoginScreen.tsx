import React from 'react';
import {
  GraduationCap,
  Users,
  ShieldCheck,
  ChevronRight,
  Phone,
  MapPin,
  Mail,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Check,
  BookOpen,
} from 'lucide-react';
import { SchoolBannerSlider } from './SchoolBannerSlider';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  primary_color?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

interface PortalLoginScreenProps {
  type: 'student' | 'guardian' | 'teacher';
  tenant: TenantInfo | null;
  accessCode: string;
  setAccessCode: (code: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string | null;
  onSwitchPortal?: () => void;
}

export const PortalLoginScreen: React.FC<PortalLoginScreenProps> = ({
  type,
  tenant,
  accessCode,
  setAccessCode,
  onSubmit,
  loading,
  error,
}) => {
  const isStudent = type === 'student';
  const isTeacher = type === 'teacher';
  
  // Resolve primaryColor: 1. tenant.primary_color, 2. localStorage saved theme, 3. default
  const storedThemeColor = (() => {
    try {
      if (typeof window !== 'undefined') {
        const direct = localStorage.getItem('aylia_tenant_theme_color');
        if (direct) return direct;
        const authTenant = localStorage.getItem('auth_tenant');
        if (authTenant) {
          const parsed = JSON.parse(authTenant);
          if (parsed?.primary_color) return parsed.primary_color;
        }
      }
    } catch {}
    return null;
  })();

  const primaryColor =
    tenant?.primary_color ||
    storedThemeColor ||
    (isStudent ? '#2563eb' : isTeacher ? '#7c3aed' : '#059669');

  const portalTitle = isStudent
    ? 'تطبيق وبوابة الطالب'
    : isTeacher
    ? 'تطبيق وبوابة المدرس والمعلم'
    : 'تطبيق وبوابة ولي الأمر';
  const portalSubtitle = isStudent
    ? 'متابعة المحاضرات والجدول الدراسي والدرجات'
    : isTeacher
    ? 'متابعة الحصص الدراسية، الشعب، والجداول الأسبوعية'
    : 'متابعة الدوام اليومي والدرجات والأقساط';
  const codePlaceholder = isStudent ? 'STU-XXXXX' : isTeacher ? 'TCH-XXXXX' : 'GRD-XXXXX';
  const codeHelperText = isStudent
    ? 'أدخل الكود الممنوح لك من المعهد (يبدأ بـ STU)'
    : isTeacher
    ? 'أدخل كود المدرس الممنوح لك من الإدارة (يبدأ بـ TCH)'
    : 'أدخل كود المتابعة الخاص بك (يبدأ بـ GRD)';

  const otherPortalLabel = isStudent ? 'دخول ولي الأمر' : 'دخول الطالب';

  return (
    <div
      className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-0 sm:p-4 md:p-8 font-sans selection:bg-primary/20"
      dir="rtl"
    >
      {/* Container: on desktop split card like the design image; on mobile full-screen vertical */}
      <div className="w-full max-w-4xl min-h-screen sm:min-h-0 bg-white dark:bg-slate-900 sm:rounded-[36px] shadow-2xl border-0 sm:border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-row relative">

        {/* ========================================================
            COLUMN 1: THE BRAND HERO SECTION
            (Left in RTL / Right in LTR - with cloud edge)
           ======================================================== */}
        <div
          className="relative lg:w-5/12 flex-shrink-0 flex flex-col justify-between p-8 sm:p-10 text-white overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${primaryColor} 0%, ${primaryColor}dd 55%, ${primaryColor}bb 100%)`,
          }}
        >
          {/* Subtle decorative glowing background shapes */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-black/10 rounded-full blur-2xl pointer-events-none -ml-16 -mb-16" />

          {/* Top greeting badge */}
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-semibold tracking-wide border border-white/25">
              <Sparkles className="w-3.5 h-3.5" />
              <span>مرحباً بك في المنصة</span>
            </span>
          </div>

          {/* Center Brand Identity (Logo + Name + Tagline) */}
          <div className="relative z-10 py-8 lg:py-16 text-center flex flex-col items-center">
            {/* Circular badge with shadow: beautifully masked & rounded */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white shadow-2xl p-1.5 flex items-center justify-center mb-5 ring-4 ring-white/30 transition-transform duration-300 hover:scale-105 shrink-0 overflow-hidden">
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-white shadow-inner">
                {tenant?.logo_url ? (
                  <img
                    src={tenant.logo_url}
                    alt={tenant.name || 'شعار المعهد'}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {isStudent ? (
                      <GraduationCap className="w-12 h-12" />
                    ) : isTeacher ? (
                      <BookOpen className="w-12 h-12" />
                    ) : (
                      <Users className="w-12 h-12" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              {tenant?.name || 'المعهد التعليمي'}
            </h1>
            <p className="text-xs sm:text-sm text-white/90 font-medium mt-1.5 max-w-xs leading-relaxed">
              {portalTitle}
            </p>
            <p className="text-[11px] text-white/75 mt-1 max-w-xs leading-relaxed">
              {portalSubtitle}
            </p>
          </div>

          {/* Bottom institute note on large screen */}
          <div className="relative z-10 text-[11px] text-white/75 border-t border-white/20 pt-4 hidden lg:flex items-center justify-between">
            <span>النظام الأكاديمي الموحد</span>
            <span className="font-mono text-white/90">v2.5 Mobile</span>
          </div>

          {/* ----------------------------------------------------
              DESKTOP VERTICAL CLOUD DIVIDER (Between Col 1 & Col 2)
              Overlapping organic puffy curves
             ---------------------------------------------------- */}
          <div className="hidden lg:block absolute top-0 bottom-0 left-0 w-16 h-full pointer-events-none select-none z-20">
            <svg
              className="w-full h-full"
              viewBox="0 0 100 800"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Back Cloud Layer 1 */}
              <path
                d="M100,0 C70,60 50,110 80,160 C110,210 50,260 70,320 C90,380 40,430 75,500 C110,570 50,630 80,700 C110,770 70,800 100,800 L0,800 L0,0 Z"
                fill="white"
                fillOpacity="0.25"
              />
              {/* Mid Cloud Layer 2 */}
              <path
                d="M100,0 C60,40 30,120 65,180 C100,240 35,300 55,370 C75,440 25,510 60,580 C95,650 40,720 70,800 L0,800 L0,0 Z"
                fill="white"
                fillOpacity="0.5"
              />
              {/* Front Solid White Cloud Silhouette */}
              <path
                d="M100,0 C50,50 15,100 45,170 C75,240 10,310 35,390 C60,470 10,540 45,620 C80,700 20,760 50,800 L0,800 L0,0 Z"
                fill="white"
              />
            </svg>
          </div>

          {/* ----------------------------------------------------
              MOBILE HORIZONTAL CLOUD DIVIDER (At bottom of header)
             ---------------------------------------------------- */}
          <div className="block lg:hidden absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none z-20 pointer-events-none select-none">
            <svg
              className="w-full h-12 sm:h-16 block"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Layer 1 */}
              <path
                d="M0,40 C150,90 300,10 450,55 C600,100 750,20 900,65 C1050,110 1150,40 1200,60 L1200,120 L0,120 Z"
                fill="white"
                fillOpacity="0.3"
              />
              {/* Layer 2 */}
              <path
                d="M0,60 C120,10 260,95 400,45 C540,-5 680,85 820,35 C960,-15 1100,75 1200,45 L1200,120 L0,120 Z"
                fill="white"
                fillOpacity="0.6"
              />
              {/* Layer 3: Solid White Silhouette */}
              <path
                d="M0,80 C180,30 320,105 480,60 C640,15 780,95 940,55 C1100,15 1160,70 1200,65 L1200,120 L0,120 Z"
                fill="white"
              />
            </svg>
          </div>

        </div>

        {/* ========================================================
            COLUMN 2: THE FORM SECTION
            (Clean white background, minimal underline inputs)
           ======================================================== */}
        <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col justify-between p-6 sm:p-10 lg:p-14 z-10">
          
          <div>
            {/* Header & Title */}
            <div className="mb-8 text-center sm:text-right">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                تسجيل الدخول
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                أدخل كود المرور المخصص لك من إدارة المعهد للوصول لحسابك
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-xs text-red-700 dark:text-red-400 animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-6">
              
              {/* Underline Input (matching reference image) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isStudent ? 'كود الطالب' : isTeacher ? 'كود المدرس' : 'كود ولي الأمر'}
                </label>
                
                <div className="relative group">
                  <input
                    type="text"
                    dir="ltr"
                    placeholder={codePlaceholder}
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    className="w-full pb-3 pt-2 pl-10 pr-3 text-lg sm:text-xl font-mono font-bold tracking-widest text-slate-900 dark:text-white bg-transparent border-b-2 border-slate-200 dark:border-slate-700 focus:outline-none transition-colors duration-200 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    style={{
                      borderColor: accessCode ? primaryColor : undefined,
                    }}
                    autoFocus
                    required
                  />
                  {accessCode.length >= 6 && (
                    <div
                      className="absolute left-1 bottom-3 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-1.5">
                  {codeHelperText}
                </p>
              </div>

              {/* Action Button: Sign in */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 rounded-full font-bold text-white shadow-lg transition-all duration-200 hover:opacity-95 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  style={{
                    backgroundColor: primaryColor,
                    boxShadow: `0 10px 25px -5px ${primaryColor}40`,
                  }}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>تسجيل الدخول</span>
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Institute Contact Info Footer */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 text-slate-500 dark:text-slate-400 text-[11px]">
              {tenant?.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                  <span dir="ltr" className="font-mono">{tenant.phone}</span>
                </div>
              )}
              {tenant?.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                  <span>{tenant.address}</span>
                </div>
              )}
              {tenant?.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                  <span dir="ltr" className="font-mono">{tenant.email}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400">
              <span>{tenant?.name || 'المنصة التعليمية'} • بوابة الوصول السريع</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">تطوير • almoq3</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
