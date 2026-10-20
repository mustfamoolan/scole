import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { getCurrentTenantSubdomain } from '../../lib/tenant';
import { applyTenantTheme } from '../../lib/theme';
import { PortalLoginScreen } from './PortalLoginScreen';
import { HomeworkChatStream } from './HomeworkChatStream';
import { SchoolBannerSlider } from './SchoolBannerSlider';
import { StudentSchoolHomework } from '../../types';
import {
  BookOpen,
  Users,
  LogOut,
  ChevronRight,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Send,
  Search,
  CheckCheck,
  Megaphone,
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

interface FormattedAssignment {
  id: string;
  subject_name: string;
  course_name: string;
  grade_name: string;
  section_name: string;
}

interface TeacherSessionData {
  teacher: {
    id: string;
    person_id: string;
    full_name: string;
    first_name: string;
    last_name: string;
    phone: string;
    specialization?: string | null;
    access_code: string;
  };
  assignments: FormattedAssignment[];
  tenant: TenantInfo;
}

interface StudentRosterItem {
  id: string;
  name: string;
  code: string;
  grade: string;
  section: string;
  homeworksCount: number;
  unseenCount: number;
}

export const TeacherMobileApp: React.FC = () => {
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
  const [session, setSession] = useState<TeacherSessionData | null>(() => {
    try {
      const saved = localStorage.getItem('aylia_teacher_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Login Form States
  const [accessCode, setAccessCode] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 3 Primary Tabs: 'homework' | 'chat' | 'broadcast'
  const [activeTab, setActiveTab] = useState<'homework' | 'chat' | 'broadcast'>('homework');

  // Currently Selected Student for Fullscreen Homework Chat Stream
  const [selectedStudentForChat, setSelectedStudentForChat] = useState<StudentRosterItem | null>(null);

  // Currently Selected Direct Chat (for Tab 2)
  const [selectedDirectChat, setSelectedDirectChat] = useState<{ id: string; participantName: string; relation: string } | null>(null);

  // Search & Filter in Student Homework List
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'submitted' | 'unsubmitted'>('all');

  // Real or Sample School Homeworks Feed
  const [schoolHomeworks, setSchoolHomeworks] = useState<StudentSchoolHomework[]>([]);

  // Slug selector fallback if opened on main domain
  const [instituteSlugInput, setInstituteSlugInput] = useState<string>('');

  // Broadcast Notification Form State (Tab 3)
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastTarget, setBroadcastTarget] = useState<string>('all');
  const [broadcastSent, setBroadcastSent] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Real students roster state from server
  const [realStudents, setRealStudents] = useState<StudentRosterItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Fetch real students belonging to this teacher/tenant
  const fetchStudents = async () => {
    if (!session?.teacher?.id) return;
    setLoadingStudents(true);
    try {
      const endpoint = detectedSlug
        ? `/api/v1/portal/teacher/students?slug=${encodeURIComponent(detectedSlug)}&teacher_id=${session.teacher.id}`
        : `/api/v1/portal/teacher/students?teacher_id=${session.teacher.id}`;
      const res = await apiRequest<{ success: boolean; data: StudentRosterItem[] }>(endpoint, {
        headers: detectedSlug ? { 'X-Tenant-Slug': detectedSlug } : undefined,
      });
      if (res?.data && Array.isArray(res.data)) {
        setRealStudents(res.data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoadingStudents(false);
    }
  };

  // Full Roster of Students (Derived from real students + live homework counts)
  const allStudentsRoster: StudentRosterItem[] = useMemo(() => {
    if (realStudents.length > 0) {
      return realStudents.map((stu) => {
        const studentHws = schoolHomeworks.filter(
          (h) => h.student_profile_id === stu.id || h.student_profile?.full_name?.includes(stu.name)
        );
        const unseen = studentHws.filter((h) => !h.is_seen).length;
        return {
          ...stu,
          homeworksCount: Math.max(stu.homeworksCount || 0, studentHws.length),
          unseenCount: Math.max(stu.unseenCount || 0, unseen),
        };
      });
    }

    // Dynamic map from homeworks if students list hasn't loaded yet
    const studentMap = new Map<string, StudentRosterItem>();
    schoolHomeworks.forEach((h) => {
      const sId = h.student_profile_id;
      const sName = h.student_profile?.full_name || 'طالب';
      const sCode = h.student_profile?.student_number || 'STU';
      const sGrade = h.study_grade?.name || 'صف عام';
      const sSec = h.class_section?.name || 'شعبة عامة';
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          id: sId,
          name: sName,
          code: sCode,
          grade: sGrade,
          section: sSec,
          homeworksCount: 0,
          unseenCount: 0,
        });
      }
      const entry = studentMap.get(sId)!;
      entry.homeworksCount++;
      if (!h.is_seen) entry.unseenCount++;
    });

    return Array.from(studentMap.values());
  }, [realStudents, schoolHomeworks]);

  // Filtered Students Roster
  const filteredStudents = useMemo(() => {
    return allStudentsRoster.filter((stu) => {
      const matchesSearch =
        stu.name.includes(studentSearchQuery.trim()) || stu.code.includes(studentSearchQuery.trim());
      if (!matchesSearch) return false;

      if (studentFilter === 'submitted') return stu.homeworksCount > 0;
      if (studentFilter === 'unsubmitted') return stu.homeworksCount === 0;
      return true;
    });
  }, [allStudentsRoster, studentSearchQuery, studentFilter]);

  // Real Direct Teacher-to-Parent/Student Chat List from Roster
  const teacherDirectChats = useMemo(() => {
    return allStudentsRoster.map((stu) => {
      const studentHws = schoolHomeworks.filter(
        (h) => h.student_profile_id === stu.id || h.student_profile?.full_name?.includes(stu.name)
      );
      const latestHw = studentHws[0];
      let lastMsg = 'لا توجد محادثات سابقة';
      let timeStr = 'اليوم';
      if (latestHw) {
        lastMsg = latestHw.teacher_comment
          ? `ردك: ${latestHw.teacher_comment}`
          : latestHw.title || 'رفع واجباً دراسياً';
        timeStr = new Date(latestHw.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      }
      return {
        id: stu.id,
        participantName: stu.name,
        relation: `طالب - ${stu.grade} (${stu.section})`,
        lastMessage: lastMsg,
        time: timeStr,
        unread: stu.unseenCount,
        student: stu,
      };
    });
  }, [allStudentsRoster, schoolHomeworks]);

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
          document.title = `${res.data.name} | تطبيق المدرس`;
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

  // Fetch School Homeworks Feed
  const fetchHomeworks = async () => {
    if (!session?.teacher?.id) return;
    try {
      const endpoint = detectedSlug
        ? `/api/v1/portal/school-homeworks?slug=${encodeURIComponent(detectedSlug)}&teacher_id=${session.teacher.id}`
        : `/api/v1/portal/school-homeworks?teacher_id=${session.teacher.id}`;
      const res = await apiRequest<{ success: boolean; data: StudentSchoolHomework[] }>(endpoint, {
        headers: detectedSlug ? { 'X-Tenant-Slug': detectedSlug } : undefined,
      });
      if (res?.data && Array.isArray(res.data)) {
        setSchoolHomeworks(res.data);
      } else {
        setSchoolHomeworks([]);
      }
    } catch {
      setSchoolHomeworks([]);
    }
  };

  useEffect(() => {
    if (session) {
      fetchHomeworks();
      fetchStudents();
    }
  }, [session, detectedSlug]);

  // Handle Login by Access Code
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = accessCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('يرجى إدخال كود المدرس المسجل');
      return;
    }

    setLoginLoading(true);
    setErrorMsg(null);

    try {
      const endpoint = detectedSlug
        ? `/api/v1/tenant/auth/teacher-login?slug=${encodeURIComponent(detectedSlug)}`
        : '/api/v1/auth/teacher-login';
      const res = await apiRequest<{ success: boolean; data: TeacherSessionData }>(endpoint, {
        method: 'POST',
        headers: detectedSlug ? { 'X-Tenant-Slug': detectedSlug } : undefined,
        body: JSON.stringify({ access_code: cleanCode, slug: detectedSlug || undefined }),
      });

      if (res?.success && res.data) {
        setSession(res.data);
        localStorage.setItem('aylia_teacher_session', JSON.stringify(res.data));
        if (res.data.tenant?.primary_color) {
          applyTenantTheme(res.data.tenant.primary_color);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'كود المدرس غير صحيح أو غير مسجل في هذا المعهد');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aylia_teacher_session');
    setSession(null);
    setAccessCode('');
    setActiveTab('homework');
    setSelectedStudentForChat(null);
    setSelectedDirectChat(null);
  };

  // Handle Broadcast Submission (Design Mockup)
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setBroadcastSent(true);
    showToast('تم إرسال الإشعار لجميع أولياء الأمور والطلاب بنجاح ✓');
    setTimeout(() => {
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastSent(false);
    }, 2000);
  };

  // View 0: Fallback if no Tenant
  if (!loadingTenant && !tenantInfo && !session) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/60 rounded-3xl p-6 shadow-2xl backdrop-blur-xs text-center">
          <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">تطبيق المدرس</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            يرجى إدخال اسم أو معرف المعهد للدخول إلى حسابك التدريسي
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
        type="teacher"
        tenant={tenantInfo}
        accessCode={accessCode}
        setAccessCode={setAccessCode}
        onSubmit={handleLogin}
        loading={loginLoading}
        error={errorMsg}
        onSwitchPortal={() =>
          navigate('/student' + (tenantInfo?.slug ? `?slug=${tenantInfo.slug}` : ''))
        }
      />
    );
  }

  // View 2: Teacher Main App Shell
  const { teacher } = session;

  // ══════════════════════════════════════════════════════════════════════════
  // FULLSCREEN CHAT MODE: Hides App Header & Hides Bottom Nav Bar completely!
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedStudentForChat) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-950 max-w-md mx-auto overflow-hidden" dir="rtl">
        <HomeworkChatStream
          studentId={selectedStudentForChat.id}
          studentName={selectedStudentForChat.name}
          studentGradeSection={`${selectedStudentForChat.grade} • شعبة ${selectedStudentForChat.section}`}
          tenantSlug={tenantInfo?.slug}
          viewerRole="teacher"
          teacherId={teacher.id}
          teacherName={teacher.full_name}
          onBack={() => setSelectedStudentForChat(null)}
          initialHomeworks={schoolHomeworks.filter(
            (h) =>
              h.student_profile_id === selectedStudentForChat.id ||
              h.student_profile?.full_name?.includes(selectedStudentForChat.name)
          )}
          onHomeworksUpdated={(updated) => {
            setSchoolHomeworks((prev) => {
              const others = prev.filter(
                (h) =>
                  h.student_profile_id !== selectedStudentForChat.id &&
                  !h.student_profile?.full_name?.includes(selectedStudentForChat.name)
              );
              return [...others, ...updated];
            });
          }}
        />
      </div>
    );
  }

  // Fullscreen Direct Chat Mode for Selected Teacher-Parent/Student Chat
  if (selectedDirectChat) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-950 max-w-md mx-auto overflow-hidden" dir="rtl">
        <HomeworkChatStream
          studentId={selectedDirectChat.id}
          studentName={selectedDirectChat.participantName}
          studentGradeSection={selectedDirectChat.relation}
          tenantSlug={tenantInfo?.slug}
          viewerRole="teacher"
          teacherId={teacher.id}
          teacherName={teacher.full_name}
          onBack={() => setSelectedDirectChat(null)}
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
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {teacher.specialization ? `أستاذ ${teacher.specialization}` : 'المدرس المحترم'}
                </span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {teacher.full_name}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-16 left-4 right-4 max-w-sm mx-auto z-50 p-3 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-white/10 text-center animate-in fade-in slide-in-from-top-2">
            {toastMessage}
          </div>
        )}

        {/* Main Body */}
        <main className="flex-1 p-4 space-y-4">
          
          {/* ══════════════════════════════════════════════════════════
              TAB 1: الواجبات (Homeworks & Students Stream - Core Teacher Hub)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'homework' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Dynamic Photo Slider Banner */}
              <SchoolBannerSlider tenantSlug={tenantInfo?.slug} />

              <div className="space-y-3.5">
                {/* Top Header Card */}
                <div className="rounded-3xl p-4 bg-gradient-to-br from-primary via-primary/95 to-primary/85 text-white shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
                      متابعة دفاتر وواجبات الطلاب
                    </span>
                    <span className="text-[11px] font-bold font-mono">
                      {allStudentsRoster.length} طلاب
                    </span>
                  </div>
                  <h3 className="font-bold text-base">
                    قائمة طلابي وسجل الواجبات
                  </h3>
                  <p className="text-xs text-white/90 leading-relaxed">
                    انقر على أي طالب لفتح محادثة واجباته مباشرة كشات كامل، وتدقيق الصور والرد عليه.
                  </p>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="ابحث عن طالب بالاسم أو الكود..."
                    className="w-full h-10 pr-10 pl-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-primary/40 shadow-2xs"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setStudentFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer ${
                      studentFilter === 'all'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    جميع الطلاب ({allStudentsRoster.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentFilter('submitted')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer ${
                      studentFilter === 'submitted'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    أرسلوا الواجب ({allStudentsRoster.filter((s) => s.homeworksCount > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentFilter('unsubmitted')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer ${
                      studentFilter === 'unsubmitted'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    لم يرسلوا بعد ({allStudentsRoster.filter((s) => s.homeworksCount === 0).length})
                  </button>
                </div>

                {/* Student Cards List */}
                {loadingStudents ? (
                  <div className="py-10 text-center text-xs text-slate-500 font-medium">
                    جاري تحميل قائمة الطلاب...
                  </div>
                ) : (
                <div className="space-y-2.5">
                  {filteredStudents.map((stu) => {
                    const hasHomeworks = stu.homeworksCount > 0;
                    const hasUnseen = stu.unseenCount > 0;

                    return (
                      <div
                        key={stu.id}
                        onClick={() => setSelectedStudentForChat(stu)}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between hover:border-primary/50 transition cursor-pointer active:scale-98"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                            {stu.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                {stu.name}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {stu.code}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {stu.grade} • شعبة {stu.section}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {hasHomeworks ? (
                            hasUnseen ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                <span>{stu.unseenCount} جديد</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                                <CheckCheck className="w-3 h-3 text-emerald-500" />
                                <span>تم التدقيق</span>
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                              لم يرسل بعد
                            </span>
                          )}

                          <ChevronRight className="w-4 h-4 text-slate-400 rotate-180" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}

              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 2: المحادثات المباشرة (Direct Chat Mockup for Teacher)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'chat' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-primary">المحادثات المباشرة مع أولياء الأمور</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    تواصل مباشر وسريع بخصوص مستوى الطلاب (جاهزة للتفعيل لاحقاً)
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                  قريباً
                </span>
              </div>

              {/* Chat list items */}
              <div className="space-y-2">
                {teacherDirectChats.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedDirectChat(c)}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-2xs hover:border-primary/40 transition cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {c.participantName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {c.participantName}
                          </h4>
                          <span className="text-[10px] text-slate-400">({c.relation})</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] mt-0.5">
                          {c.lastMessage}
                        </p>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono block mb-1">
                        {c.time}
                      </span>
                      {c.unread > 0 && (
                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 3: إرسال إشعار (Broadcast Notification Mockup for Teacher)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'broadcast' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      إرسال إشعار أو تنبيه للشعب
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      يصل التنبيه فوراً لأجهزة الطلاب وأولياء الأمور
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSendBroadcast} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      الجهة المستلمة:
                    </label>
                    <select
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="all">جميع طلابي وشعبي</option>
                      <option value="sec-a">شعبة أ - الثالث المتوسط</option>
                      <option value="sec-b">شعبة ب - الثالث المتوسط</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      عنوان الإشعار:
                    </label>
                    <input
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="مثال: واجب منزلي لمادة الرياضيات..."
                      className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-hidden focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      نص الرسالة أو التنبيه:
                    </label>
                    <textarea
                      rows={4}
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder="اكتب التوجيهات أو الملاحظات التي تود إعلام الطلاب بها..."
                      className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-hidden focus:ring-1 focus:ring-primary resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={broadcastSent}
                    className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>إرسال الإشعار الآن</span>
                  </button>
                </form>
              </div>
            </div>
          )}

        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-around z-40">
          <button
            type="button"
            onClick={() => {
              setActiveTab('homework');
              setSelectedStudentForChat(null);
            }}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === 'homework'
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[11px]">الواجبات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === 'chat'
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[11px]">المحادثات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === 'broadcast'
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Megaphone className="w-5 h-5" />
            <span className="text-[11px]">إرسال إشعار</span>
          </button>
        </nav>

      </div>
    </div>
  );
};
