import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest, AppAPIError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Tenant, Subscription, PaymentReceipt, Domain, StudentProfile, TeacherProfile, StaffProfile, TeacherPayoutAccrual } from '../types';
import { ErrorAlert, LoadingSpinner, EmptyState } from '../components/common';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { TeachersManagement } from '../components/teachers/TeachersManagement';
import { AcademicStructureManagement } from '../components/academic/AcademicStructureManagement';
import { CurriculaManagement } from '../components/academic/CurriculaManagement';
import { IraqiCurriculumInitModal } from '../components/academic/IraqiCurriculumInitModal';
import { StudentsManagement } from '../components/students/StudentsManagement';
import { GuardiansManagement } from '../components/guardians/GuardiansManagement';
import { HomeworksManagement } from '../components/academic/HomeworksManagement';
import { BannersManagement } from '../components/academic/BannersManagement';

// Shadcn UI Components
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';

// Lucide Icons
import {
  School,
  CreditCard,
  Receipt,
  Globe,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Users,
  GraduationCap,
  Building2,
  ShieldCheck,
  BookOpen,
  BookMarked,
  FileText,
  Layers,
  CalendarCheck,
  DollarSign,
  UserPlus,
  Palette,
  Edit3,
  Briefcase,
  UserCheck,
  HeartHandshake,
  Settings,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  Check,
  Smartphone,
} from 'lucide-react';

import { optimizeImageFile } from '../lib/image';
import { applyTenantTheme } from '../lib/theme';

export type TenantTab =
  | 'overview'
  | 'students'
  | 'guardians'
  | 'homeworks'
  | 'banners'
  | 'stages'
  | 'curricula'
  | 'academic'
  | 'workforce'
  | 'finance'
  | 'settings';

export const TenantDashboard: React.FC = () => {
  const { tenant: contextTenant, updateTenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TenantTab =
    tabParam === 'students' ||
    tabParam === 'guardians' ||
    tabParam === 'homeworks' ||
    tabParam === 'banners' ||
    tabParam === 'stages' ||
    tabParam === 'curricula' ||
    tabParam === 'academic' ||
    tabParam === 'workforce' ||
    tabParam === 'finance' ||
    tabParam === 'settings'
      ? (tabParam as TenantTab)
      : 'overview';

  const setActiveTab = (newTab: TenantTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newTab === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', newTab);
      }
      next.delete('teacherId');
      return next;
    });
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  const [profile, setProfile] = useState<Tenant | null>(contextTenant);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);

  // HR & Workforce State
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [payoutAccruals, setPayoutAccruals] = useState<TeacherPayoutAccrual[]>([]);
  const [payoutProcessingId, setPayoutProcessingId] = useState<string | null>(null);

  // Branding & Profile customizer modal state
  const [showEditBranding, setShowEditBranding] = useState(false);
  const [brandingForm, setBrandingForm] = useState({
    name: '',
    logo_url: '',
    primary_color: '#2563eb',
    phone: '',
    address: '',
  });
  const [brandingSubmitting, setBrandingSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [optimizingLogo, setOptimizingLogo] = useState(false);
  const [optimizationStats, setOptimizationStats] = useState<{ originalKB: number; optimizedKB: number; savedPercent: number } | null>(null);

  // Domain request modal state
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);

  // Iraqi educational structure generator modal state (in Settings)
  const [showInitIraqiModal, setShowInitIraqiModal] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [copiedPortal, setCopiedPortal] = useState<'student' | 'guardian' | 'teacher' | null>(null);

  // Student admission modal state
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    fatherName: '',
    lastName: '',
    gender: 'male',
    studentNumber: '',
    phone: '',
    medicalNotes: '',
  });
  const [studentSubmitting, setStudentSubmitting] = useState(false);

  const openEditBranding = () => {
    const active = profile || contextTenant;
    if (active) {
      setBrandingForm({
        name: active.name || '',
        logo_url: active.logo_url || '',
        primary_color: active.primary_color || '#2563eb',
        phone: active.phone || '',
        address: active.address || '',
      });
    }
    setLogoFile(null);
    setOptimizationStats(null);
    setShowEditBranding(true);
  };

  const handleColorChange = (newColor: string) => {
    setBrandingForm((prev) => ({ ...prev, primary_color: newColor }));
    applyTenantTheme(newColor);
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOptimizingLogo(true);
    try {
      const result = await optimizeImageFile(file, 512, 512, 0.88);
      setLogoFile(result.file);
      // Instant preview with optimized data URL
      setBrandingForm((prev) => ({ ...prev, logo_url: result.dataUrl }));
      const origKB = Math.round(result.originalSize / 1024);
      const optKB = Math.round(result.optimizedSize / 1024);
      const saved = Math.max(0, Math.round(((result.originalSize - result.optimizedSize) / result.originalSize) * 100));
      setOptimizationStats({
        originalKB: origKB,
        optimizedKB: optKB,
        savedPercent: saved,
      });
    } catch (err) {
      console.error('Image optimization failed', err);
    } finally {
      setOptimizingLogo(false);
    }
  };

  const handleUpdateBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingSubmitting(true);
    setError(null);
    try {
      let finalLogoUrl = brandingForm.logo_url.trim();

      // If a new local image file was optimized, try uploading it to the server
      if (logoFile) {
        try {
          const formData = new FormData();
          formData.append('logo', logoFile);
          const uploadRes = await apiRequest<{ success: boolean; logo_url: string; tenant?: Tenant }>(
            '/api/v1/tenant/admin/profile/upload-logo',
            {
              method: 'POST',
              body: formData,
            }
          );
          if (uploadRes?.logo_url) {
            finalLogoUrl = uploadRes.logo_url;
          }
        } catch {
          // Fallback: save the optimized compressed Data URL directly
          finalLogoUrl = brandingForm.logo_url.trim();
        }
      }

      const res = await apiRequest<{ success: boolean; tenant: Tenant }>('/api/v1/tenant/admin/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: brandingForm.name.trim(),
          logo_url: finalLogoUrl ? finalLogoUrl : null,
          primary_color: brandingForm.primary_color.trim(),
          phone: brandingForm.phone.trim() ? brandingForm.phone.trim() : null,
          address: brandingForm.address.trim() ? brandingForm.address.trim() : null,
        }),
      });

      if (res?.tenant) {
        setProfile(res.tenant);
        updateTenant(res.tenant);
      }
      setShowEditBranding(false);
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل حفظ وتحديث هوية المعهد' });
      }
    } finally {
      setBrandingSubmitting(false);
    }
  };

  const fetchTenantData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, subRes, receiptsRes, domainsRes, studentsRes, teachersRes, staffRes, payoutsRes] = await Promise.allSettled([
        apiRequest<{ success: boolean; tenant: Tenant }>('/api/v1/tenant/admin/profile'),
        apiRequest<{ success: boolean; subscription: Subscription }>('/api/v1/tenant/admin/billing/subscription'),
        apiRequest<{ success: boolean; data: PaymentReceipt[] }>('/api/v1/tenant/admin/billing/receipts'),
        apiRequest<{ success: boolean; data: Domain[] }>('/api/v1/tenant/admin/domains'),
        apiRequest<{ success: boolean; data: StudentProfile[] }>('/api/v1/tenant/admin/students'),
        apiRequest<{ success: boolean; data: TeacherProfile[] }>('/api/v1/tenant/admin/hr/teachers'),
        apiRequest<{ success: boolean; data: StaffProfile[] }>('/api/v1/tenant/admin/hr/staff'),
        apiRequest<{ success: boolean; data: TeacherPayoutAccrual[] }>('/api/v1/tenant/admin/hr/payouts/accruals'),
      ]);

      if (profRes.status === 'fulfilled' && profRes.value.tenant) {
        setProfile(profRes.value.tenant);
      }
      if (subRes.status === 'fulfilled' && subRes.value.subscription) {
        setSubscription(subRes.value.subscription);
      }
      if (receiptsRes.status === 'fulfilled' && receiptsRes.value.data) {
        setReceipts(receiptsRes.value.data);
      }
      if (domainsRes.status === 'fulfilled' && domainsRes.value.data) {
        setDomains(domainsRes.value.data);
      }
      if (studentsRes.status === 'fulfilled' && studentsRes.value.data) {
        setStudents(studentsRes.value.data);
      }
      if (teachersRes.status === 'fulfilled' && teachersRes.value.data) {
        setTeachers(teachersRes.value.data);
      }
      if (staffRes.status === 'fulfilled' && staffRes.value.data) {
        setStaffList(staffRes.value.data);
      }
      if (payoutsRes.status === 'fulfilled' && payoutsRes.value.data) {
        setPayoutAccruals(payoutsRes.value.data);
      }
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, []);

  const handleRequestDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;

    setDomainLoading(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/domains', {
        method: 'POST',
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      setDomainInput('');
      setShowAddDomain(false);
      await fetchTenantData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setDomainLoading(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setError(null);
    try {
      await apiRequest(`/api/v1/tenant/admin/domains/${domainId}/verify`, {
        method: 'POST',
      });
      await fetchTenantData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.firstName || !studentForm.lastName || !studentForm.studentNumber) return;

    setStudentSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          first_name: studentForm.firstName.trim(),
          father_name: studentForm.fatherName.trim() || undefined,
          last_name: studentForm.lastName.trim(),
          gender: studentForm.gender,
          student_number: studentForm.studentNumber.trim(),
          phone: studentForm.phone.trim() || undefined,
          medical_notes: studentForm.medicalNotes.trim() || undefined,
        }),
      });

      setShowAddStudent(false);
      setStudentForm({
        firstName: '',
        fatherName: '',
        lastName: '',
        gender: 'male',
        studentNumber: '',
        phone: '',
        medicalNotes: '',
      });
      await fetchTenantData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setStudentSubmitting(false);
    }
  };

  const handleApprovePayout = async (accrualId: string) => {
    setPayoutProcessingId(accrualId);
    setError(null);
    try {
      await apiRequest(`/api/v1/tenant/admin/hr/payouts/accruals/${accrualId}/approve`, {
        method: 'POST',
      });
      await fetchTenantData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setPayoutProcessingId(null);
    }
  };

  const handleDisbursePayout = async (accrualId: string) => {
    setPayoutProcessingId(accrualId);
    setError(null);
    try {
      await apiRequest(`/api/v1/tenant/admin/hr/payouts/accruals/${accrualId}/disburse`, {
        method: 'POST',
        body: JSON.stringify({ payment_method: 'cash' }),
      });
      await fetchTenantData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setPayoutProcessingId(null);
    }
  };

  const navItems = [
    {
      id: 'overview',
      label: 'الرئيسية',
      icon: School,
      active: activeTab === 'overview',
      onClick: () => setActiveTab('overview'),
    },
    {
      id: 'students',
      label: 'الطلاب',
      icon: Users,
      count: students.length,
      active: activeTab === 'students',
      onClick: () => setActiveTab('students'),
    },
    {
      id: 'guardians',
      label: 'أولياء الأمور',
      icon: HeartHandshake,
      active: activeTab === 'guardians',
      onClick: () => setActiveTab('guardians'),
    },
    {
      id: 'homeworks',
      label: 'الواجبات والتحضير',
      icon: FileText,
      active: activeTab === 'homeworks',
      onClick: () => setActiveTab('homeworks'),
    },
    {
      id: 'banners',
      label: 'سلايدر الإعلانات',
      icon: ImageIcon,
      active: activeTab === 'banners',
      onClick: () => setActiveTab('banners'),
    },
    {
      id: 'stages',
      label: 'المراحل والصفوف',
      icon: Layers,
      active: activeTab === 'stages' || activeTab === 'academic',
      onClick: () => setActiveTab('stages'),
    },
    {
      id: 'curricula',
      label: 'المناهج والمقررات',
      icon: BookMarked,
      active: activeTab === 'curricula',
      onClick: () => setActiveTab('curricula'),
    },
    {
      id: 'workforce',
      label: 'كادر التدريسي',
      icon: GraduationCap,
      count: teachers.length,
      active: activeTab === 'workforce',
      onClick: () => setActiveTab('workforce'),
    },
    {
      id: 'finance',
      label: 'الحسابات',
      icon: DollarSign,
      active: activeTab === 'finance',
      onClick: () => setActiveTab('finance'),
    },
    {
      id: 'settings',
      label: 'الاعدادات',
      icon: Settings,
      active: activeTab === 'settings',
      onClick: () => setActiveTab('settings'),
    },
  ];

  const teacherIdParam = searchParams.get('teacherId');
  const currentBreadcrumb =
    activeTab === 'overview'
      ? 'الرئيسية'
      : activeTab === 'students'
      ? 'سجلات وشؤون الطلاب'
      : activeTab === 'guardians'
      ? 'إدارة أولياء الأمور'
      : activeTab === 'homeworks'
      ? 'الواجبات والتحضير اليومي'
      : activeTab === 'banners'
      ? 'سلايدر إعلانات وفعاليات المعهد'
      : (activeTab === 'stages' || activeTab === 'academic')
      ? 'المراحل والصفوف'
      : activeTab === 'curricula'
      ? 'المناهج والمقررات'
      : activeTab === 'workforce'
      ? teacherIdParam
        ? 'كادر التدريسي / الملف المهني'
        : 'كادر التدريسي'
      : activeTab === 'finance'
      ? 'الحسابات'
      : 'الاعدادات';

  return (
    <DashboardLayout
      brandTitle={profile?.name || contextTenant?.name || 'لوحة تحكم المعهد'}
      brandSubtitle={profile?.slug || contextTenant?.slug ? `${profile?.slug || contextTenant?.slug}.fistudy.iq` : 'إدارة المعهد'}
      brandIcon={School}
      roleBadgeText="مدير المعهد"
      navItems={navItems}
      currentBreadcrumb={currentBreadcrumb}
    >
      {error && (
        <ErrorAlert
          message={error.message}
          requestId={error.requestId}
          onDismiss={() => setError(null)}
        />
      )}

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-muted-foreground hover:text-foreground text-xs font-normal"
          >
            إغلاق
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="جاري استرجاع بيانات المعهد..." />
      ) : (
        <div className="space-y-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && profile && (
            <div className="space-y-6">
              {/* Trial Status Banner */}
              {subscription?.status === 'trialing' && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-right">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-amber-600">
                          حساب معهدك في الفترة التجريبية (Trialing)
                        </h3>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] font-bold">
                          14 يوماً تجريبية
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        طلب اشتراك معهدك قيد المراجعة والتفعيل الرسمي من قبل إدارة المنصة. يمكنك الآن البدء بإعداد صفوفك وتسجيل الطلاب.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-700 bg-amber-50 font-bold text-xs shrink-0">
                    بانتظار تفعيل المنصة
                  </Badge>
                </div>
              )}

              {/* 6 Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <Card className="shadow-xs p-4 border border-border cursor-pointer hover:border-primary/50 transition-all" onClick={() => setActiveTab('students')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-semibold">الطلاب</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-foreground">{students.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    طالب مسجل بكود الدخول
                  </div>
                </Card>

                <Card className="shadow-xs p-4 border border-border cursor-pointer hover:border-primary/50 transition-all" onClick={() => setActiveTab('guardians')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-semibold">أولياء الأمور</span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <HeartHandshake className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-base font-black text-foreground">إدارة الأولياء</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    ربط الأبناء وأكواد التطبيق
                  </div>
                </Card>

                <Card className="shadow-xs p-4 border border-border cursor-pointer hover:border-primary/50 transition-all" onClick={() => setActiveTab('stages')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-semibold">المراحل والصفوف</span>
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-base font-black text-foreground">إدارة الهيكل</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    الشُعب والقاعات والمقررات
                  </div>
                </Card>

                <Card className="shadow-xs p-4 border border-border cursor-pointer hover:border-primary/50 transition-all" onClick={() => setActiveTab('homeworks')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-semibold">الواجبات والتحضير</span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-base font-black text-foreground">الواجبات اليومية</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    متابعة تسليمات وحلول الطلاب
                  </div>
                </Card>

                <Card className="shadow-xs p-4 border border-border cursor-pointer hover:border-primary/50 transition-all" onClick={() => setActiveTab('workforce')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-semibold">كادر التدريسي</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-foreground">{teachers.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    أستاذ ومدرس معتمد بالمعهد
                  </div>
                </Card>

                <Card className="shadow-xs p-4 border border-border cursor-pointer hover:border-primary/50 transition-all" onClick={() => setActiveTab('finance')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-semibold">الحسابات والمالية</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-600">
                    {payoutAccruals.filter((p) => p.status === 'paid').reduce((sum, curr) => sum + (Number(curr.calculated_amount) || 0), 0).toLocaleString('ar-IQ')} <span className="text-xs font-normal">د.ع</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    إجمالي أجور الحصص المنصرفة
                  </div>
                </Card>

                <Card className="shadow-xs p-4 border border-border cursor-pointer hover:border-primary/50 transition-all" onClick={() => setActiveTab('settings')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-semibold">الاعدادات والهوية</span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Settings className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-base font-black text-foreground truncate">{profile.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    تخصيص البيانات والاشتراك
                  </div>
                </Card>
              </div>

              {/* Institute Profile Card */}
              <Card className="shadow-xs">
                <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      بيانات وهويّة المعهد
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      المعلومات المعتمدة وهوية المعهد المرئية (الاسم، الشعار، واللون الرئيسي)
                    </CardDescription>
                  </div>
                  <Button
                    onClick={openEditBranding}
                    size="sm"
                    variant="outline"
                    className="font-bold text-xs gap-1.5 h-9 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <Palette className="w-4 h-4" />
                    تخصيص الهوية واللون
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
                    {/* Logo & Emblem preview */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
                      {profile.logo_url ? (
                        <img
                          src={profile.logo_url}
                          alt={profile.name}
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-primary/20 shadow-xs"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-xs"
                          style={{ backgroundColor: profile.primary_color || '#2563eb' }}
                        >
                          {profile.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-foreground block text-sm">{profile.name}</span>
                        <span className="text-[11px] text-muted-foreground block">شعار المعهد المعتمد</span>
                      </div>
                    </div>

                    {/* Primary Color swatch */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
                      <div
                        className="w-10 h-10 rounded-xl shadow-xs border-2 border-white ring-1 ring-border shrink-0"
                        style={{ backgroundColor: profile.primary_color || '#2563eb' }}
                      />
                      <div>
                        <span className="text-muted-foreground block text-[11px]">اللون الرئيسي للمعهد:</span>
                        <span className="font-mono font-bold text-foreground text-sm uppercase">
                          {profile.primary_color || '#2563eb'}
                        </span>
                      </div>
                    </div>

                    {/* Slug */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
                      <Globe className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-muted-foreground block text-[11px]">المعرف الفرعي (Subdomain):</span>
                        <span className="font-mono font-bold text-foreground text-xs">
                          {profile.slug}.fistudy.iq
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground block mb-1">البريد الإلكتروني الرسمي:</span>
                      <span className="font-mono text-foreground font-medium">{profile.email || 'غير مسجل'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block mb-1">رقم هاتف المعهد:</span>
                      <span className="font-mono text-foreground font-medium">{profile.phone || 'غير مسجل'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block mb-1">العنوان والمقر:</span>
                      <span className="text-foreground font-medium">{profile.address || 'العراق'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* STUDENTS TAB - شؤون وسجلات الطلاب */}
          {activeTab === 'students' && (
            <StudentsManagement
              onStudentsUpdated={fetchTenantData}
              onNavigateToGuardians={() => setActiveTab('guardians')}
            />
          )}

          {/* GUARDIANS TAB - إدارة أولياء الأمور */}
          {activeTab === 'guardians' && (
            <GuardiansManagement onUpdated={fetchTenantData} />
          )}

          {/* HOMEWORKS TAB - الواجبات والتحضير اليومي */}
          {activeTab === 'homeworks' && (
            <HomeworksManagement tenantSlug={profile?.slug || contextTenant?.slug} />
          )}

          {/* BANNERS TAB - سلايدر إعلانات المعهد */}
          {activeTab === 'banners' && (
            <BannersManagement tenantSlug={profile?.slug || contextTenant?.slug} />
          )}

          {/* STAGES & GRADES & SECTIONS TAB */}
          {(activeTab === 'stages' || activeTab === 'academic') && (
            <AcademicStructureManagement onUpdated={fetchTenantData} />
          )}

          {/* CURRICULA & SUBJECTS TAB */}
          {activeTab === 'curricula' && (
            <CurriculaManagement onUpdated={fetchTenantData} />
          )}

          {/* TEACHING STAFF / WORKFORCE TAB */}
          {activeTab === 'workforce' && (
            <TeachersManagement
              initialTeachers={teachers}
              staffList={staffList}
              onTeachersUpdated={fetchTenantData}
            />
          )}

          {/* FINANCE TAB - الحسابات */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              <Card className="shadow-xs">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    الحسابات والمالية
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    إدارة الذمم المالية، استحقاقات أجور الحصص التدريسية، وأوامر الصرف النقدي المعتمدة
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-xl border border-border bg-card">
                      <span className="text-xs text-muted-foreground font-semibold block mb-1">الاستحقاقات الإجمالية</span>
                      <span className="text-xl font-black text-foreground">
                        {payoutAccruals.reduce((sum, curr) => sum + (Number(curr.calculated_amount) || 0), 0).toLocaleString('ar-IQ')} <span className="text-xs font-normal">د.ع</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">حصص منفذة ومكافآت تدريس</span>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card">
                      <span className="text-xs text-muted-foreground font-semibold block mb-1">المصروف نقداً</span>
                      <span className="text-xl font-black text-emerald-600">
                        {payoutAccruals
                          .filter((p) => p.status === 'paid')
                          .reduce((sum, curr) => sum + (Number(curr.calculated_amount) || 0), 0)
                          .toLocaleString('ar-IQ')} <span className="text-xs font-normal">د.ع</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">أجور حصص مسددة بموجب إيصالات</span>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card">
                      <span className="text-xs text-muted-foreground font-semibold block mb-1">معتمد للصرف</span>
                      <span className="text-xl font-black text-blue-600">
                        {payoutAccruals
                          .filter((p) => p.status === 'approved')
                          .reduce((sum, curr) => sum + (Number(curr.calculated_amount) || 0), 0)
                          .toLocaleString('ar-IQ')} <span className="text-xs font-normal">د.ع</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">جاهز للصرف والتسليم</span>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card">
                      <span className="text-xs text-muted-foreground font-semibold block mb-1">معلق قيد التدقيق</span>
                      <span className="text-xl font-black text-amber-600">
                        {payoutAccruals
                          .filter((p) => p.status === 'pending')
                          .reduce((sum, curr) => sum + (Number(curr.calculated_amount) || 0), 0)
                          .toLocaleString('ar-IQ')} <span className="text-xs font-normal">د.ع</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">بانتظار اعتماد الإدارة</span>
                    </div>
                  </div>

                  {/* Payouts Table in Finance */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="p-3 bg-secondary/40 border-b border-border flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">سجل استحقاقات أجور الحصص والتسديدات</span>
                      <Badge variant="outline" className="text-[11px] font-mono">
                        {payoutAccruals.length} قيد مالي
                      </Badge>
                    </div>

                    {payoutAccruals.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        لا توجد استحقاقات مالية مسجلة حالياً
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-bold text-xs">تاريخ القيد</TableHead>
                            <TableHead className="font-bold text-xs">المستفيد (المدرس)</TableHead>
                            <TableHead className="font-bold text-xs">نوع الاستحقاق</TableHead>
                            <TableHead className="font-bold text-xs">المبلغ المستحق</TableHead>
                            <TableHead className="font-bold text-xs">الحالة</TableHead>
                            <TableHead className="font-bold text-xs text-left">إجراء الصرف</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payoutAccruals.map((p) => {
                            const teacherName = p.teacher_profile?.person
                              ? `${p.teacher_profile.person.first_name} ${p.teacher_profile.person.last_name}`
                              : 'مدرس مستحق';
                            return (
                              <TableRow key={p.id} className="text-xs">
                                <TableCell className="font-mono text-muted-foreground text-[11px]">
                                  {p.accrual_date ? new Date(p.accrual_date).toLocaleDateString('ar-IQ') : '—'}
                                </TableCell>
                                <TableCell className="font-bold text-foreground">
                                  {teacherName}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-[11px]">
                                  {p.payout_calc_model === 'per_session'
                                    ? 'أجر حصة منفذة'
                                    : p.payout_calc_model === 'substitute_session'
                                    ? 'حصة بديلة'
                                    : p.payout_calc_model}
                                </TableCell>
                                <TableCell className="font-mono font-bold text-foreground">
                                  {Number(p.calculated_amount).toLocaleString('ar-IQ')} {p.currency || 'IQD'}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className={
                                      p.status === 'paid'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : p.status === 'approved'
                                        ? 'bg-blue-100 text-blue-800'
                                        : p.status === 'void'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }
                                  >
                                    {p.status === 'paid'
                                      ? 'تم الصرف'
                                      : p.status === 'approved'
                                      ? 'معتمد للصرف'
                                      : p.status === 'void'
                                      ? 'ملغي'
                                      : 'بانتظار الاعتماد'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-left">
                                  {p.status === 'pending' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={payoutProcessingId === p.id}
                                      onClick={() => handleApprovePayout(p.id)}
                                      className="h-7 text-[11px] font-bold text-blue-700 hover:text-blue-800 border-blue-200 hover:bg-blue-50"
                                    >
                                      {payoutProcessingId === p.id ? 'جاري الاعتماد...' : 'اعتماد الاستحقاق'}
                                    </Button>
                                  )}
                                  {p.status === 'approved' && (
                                    <Button
                                      size="sm"
                                      disabled={payoutProcessingId === p.id}
                                      onClick={() => handleDisbursePayout(p.id)}
                                      className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      {payoutProcessingId === p.id ? 'جاري الصرف...' : 'صرف نقداً'}
                                    </Button>
                                  )}
                                  {p.status === 'paid' && (
                                    <span className="text-[11px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      تم التسليم
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* SETTINGS TAB - الاعدادات */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* 0. Portal & Mobile Apps URLs (تطبيقات الطالب وولي الأمر) */}
              <Card className="shadow-xs border-primary/30 bg-gradient-to-b from-primary/5 via-transparent to-transparent">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-primary" />
                        روابط تطبيقات الهواتف وبوابات المعهد
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        روابط الوصول المباشرة لتطبيقات الطالب، ولي الأمر، والمدرس الخاصة بمعهدك (تسجيل الدخول عبر الكود)
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="w-fit text-primary border-primary/30 text-xs px-2.5 py-1">
                      نظام Mobile-First متجاوب
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* 1. Student App Card */}
                    <div className="p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                              <GraduationCap className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-foreground">تطبيق وبوابة الطالب</h4>
                              <p className="text-[11px] text-muted-foreground">جدول المحاضرات، الدرجات، الحضور، الحساب</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-semibold">
                            STU-XXXX
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border text-xs font-mono text-muted-foreground truncate flex items-center justify-between mb-4">
                          <span className="truncate" dir="ltr">
                            {window.location.origin}/student?slug={profile?.slug || contextTenant?.slug}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 font-bold text-xs gap-1.5 h-9"
                          onClick={() => {
                            const url = `${window.location.origin}/student?slug=${profile?.slug || contextTenant?.slug}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح التطبيق</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-bold text-xs gap-1.5 h-9 border-border"
                          onClick={() => {
                            const url = `${window.location.origin}/student?slug=${profile?.slug || contextTenant?.slug}`;
                            navigator.clipboard.writeText(url);
                            setCopiedPortal('student');
                            setTimeout(() => setCopiedPortal(null), 2500);
                          }}
                        >
                          {copiedPortal === 'student' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-500">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ الرابط</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* 2. Guardian App Card */}
                    <div className="p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-foreground">تطبيق وبوابة ولي الأمر</h4>
                              <p className="text-[11px] text-muted-foreground">متابعة الأبناء اليومية، الغياب، الأقساط، التواصل</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-semibold">
                            GRD-XXXX
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border text-xs font-mono text-muted-foreground truncate flex items-center justify-between mb-4">
                          <span className="truncate" dir="ltr">
                            {window.location.origin}/guardian?slug={profile?.slug || contextTenant?.slug}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 font-bold text-xs gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => {
                            const url = `${window.location.origin}/guardian?slug=${profile?.slug || contextTenant?.slug}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح التطبيق</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-bold text-xs gap-1.5 h-9 border-border"
                          onClick={() => {
                            const url = `${window.location.origin}/guardian?slug=${profile?.slug || contextTenant?.slug}`;
                            navigator.clipboard.writeText(url);
                            setCopiedPortal('guardian');
                            setTimeout(() => setCopiedPortal(null), 2500);
                          }}
                        >
                          {copiedPortal === 'guardian' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-500">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ الرابط</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* 3. Teacher App Card */}
                    <div className="p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-foreground">تطبيق وبوابة المدرس</h4>
                              <p className="text-[11px] text-muted-foreground">جدول الحصص، الشعب والطلاب، تسجيل الغياب</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-semibold">
                            TCH-XXXX
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border text-xs font-mono text-muted-foreground truncate flex items-center justify-between mb-4">
                          <span className="truncate" dir="ltr">
                            {window.location.origin}/teacher?slug={profile?.slug || contextTenant?.slug}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 font-bold text-xs gap-1.5 h-9 bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => {
                            const url = `${window.location.origin}/teacher?slug=${profile?.slug || contextTenant?.slug}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح التطبيق</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-bold text-xs gap-1.5 h-9 border-border"
                          onClick={() => {
                            const url = `${window.location.origin}/teacher?slug=${profile?.slug || contextTenant?.slug}`;
                            navigator.clipboard.writeText(url);
                            setCopiedPortal('teacher');
                            setTimeout(() => setCopiedPortal(null), 2500);
                          }}
                        >
                          {copiedPortal === 'teacher' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-purple-500" />
                              <span className="text-purple-500">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ الرابط</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 1. Institute Profile & Branding */}
              <Card className="shadow-xs">
                <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      بيانات وهويّة المعهد
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      الاسم الرسمي، الشعار، واللون المعتمد الذي يظهر على واجهة تسجيل الدخول واللوحة
                    </CardDescription>
                  </div>
                  <Button
                    onClick={openEditBranding}
                    size="sm"
                    variant="outline"
                    className="font-bold text-xs gap-1.5 h-9 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <Palette className="w-4 h-4" />
                    تخصيص الهوية واللون
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
                      {profile?.logo_url ? (
                        <img
                          src={profile.logo_url}
                          alt={profile.name}
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-primary/20 shadow-xs"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-xs"
                          style={{ backgroundColor: profile?.primary_color || '#2563eb' }}
                        >
                          {profile?.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-foreground block text-sm">{profile?.name}</span>
                        <span className="text-[11px] text-muted-foreground block">شعار المعهد المعتمد</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
                      <div
                        className="w-10 h-10 rounded-xl shadow-xs border-2 border-white ring-1 ring-border shrink-0"
                        style={{ backgroundColor: profile?.primary_color || '#2563eb' }}
                      />
                      <div>
                        <span className="text-muted-foreground block text-[11px]">اللون الرئيسي للمعهد:</span>
                        <span className="font-mono font-bold text-foreground text-sm uppercase">
                          {profile?.primary_color || '#2563eb'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border">
                      <Globe className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-muted-foreground block text-[11px]">المعرف الفرعي (Subdomain):</span>
                        <span className="font-mono font-bold text-foreground text-xs">
                          {profile?.slug}.fistudy.iq
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground block mb-1">البريد الإلكتروني الرسمي:</span>
                      <span className="font-mono text-foreground font-medium">{profile?.email || 'غير مسجل'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block mb-1">رقم هاتف المعهد:</span>
                      <span className="font-mono text-foreground font-medium">{profile?.phone || 'غير مسجل'}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block mb-1">العنوان والمقر:</span>
                      <span className="text-foreground font-medium">{profile?.address || 'العراق'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Custom Domains */}
              <Card className="shadow-xs">
                <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      النطاقات والمجالات المخصصة (Custom Domains)
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      ربط معهدك بنطاق خاص (مثل: institute.iq) وتوجيهه عبر DNS
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setShowAddDomain(true)}
                    size="sm"
                    className="font-bold text-xs gap-1.5 h-9"
                  >
                    <Plus className="h-4 w-4" />
                    طلب ربط دومين
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {domains.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        title="لم يتم ربط نطاق مخصص بعد"
                        description="يمكنك ربط دومين مؤسستك الخاص بدلاً من الدومين الفرعي الافتراضي"
                      />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-bold text-xs">النطاق</TableHead>
                          <TableHead className="font-bold text-xs">الحالة</TableHead>
                          <TableHead className="font-bold text-xs">رمز التحقق TXT</TableHead>
                          <TableHead className="font-bold text-xs text-left">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {domains.map((d) => (
                          <TableRow key={d.id} className="text-xs">
                            <TableCell className="font-mono font-bold text-foreground">{d.domain}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  d.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }
                              >
                                {d.status === 'active' ? 'مفعل ونشط' : 'بانتظار التحقق'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground text-[10px]">
                              {d.verification_token}
                            </TableCell>
                            <TableCell className="text-left">
                              {d.status !== 'active' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVerifyDomain(d.id)}
                                  className="h-7 text-[11px] font-bold"
                                >
                                  تحقق من DNS
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* 3. Subscription & Invoices */}
              <Card className="shadow-xs">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    اشتراك SaaS وفواتير المنصة
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    بيانات الخطة المفعلة وتاريخ التجديد وإيصالات الدفع الرسمية
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {subscription ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                        <span className="text-muted-foreground block mb-1">الخطة الحالية:</span>
                        <span className="font-bold text-foreground text-sm">{subscription.plan?.name || 'الخطة القياسية'}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                        <span className="text-muted-foreground block mb-1">حالة الاشتراك:</span>
                        <Badge
                          variant="secondary"
                          className={
                            subscription.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : subscription.status === 'trialing'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {subscription.status === 'trialing' ? 'فترة تجريبية' : subscription.status === 'active' ? 'نشط' : subscription.status}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                        <span className="text-muted-foreground block mb-1">تاريخ البدء:</span>
                        <span className="font-mono text-foreground">
                          {new Date(subscription.starts_at).toLocaleDateString('ar-IQ')}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                        <span className="text-muted-foreground block mb-1">تاريخ التجديد:</span>
                        <span className="font-mono text-foreground">
                          {new Date(subscription.ends_at).toLocaleDateString('ar-IQ')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <EmptyState title="لا يوجد اشتراك مفعل" description="يرجى التواصل مع إدارة المنصة لتفعيل خطة معهدك" />
                  )}

                  {/* Payment Receipts Table */}
                  {receipts.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-primary" />
                        سجل وصولات دفع الاشتراك
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-bold text-xs">رقم الإيصال</TableHead>
                            <TableHead className="font-bold text-xs">المبلغ</TableHead>
                            <TableHead className="font-bold text-xs">طريقة الدفع</TableHead>
                            <TableHead className="font-bold text-xs">تاريخ الدفع</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receipts.map((r) => (
                            <TableRow key={r.id} className="text-xs">
                              <TableCell className="font-mono font-bold text-foreground">{r.receipt_number}</TableCell>
                              <TableCell className="font-bold text-emerald-600">
                                {r.amount_iqd.toLocaleString()} د.ع
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                <Badge variant="secondary" className="font-medium text-[11px]">{r.payment_method}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-muted-foreground text-[11px]">
                                {new Date(r.paid_at).toLocaleDateString('ar-IQ')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 4. Academic Structure & Curricula Generator (إعدادات الهيكل التعليمي) */}
              <Card className="shadow-xs border-primary/20 bg-gradient-to-br from-card to-primary/[0.02]">
                <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      توليد الهيكل والمناهج الرسمية لوزارة التربية العراقية
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      تهيئة وتوليد المراحل الدراسية (الابتدائية، المتوسطة، الإعدادية)، المقررات المعتمدة، وتوزيع الشُعب تلقائياً
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setShowInitIraqiModal(true)}
                    size="sm"
                    className="font-bold text-xs gap-1.5 h-9 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    توليد الهيكل والمناهج (2026/2027)
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="font-bold text-foreground block mb-1">المرحلة الابتدائية والمتوسطة</span>
                      <span className="text-muted-foreground block text-[11px] leading-relaxed">
                        توليد الصفوف الكاملة مع إنشاء 3 شُعب (أ، ب، ج) لكل صف سعة 30 طالباً مع كافة المواد المعتمدة.
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="font-bold text-foreground block mb-1">المرحلة الإعدادية (العلمي والأدبي)</span>
                      <span className="text-muted-foreground block text-[11px] leading-relaxed">
                        توليد المسارين العلمي والأدبي مع شعبتين فقط (أ، ب) لكل صف وتعيين أنصبة الحصص الأسبوعية.
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="font-bold text-foreground block mb-1">خيارات التوليد والتصفير</span>
                      <span className="text-muted-foreground block text-[11px] leading-relaxed">
                        إمكانية اختيار مراحل محددة أو استبدال وإعادة ضبط الهيكل السابق وتعيين المواد في خطة المعهد.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ADD STUDENT DIALOG */}
      <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              تسجيل وقبول طالب جديد بالمعهد
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              أدخل بيانات الطالب لإنشاء الهوية المركزية والملف الأكاديمي المحلي
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStudent} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الاسم الأول *</Label>
                <Input
                  type="text"
                  required
                  value={studentForm.firstName}
                  onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                  placeholder="مثال: علي"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">اسم الأب</Label>
                <Input
                  type="text"
                  value={studentForm.fatherName}
                  onChange={(e) => setStudentForm({ ...studentForm, fatherName: e.target.value })}
                  placeholder="مثال: حيدر"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">اللقب / العشيرة *</Label>
                <Input
                  type="text"
                  required
                  value={studentForm.lastName}
                  onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                  placeholder="مثال: البصري"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الجنس *</Label>
                <select
                  value={studentForm.gender}
                  onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الرقم الدراسي الداخلي *</Label>
                <Input
                  type="text"
                  required
                  value={studentForm.studentNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, studentNumber: e.target.value })}
                  placeholder="مثال: STU-2026-001"
                  className="font-mono text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رقم الهاتف للتواصل</Label>
                <Input
                  type="text"
                  dir="ltr"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  placeholder="07701234567"
                  className="font-mono text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">ملاحظات واحتياجات خاصة (اختياري)</Label>
              <Input
                type="text"
                value={studentForm.medicalNotes}
                onChange={(e) => setStudentForm({ ...studentForm, medicalNotes: e.target.value })}
                placeholder="حساسية، ملاحظات صحية أو دراسية..."
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddStudent(false)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={studentSubmitting}
                className="text-xs font-bold"
              >
                {studentSubmitting ? 'جاري الحفظ...' : 'تأكيد التسجيل'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DOMAIN DIALOG */}
      <Dialog open={showAddDomain} onOpenChange={setShowAddDomain}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              طلب ربط دومين مخصص لمعهدك
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              أدخل اسم النطاق الذي تملكه لإنشاء رمز التحقق TXT وتوجيهه
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestDomain} className="space-y-4 py-2">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اسم النطاق (Domain)</Label>
              <Input
                type="text"
                dir="ltr"
                required
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="academy-alnoor.iq"
                className="font-mono text-xs h-9"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddDomain(false)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={domainLoading}
                className="text-xs font-bold"
              >
                {domainLoading ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BRANDING & IDENTITY DIALOG */}
      <Dialog
        open={showEditBranding}
        onOpenChange={(open) => {
          setShowEditBranding(open);
          if (!open) {
            applyTenantTheme(profile?.primary_color || contextTenant?.primary_color);
          }
        }}
      >
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              تخصيص هوية وبيانات المعهد
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              تعديل الاسم الرسمي، رفع الشعار، واختيار اللون الرئيسي المعتمد لمنظومة المعهد
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateBranding} className="space-y-4 py-2">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اسم المعهد / المؤسسة</Label>
              <Input
                type="text"
                required
                value={brandingForm.name}
                onChange={(e) => setBrandingForm({ ...brandingForm, name: e.target.value })}
                placeholder="اسم المعهد الرسمي"
                className="text-xs h-9"
              />
            </div>

            {/* Logo File Upload & Optimization */}
            <div className="space-y-2 text-right">
              <Label className="text-xs font-semibold block">شعار المعهد (Institute Logo)</Label>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Upload button & file input */}
                <label className="flex-1 w-full border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-xl p-3 flex items-center justify-center gap-2.5 bg-primary/5 hover:bg-primary/10 transition cursor-pointer text-center group">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-foreground block">
                      {optimizingLogo ? 'جاري تحسين وضغط الصورة...' : 'رفع الشعار من جهازك'}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      يدعم PNG, JPG, WEBP, SVG (يتم تحسينها وتصغير حجمها تلقائياً)
                    </span>
                  </div>
                </label>

                {/* Preview box if logo present */}
                {brandingForm.logo_url && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/40 border border-border shrink-0">
                    <img
                      src={brandingForm.logo_url}
                      alt="معاينة الشعار"
                      className="w-12 h-12 rounded-lg object-cover ring-1 ring-border bg-background"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBrandingForm((prev) => ({ ...prev, logo_url: '' }));
                        setLogoFile(null);
                        setOptimizationStats(null);
                      }}
                      className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                    >
                      حذف
                    </Button>
                  </div>
                )}
              </div>

              {/* Optimization stats badge */}
              {optimizationStats && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    تم تحسين وضغط الشعار: من <strong>{optimizationStats.originalKB} KB</strong> إلى <strong>{optimizationStats.optimizedKB} KB</strong> (توفير {optimizationStats.savedPercent}%)
                  </span>
                </div>
              )}

              {/* Optional URL input fallback */}
              <div className="pt-1">
                <Label className="text-[11px] text-muted-foreground block mb-1">أو إدخال رابط الشعار يدوياً (اختياري)</Label>
                <Input
                  type="url"
                  dir="ltr"
                  value={brandingForm.logo_url.startsWith('data:') ? '' : brandingForm.logo_url}
                  onChange={(e) => {
                    setBrandingForm({ ...brandingForm, logo_url: e.target.value });
                    setLogoFile(null);
                    setOptimizationStats(null);
                  }}
                  placeholder="https://example.com/logo.png"
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>

            {/* Primary Color Selection with Live Instant Theming */}
            <div className="space-y-2 text-right">
              <Label className="text-xs font-semibold block">اللون الرئيسي للمعهد (Brand Primary Color)</Label>
              <p className="text-[11px] text-muted-foreground">
                يتغير اللون تلقائياً عبر كامل المنظومة (الأزرار، السايد بار، والشارات) بمجرد اختياره
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { name: 'أزرق ملكي', color: '#2563eb' },
                  { name: 'أخضر زمردي', color: '#059669' },
                  { name: 'بنفسجي ملكي', color: '#7c3aed' },
                  { name: 'ياقوتي غامق', color: '#e11d48' },
                  { name: 'عنبري ذهبي', color: '#d97706' },
                  { name: 'كحلي ليلي', color: '#1e293b' },
                ].map((item) => (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() => handleColorChange(item.color)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition ${
                      brandingForm.primary_color === item.color
                        ? 'border-primary ring-2 ring-primary/20 bg-secondary'
                        : 'border-border hover:bg-secondary/40'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block shadow-xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </button>
                ))}
                {/* Custom Color input */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border">
                  <input
                    type="color"
                    value={brandingForm.primary_color}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                    title="اختر لوناً مخصصاً"
                  />
                  <span className="font-mono text-[11px] uppercase font-bold text-muted-foreground">
                    {brandingForm.primary_color}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رقم هاتف المعهد</Label>
                <Input
                  type="text"
                  dir="ltr"
                  value={brandingForm.phone}
                  onChange={(e) => setBrandingForm({ ...brandingForm, phone: e.target.value })}
                  placeholder="07701234567"
                  className="text-xs h-9 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">العنوان والمقر</Label>
                <Input
                  type="text"
                  value={brandingForm.address}
                  onChange={(e) => setBrandingForm({ ...brandingForm, address: e.target.value })}
                  placeholder="المدينة / المنطقة"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  applyTenantTheme(profile?.primary_color || contextTenant?.primary_color);
                  setShowEditBranding(false);
                }}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={brandingSubmitting || optimizingLogo}
                className="text-xs font-bold gap-1.5"
              >
                {brandingSubmitting ? 'جاري الحفظ...' : 'حفظ وتطبيق التغييرات'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* IRAQI OFFICIAL EDUCATIONAL STRUCTURE & CURRICULA GENERATOR MODAL (SETTINGS) */}
      <IraqiCurriculumInitModal
        open={showInitIraqiModal}
        onOpenChange={setShowInitIraqiModal}
        onSuccess={async () => {
          setSuccessNotice('تم توليد الهيكل والمناهج الرسمية لوزارة التربية العراقية بنجاح وتعيين الشُعب تلقائياً');
          await fetchTenantData();
        }}
      />
    </DashboardLayout>
  );
};
