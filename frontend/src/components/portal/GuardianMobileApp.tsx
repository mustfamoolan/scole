import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { getCurrentTenantSubdomain } from '../../lib/tenant';
import { applyTenantTheme } from '../../lib/theme';
import { PortalLoginScreen } from './PortalLoginScreen';
import { HomeworkChatStream } from './HomeworkChatStream';
import { SchoolBannerSlider } from './SchoolBannerSlider';
import {
  Users,
  GraduationCap,
  Bell,
  LogOut,
  ChevronRight,
  BookOpen,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Megaphone,
  UserCheck,
} from 'lucide-react';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  primary_color?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

interface LinkedStudentAppDTO {
  id: string;
  student_number: string;
  full_name: string;
  photo_url?: string | null;
  grade_name: string;
  section_name: string;
  enrollment_status: string;
  relationship_type: string;
  is_primary: boolean;
  access_code: string;
}

interface GuardianSessionData {
  guardian: {
    id: string;
    person_id: string;
    full_name: string;
    first_name: string;
    last_name: string;
    phone: string;
    access_code: string;
  };
  students: LinkedStudentAppDTO[];
  tenant: TenantInfo;
}

export const GuardianMobileApp: React.FC = () => {
  const [searchParams] = useSearchParams();
  const routeParams = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  // Tenant detection
  const detectedSlug =
    routeParams.slug ||
    searchParams.get('slug') ||
    searchParams.get('tenant') ||
    getCurrentTenantSubdomain();
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [loadingTenant, setLoadingTenant] = useState<boolean>(true);

  // Authentication & Session
  const [session, setSession] = useState<GuardianSessionData | null>(() => {
    try {
      const saved = localStorage.getItem('aylia_guardian_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Selected Child Index (for multi-children guardians)
  const [selectedChildIndex, setSelectedChildIndex] = useState<number>(0);

  // Login Form States
  const [accessCode, setAccessCode] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 3 Primary Tabs: 'home' | 'homework' | 'chat'
  const [activeTab, setActiveTab] = useState<'home' | 'homework' | 'chat'>('home');

  // Currently selected direct teacher chat
  const [selectedTeacherChat, setSelectedTeacherChat] = useState<{ id: string; name: string; subject: string } | null>(null);

  // Slug selector fallback if opened on main domain
  const [instituteSlugInput, setInstituteSlugInput] = useState<string>('');

  // Sample Institute Announcements & Notifications
  const announcements = [
    {
      id: 'ann-1',
      title: 'إعلان هام: بدء امتحانات نصف السنة',
      content: 'نود إعلامكم بأن الامتحانات ستبدأ الأسبوع القادم، يرجى متابعة مراجعة الواجبات اليومية للأبناء.',
      badge: 'عام',
    },
  ];

  const notifications = [
    {
      id: 'notif-1',
      title: 'ملاحظة من أستاذ الرياضيات',
      desc: 'تم تدقيق واجب الرياضيات والحل ممتاز ومرتب.',
      time: 'منذ ساعتين',
    },
    {
      id: 'notif-2',
      title: 'تسجيل الحضور الصباحي',
      desc: 'حضر الطالب في الوقت المحدد لبدء الحصة الأولى.',
      time: '08:15 ص',
    },
  ];

  // Mock list of teachers for chat preview
  const sampleTeachers = [
    {
      id: 't-1',
      name: 'أ. حيدر الكعبي',
      subject: 'مدرس الرياضيات',
      lastMessage: 'أحسنت في حل تمارين الصفحة 45.',
      time: '10:30 ص',
      unread: 1,
    },
    {
      id: 't-2',
      name: 'ست مريم الموسوي',
      subject: 'مدرسة اللغة الإنجليزية',
      lastMessage: 'يرجى مراجعة كلمات الوحدة الثالثة.',
      time: 'أمس',
      unread: 0,
    },
    {
      id: 't-3',
      name: 'أ. علي التميمي',
      subject: 'مدرس الفيزياء',
      lastMessage: 'جاهز لأي استفسار بخصوص الدرس.',
      time: 'الخميس',
      unread: 0,
    },
  ];

  // 1. Fetch Tenant Context
  useEffect(() => {
    let isMounted = true;
    const loadTenant = async () => {
      setLoadingTenant(true);
      try {
        const endpoint = detectedSlug
          ? `/api/v1/tenant/current?slug=${encodeURIComponent(detectedSlug)}`
          : '/api/v1/tenant/current';
        const res = await apiRequest<{ success: boolean; data: TenantInfo }>(endpoint, {
          headers: detectedSlug ? { 'X-Tenant-Slug': detectedSlug } : undefined,
        });
        if (isMounted && res?.data) {
          setTenantInfo(res.data);
          document.title = `${res.data.name} | تطبيق ولي الأمر`;
          if (res.data.primary_color) {
            applyTenantTheme(res.data.primary_color);
            try {
              localStorage.setItem('aylia_tenant_theme_color', res.data.primary_color);
            } catch {}
          }
        }
      } catch {
        if (isMounted && detectedSlug) {
          const cachedColor = typeof window !== 'undefined' ? localStorage.getItem('aylia_tenant_theme_color') : null;
          const fallback: TenantInfo = {
            id: detectedSlug,
            name: `معهد ${detectedSlug}`,
            slug: detectedSlug,
            primary_color: cachedColor || '#2563eb',
          };
          setTenantInfo(fallback);
          if (fallback.primary_color) {
            applyTenantTheme(fallback.primary_color);
          }
        }
      } finally {
        if (isMounted) setLoadingTenant(false);
      }
    };

    loadTenant();
    return () => {
      isMounted = false;
    };
  }, [detectedSlug]);

  // Apply theme when session exists
  useEffect(() => {
    if (session?.tenant?.primary_color) {
      applyTenantTheme(session.tenant.primary_color);
    }
  }, [session]);

  // Handle Login by Access Code
  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = accessCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('يرجى إدخال كود ولي الأمر المسجل');
      return;
    }

    setLoginLoading(true);
    setErrorMsg(null);

    try {
      const endpoint = detectedSlug
        ? `/api/v1/tenant/auth/guardian-login?slug=${encodeURIComponent(detectedSlug)}`
        : '/api/v1/auth/guardian-login';
      const res = await apiRequest<{ success: boolean; data: GuardianSessionData }>(endpoint, {
        method: 'POST',
        headers: detectedSlug ? { 'X-Tenant-Slug': detectedSlug } : undefined,
        body: JSON.stringify({ access_code: cleanCode, slug: detectedSlug || undefined }),
      });

      if (res?.success && res.data) {
        setSession(res.data);
        localStorage.setItem('aylia_guardian_session', JSON.stringify(res.data));
        setSelectedChildIndex(0);
        if (res.data.tenant?.primary_color) {
          applyTenantTheme(res.data.tenant.primary_color);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'كود ولي الأمر غير صحيح أو غير مسجل في هذا المعهد');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aylia_guardian_session');
    setSession(null);
    setAccessCode('');
    setActiveTab('home');
    setSelectedTeacherChat(null);
  };

  // View 0: Fallback if no Tenant context
  if (!loadingTenant && !tenantInfo && !session) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/60 rounded-3xl p-6 shadow-2xl backdrop-blur-xs text-center">
          <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">تطبيق ولي الأمر</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            يرجى إدخال اسم أو معرف المعهد للدخول لمتابعة الأبناء
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (instituteSlugInput.trim()) {
                window.location.search = `?slug=${encodeURIComponent(instituteSlugInput.trim().toLowerCase())}`;
              }
            }}
            className="space-y-4"
          >
            <input
              type="text"
              placeholder="معرف المعهد (مثال: alnoor)"
              value={instituteSlugInput}
              onChange={(e) => setInstituteSlugInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-center text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-primary text-sm font-mono"
              dir="ltr"
              required
            />
            <button
              type="submit"
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl shadow-lg transition text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>متابعة إلى بوابة المعهد</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // View 1: Login Screen
  if (!session) {
    return (
      <PortalLoginScreen
        type="guardian"
        tenant={tenantInfo}
        accessCode={accessCode}
        setAccessCode={setAccessCode}
        onSubmit={handleCodeLogin}
        loading={loginLoading}
        error={errorMsg}
        onSwitchPortal={() =>
          navigate('/student' + (tenantInfo?.slug ? `?slug=${tenantInfo.slug}` : ''))
        }
      />
    );
  }

  // View 2: Guardian App Shell
  const guardian = session.guardian;
  const students = session.students || [];
  const currentChild: LinkedStudentAppDTO | undefined = students[selectedChildIndex] || students[0];

  // ══════════════════════════════════════════════════════════════════════════
  // FULLSCREEN HOMEWORK CHAT: Hides App Header & Bottom Nav Bar completely!
  // ══════════════════════════════════════════════════════════════════════════
  if (activeTab === 'homework' && currentChild) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-950 max-w-md mx-auto overflow-hidden" dir="rtl">
        <HomeworkChatStream
          studentId={currentChild.id}
          studentName={currentChild.full_name}
          studentGradeSection={`${currentChild.grade_name || ''} • شعبة ${currentChild.section_name || ''}`}
          tenantSlug={tenantInfo?.slug}
          viewerRole="guardian"
          onBack={() => setActiveTab('home')}
        />
      </div>
    );
  }

  // Fullscreen Direct Teacher Chat
  if (selectedTeacherChat) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-950 max-w-md mx-auto overflow-hidden" dir="rtl">
        <HomeworkChatStream
          studentId={selectedTeacherChat.id}
          studentName={selectedTeacherChat.name}
          studentGradeSection={selectedTeacherChat.subject}
          tenantSlug={tenantInfo?.slug}
          viewerRole="guardian"
          onBack={() => setSelectedTeacherChat(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-between" dir="rtl">
      <div className="w-full max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col relative pb-20 shadow-xl border-x border-slate-200 dark:border-slate-800">
        
        {/* Top App Bar */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">ولي الأمر المحترم</span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {guardian.full_name}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Child Switcher Pills (If parent has multiple children) */}
          {students.length > 1 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">اختر الابن:</span>
              {students.map((st, idx) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedChildIndex(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    selectedChildIndex === idx
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{st.full_name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 space-y-4">
          
          {/* ══════════════════════════════════════════════════════════
              TAB 1: الرئيسية (Home: Announcement Banner Slider + Notifs + Children List)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'home' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* 1. Dynamic Photo Slider Banner */}
              <SchoolBannerSlider tenantSlug={tenantInfo?.slug} />

              {/* 2. Institute & Teacher Notifications */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-primary" />
                    <span>إشعارات المعهد والمدرسين</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">الأحدث</span>
                </div>

                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                          {n.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Children List (قائمة الأبناء) */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span>أبنائي المسجلين ({students.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">انقر لرفع ومتابعة الواجب</span>
                </div>

                <div className="space-y-3">
                  {students.map((child, idx) => (
                    <div
                      key={child.id}
                      className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 transition hover:border-primary/40"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                            {child.photo_url ? (
                              <img src={child.photo_url} alt={child.full_name} className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                              child.full_name.charAt(0)
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {child.full_name}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {child.grade_name || 'طالب مسجل'} • شعبة {child.section_name || 'أ'}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md font-bold">
                          {child.student_number}
                        </span>
                      </div>

                      {/* Quick Homework Chat Button for this child */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChildIndex(idx);
                          setActiveTab('homework');
                        }}
                        className="w-full py-2.5 px-3 rounded-2xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold flex items-center justify-between transition cursor-pointer active:scale-98"
                      >
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4" />
                          <span>واجبات اليوم (محادثة الواجبات والحل)</span>
                        </span>
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 3: المحادثات مع المدرسين (WhatsApp Chat Mockup Design)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'chat' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-primary">المحادثات المباشرة مع المدرسين</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    ميزة التواصل الكتابي والصوتي المباشر (جاهزة للتفعيل لاحقاً)
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                  قريباً
                </span>
              </div>

              {/* Chat list items */}
              <div className="space-y-2">
                {sampleTeachers.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTeacherChat(t)}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs hover:border-primary/40 transition cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {t.name.charAt(2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {t.name}
                          </h4>
                          <span className="text-[10px] text-slate-400">({t.subject})</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] mt-0.5">
                          {t.lastMessage}
                        </p>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono block mb-1">
                        {t.time}
                      </span>
                      {t.unread > 0 && (
                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {t.unread}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-around z-40">
          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              setSelectedTeacherChat(null);
            }}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === 'home'
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[11px]">الرئيسية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('homework')}
            className="flex flex-col items-center gap-1 transition cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[11px]">الواجبات</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('chat');
              setSelectedTeacherChat(null);
            }}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === 'chat'
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[11px]">المحادثات</span>
          </button>
        </nav>

      </div>
    </div>
  );
};
