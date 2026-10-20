import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorAlert } from '../components/common';
import { AppAPIError } from '../api/client';
import { Shield, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export const PlatformLoginPage: React.FC = () => {
  const { loginPlatform } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError({ message: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loginPlatform(email, password);
      navigate('/platform');
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'تعذر إتمام تسجيل الدخول كمسؤول للمنصة' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#f1f5f9] text-slate-800 flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8 relative font-['Cairo',sans-serif] selection:bg-blue-600 selection:text-white">
      {/* Ambient Geometric & Educational Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft glowing ambient orbs */}
        <div className="absolute -top-32 -left-20 w-[450px] h-[450px] bg-blue-200/40 rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 -right-20 w-[550px] h-[550px] bg-indigo-100/50 rounded-full blur-[120px]" />
        
        {/* Engineering & Math Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(37,99,235,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />

        {/* Subtle Geometric Wireframes */}
        <svg
          className="absolute -top-10 right-20 w-80 h-80 text-blue-900/[0.04] transform rotate-12 hidden sm:block"
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polygon points="50 5, 90 25, 90 75, 50 95, 10 75, 10 25" />
          <circle cx="50" cy="50" r="18" />
        </svg>

        {/* Mobile Top Paper-Cut Wave Background (Matches Mobile Frame in Reference Image) */}
        <div className="block md:hidden absolute top-0 inset-x-0 h-44 pointer-events-none overflow-hidden">
          <svg
            className="w-full h-full text-blue-700/15"
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,0 L400,0 L400,60 C320,110 240,40 160,80 C80,120 40,70 0,90 Z" />
          </svg>
          <svg
            className="w-full h-full text-blue-600/10 -mt-28"
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,0 L400,0 L400,45 C300,90 220,30 140,65 C60,100 30,50 0,70 Z" />
          </svg>
        </div>
      </div>

      {/* Main Login Card - Paper Cut Design */}
      <div className="relative w-full max-w-[360px] sm:max-w-[420px] md:max-w-[940px] md:h-[570px] bg-white rounded-[28px] sm:rounded-[36px] md:rounded-[44px] shadow-[0_20px_50px_-10px_rgba(15,23,42,0.16)] border border-white/90 overflow-hidden z-10 flex flex-col md:flex-row">
        
        {/* Form Section */}
        <div className="w-full md:w-[52%] p-5 sm:p-7 md:p-12 flex flex-col justify-between bg-white relative z-30">
          <div>
            {/* Top Bar: Return to Home & Platform Badge */}
            <div className="flex items-center justify-between mb-4 md:mb-7">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="font-extrabold text-blue-900 text-[11px] sm:text-xs tracking-tight">إدارة المنظومة</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-[11px] sm:text-xs text-slate-400 hover:text-blue-600 transition flex items-center gap-1 font-semibold group"
              >
                <span>الرئيسية</span>
                <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Typography */}
            <div className="text-center md:text-start mb-4 md:mb-7">
              <h1 className="text-2xl sm:text-3xl md:text-[34px] font-black text-slate-900 tracking-tight mb-1 md:mb-1.5">
                Log in
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                تسجيل الدخول المركزي لمسؤول المنصة
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-3 sm:mb-4">
                <ErrorAlert
                  message={error.message}
                  requestId={error.requestId}
                  onDismiss={() => setError(null)}
                />
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1 px-3 text-start">
                  Login, email or phone number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@platform.com"
                    required
                    className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-full bg-slate-50/80 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1 px-3 text-start">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-4 sm:pl-5 pr-11 py-2.5 sm:py-3 rounded-full bg-slate-50/80 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none"
                    aria-label="Toggle password"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-1.5 sm:pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3.5 px-6 rounded-full text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md sm:shadow-lg shadow-blue-600/30 transition duration-150 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري التحقق...
                    </span>
                  ) : (
                    <span>Log in</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Artwork Section: Only on Tablet & Desktop (Hidden on Mobile to Prevent Any Vertical Scroll) */}
        <div className="hidden md:block w-full md:w-[48%] relative min-h-full overflow-hidden bg-[#0a1836]">
          {/* Base Background: Deep Royal & Navy Blue gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#0a1128]" />

          {/* Academic Isometric Grid Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#3b82f610_1px,transparent_1px),linear-gradient(to_bottom,#3b82f610_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

          {/* Academic Study Tools & Geometric Artwork */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Top Graduation Cap (Mortarboard) with Tassel */}
            <svg
              className="absolute -top-4 right-10 w-64 h-64 text-blue-400/35 transform rotate-6 drop-shadow-[0_12px_20px_rgba(0,0,0,0.35)]"
              viewBox="0 0 120 120"
              fill="none"
              stroke="currentColor"
            >
              <polygon points="60,18 112,42 60,66 8,42" fill="currentColor" fillOpacity="0.25" strokeWidth="2.5" />
              <path d="M28,52 L28,78 C28,95 92,95 92,78 L92,52" fill="currentColor" fillOpacity="0.2" strokeWidth="2.5" />
              <circle cx="60" cy="42" r="3" fill="currentColor" />
              <path d="M60,42 Q42,50 38,70 L34,92" strokeWidth="2" strokeLinecap="round" />
              <polygon points="31,90 41,90 38,102 34,102" fill="currentColor" />
            </svg>

            {/* Stacked Academic Books with 3D Depth */}
            <svg
              className="absolute bottom-8 right-8 w-72 h-72 text-blue-300/30 transform -rotate-6 drop-shadow-2xl"
              viewBox="0 0 140 140"
              fill="none"
              stroke="currentColor"
            >
              <path d="M20,105 L115,85 L125,98 L30,118 Z" fill="currentColor" fillOpacity="0.25" strokeWidth="2" />
              <path d="M20,105 C15,107 15,115 20,117 L115,97" strokeWidth="2" />
              <path d="M25,86 L118,68 L126,80 L33,98 Z" fill="currentColor" fillOpacity="0.3" strokeWidth="2" />
              <path d="M25,86 C20,88 20,96 25,98 L118,80" strokeWidth="2" />
              <path d="M30,55 Q55,62 75,52 Q95,62 120,55 L120,70 Q95,77 75,67 Q55,77 30,70 Z" fill="currentColor" fillOpacity="0.35" strokeWidth="2.2" />
              <line x1="75" y1="52" x2="75" y2="67" strokeWidth="2.5" />
            </svg>

            {/* Drafting Geometry Compass & Ruler */}
            <svg
              className="absolute top-28 -right-4 w-64 h-64 text-blue-400/25 transform rotate-45 drop-shadow-xl"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="50" cy="20" r="6" strokeWidth="2.5" fill="currentColor" fillOpacity="0.3" />
              <line x1="50" y1="26" x2="25" y2="90" strokeWidth="3" strokeLinecap="round" />
              <line x1="50" y1="26" x2="75" y2="90" strokeWidth="3" strokeLinecap="round" />
              <path d="M34,68 Q50,75 66,68" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="30" y1="78" x2="35" y2="76" strokeWidth="2" />
              <line x1="32" y1="72" x2="37" y2="70" strokeWidth="2" />
              <line x1="34" y1="66" x2="39" y2="64" strokeWidth="2" />
            </svg>

            {/* Floating Science, Math & Tech Symbols */}
            <g className="text-blue-300/35 font-mono text-[22px] font-bold select-none">
              <text x="210" y="80" fill="currentColor">∑</text>
              <text x="175" y="145" fill="currentColor">π</text>
              <text x="220" y="210" fill="currentColor">∞</text>
              <text x="180" y="275" fill="currentColor">∫dx</text>
              <text x="240" y="320" fill="currentColor">∆</text>
            </g>

            {/* 3D Geometric Cube */}
            <svg
              className="absolute top-44 right-32 w-28 h-28 text-blue-400/25 transform -rotate-12"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="50,15 85,35 50,55 15,35" fill="currentColor" fillOpacity="0.25" />
              <polygon points="15,35 50,55 50,95 15,75" fill="currentColor" fillOpacity="0.15" />
              <polygon points="85,35 50,55 50,95 85,75" fill="currentColor" fillOpacity="0.35" />
            </svg>
          </div>

          {/* THE PAPER-CUT WAVE SEAM */}
          <div className="absolute inset-y-0 left-0 w-32 sm:w-44 h-full pointer-events-none">
            {/* Layer 4: Deep Royal Blue Paper Layer */}
            <svg
              className="absolute inset-y-0 left-0 h-full w-full drop-shadow-[10px_0_12px_rgba(10,17,40,0.55)]"
              viewBox="0 0 100 500"
              preserveAspectRatio="none"
            >
              <path
                d="M0,0 L70,0 C45,110 95,165 45,260 C5,350 85,410 55,500 L0,500 Z"
                fill="#1d4ed8"
              />
            </svg>

            {/* Layer 3: Vibrant Royal Blue Paper Layer */}
            <svg
              className="absolute inset-y-0 left-0 h-full w-[90%] drop-shadow-[8px_0_10px_rgba(10,17,40,0.4)]"
              viewBox="0 0 100 500"
              preserveAspectRatio="none"
            >
              <path
                d="M0,0 L60,0 C38,110 85,165 38,260 C0,350 75,410 45,500 L0,500 Z"
                fill="#3b82f6"
              />
            </svg>

            {/* Layer 2: Ice / Soft Sky Blue Paper Layer */}
            <svg
              className="absolute inset-y-0 left-0 h-full w-[78%] drop-shadow-[6px_0_8px_rgba(10,17,40,0.25)]"
              viewBox="0 0 100 500"
              preserveAspectRatio="none"
            >
              <path
                d="M0,0 L50,0 C30,110 75,165 30,260 C-5,350 65,410 35,500 L0,500 Z"
                fill="#dbeafe"
              />
            </svg>

            {/* Layer 1: Pure White Paper Cutout Layer */}
            <svg
              className="absolute inset-y-0 left-0 h-full w-[65%] drop-shadow-[5px_0_8px_rgba(10,17,40,0.18)]"
              viewBox="0 0 100 500"
              preserveAspectRatio="none"
            >
              <path
                d="M0,0 L40,0 C22,110 65,165 22,260 C-10,350 55,410 25,500 L0,500 Z"
                fill="#ffffff"
              />
            </svg>
          </div>

          {/* Bottom Branding Tag */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2 text-white/70 bg-blue-950/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-[11px] font-semibold">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>FiStudy Cloud Core</span>
          </div>
        </div>

      </div>

      {/* Developer Signature Credit Under Card */}
      <div className="flex relative z-20 mt-4 text-center text-xs font-bold text-slate-500 items-center justify-center gap-2">
        <span>تطوير مهندس مصطفى</span>
        <span className="text-slate-300">•</span>
        <a
          href="tel:07737777424"
          dir="ltr"
          className="text-blue-600 hover:text-blue-800 font-extrabold transition"
        >
          07737777424
        </a>
      </div>
    </div>
  );
};
