import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Plan } from '../types';
import { buildTenantUrl } from '../lib/tenant';

// Shadcn UI Components
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Label,
  Badge,
  Separator,
} from '@/components/ui';

// Lucide Icons
import {
  School,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  AlertCircle,
  Eye,
  EyeOff,
  Layers,
  Globe,
  Clock,
  Smartphone,
  MessageSquare,
  CalendarDays,
  CreditCard,
} from 'lucide-react';

export const RegisterInstitutePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedPlanId = searchParams.get('plan_id');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    phone: '',
    address: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    tenant: any;
    admin: any;
    subscription: any;
    redirect_url: string;
    token: string;
  } | null>(null);

  const [countdown, setCountdown] = useState(5);

  const cleanSlug = (input: string): string => {
    return input
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 50);
  };

  const transliterateArabicToSlug = (name: string): string => {
    const map: Record<string, string> = {
      'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
      'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z',
      'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
      'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
      'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'h', 'ء': '', 'ئ': 'y', 'ؤ': 'w',
    };

    let transliterated = '';
    for (const char of name.trim()) {
      if (map[char] !== undefined) {
        transliterated += map[char];
      } else if (/[a-zA-Z0-9]/.test(char)) {
        transliterated += char.toLowerCase();
      } else if (/[\s\-_]/.test(char)) {
        transliterated += '-';
      }
    }

    const cleaned = cleanSlug(transliterated).replace(/^-+|-+$/g, '');
    return cleaned.length >= 3 ? cleaned : '';
  };

  const validateSlug = (val: string): string | null => {
    if (!val) return 'المعرّف اللاتيني مطلوب';
    if (val.length < 3) return 'المعرّف قصير جداً (3 أحرف على الأقل)';
    if (val.length > 50) return 'المعرّف طويل جداً (50 حرفاً كحد أقصى)';
    if (val.includes('--')) return 'لا يمكن استخدام شرطات متتالية (--)';
    if (val.startsWith('-') || val.endsWith('-')) return 'يجب ألا يبدأ أو ينتهي المعرّف بشرطة (-)';
    if (!/^[a-z0-9-]+$/.test(val)) return 'أحرف إنجليزية صغيرة وأرقام وشرطة فقط (a-z, 0-9, -)';
    return null;
  };

  const slugValidationError = form.slug ? validateSlug(form.slug) : null;

  useEffect(() => {
    apiRequest<{ success: boolean; data: Plan[] }>('/api/v1/public/plans')
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          setPlans(res.data);
          const found = preselectedPlanId
            ? res.data.find((p) => p.id === preselectedPlanId)
            : res.data[0];
          setSelectedPlan(found || res.data[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, [preselectedPlanId]);

  // Handle countdown redirection on success
  useEffect(() => {
    if (!successData) return;
    if (countdown <= 0) {
      window.location.href = successData.redirect_url;
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [successData, countdown]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = cleanSlug(e.target.value);
    setForm({ ...form, slug: raw });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nameVal = e.target.value;
    const suggestedSlug = transliterateArabicToSlug(nameVal);
    setForm((prev) => ({
      ...prev,
      name: nameVal,
      slug:
        prev.slug === '' || prev.slug === transliterateArabicToSlug(prev.name)
          ? suggestedSlug || prev.slug
          : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slugValidationError) {
      setErrorMessage(slugValidationError);
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiRequest<{
        success: boolean;
        tenant: any;
        admin: any;
        subscription: any;
        redirect_url: string;
        token: string;
      }>('/api/v1/public/register-institute', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          plan_id: selectedPlan?.id,
        }),
      });

      const targetLoginUrl = buildTenantUrl(res.tenant.slug, '/login');
      setSuccessData({
        ...res,
        redirect_url: targetLoginUrl,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء إنشاء حساب المعهد، يرجى مراجعة البيانات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const expectedSubdomainUrl = buildTenantUrl(form.slug || 'slug', '/login');

  return (
    <div className="min-h-screen bg-muted/20 text-foreground flex flex-col justify-between font-sans selection:bg-primary selection:text-primary-foreground" dir="rtl">
      {/* 1. Header / Navbar */}
      <header className="border-b border-border bg-card/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs group-hover:opacity-90 transition">
              <School className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-foreground">FiStudy</span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                  سحابي
                </Badge>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground block -mt-0.5">
                المنظومة التعليمية الذكية لإدارة المعاهد والمدارس
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-xs font-semibold">
              <Link to="/login">
                لديك حساب بالفعل؟ <span className="text-primary font-bold mr-1 underline underline-offset-4">تسجيل الدخول</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex text-xs font-semibold gap-1.5 h-8">
              <Link to="/">
                <span>الرئيسية</span>
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-0" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex-1">
        {successData ? (
          /* SUCCESS SCREEN */
          <Card className="border-border shadow-md max-w-2xl mx-auto text-center animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="space-y-4 pb-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <CardTitle className="text-2xl font-bold text-foreground">
                  تم إنشاء حساب معهدك بنجاح! 🎉
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground max-w-md mx-auto">
                  تم تجهيز مساحة العمل السحابية الخاصة بمعهدك، وهي جاهزة تماماً للعمل والتهيئة.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 text-right">
              {/* Credentials Details */}
              <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">اسم المعهد:</span>
                  <span className="font-bold text-foreground">{successData.tenant?.name}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">رابط الدخول المخصص لمعهدك:</span>
                  <a
                    href={successData.redirect_url}
                    className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5 dir-ltr"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{successData.redirect_url}</span>
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">البريد الإلكتروني للمدير:</span>
                  <span className="font-mono font-semibold text-foreground" dir="ltr">
                    {successData.admin?.email}
                  </span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3 pt-2">
              <Button asChild size="lg" className="w-full sm:w-auto font-bold gap-2">
                <a href={successData.redirect_url}>
                  <span>الدخول إلى لوحة تحكم معهدك الآن</span>
                  <ArrowLeft className="w-4 h-4" />
                </a>
              </Button>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>سيتم نقلك تلقائياً خلال <strong className="text-primary font-bold">{countdown}</strong> ثوانٍ...</span>
              </p>
            </CardFooter>
          </Card>
        ) : (
          /* REGISTRATION FORM (2-COLUMN DESKTOP SPLIT LAYOUT WITH LANDING CONTENT) */
          <div className="space-y-6">
            {/* Top Page Header with Landing Page Badges */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-border/70">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-full text-xs font-bold flex items-center gap-1">
                    <Smartphone className="w-3 h-3" /> بوابة أولياء الأمور
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full text-xs font-bold flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> إشعارات واتساب
                  </span>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-full text-xs font-bold flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> جدول الحصص الذكي
                  </span>
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded-full text-xs font-bold flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> الأقساط وسندات القبض
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  تسجيل معهد جديد في منظومة FiStudy
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  المنظومة التعليمية المتكاملة لإدارة شؤون الطلاب، الكوادر، الدرجات، الحصص، والحسابات
                </p>
              </div>

              {/* Quick Platform Metrics from Landing Page */}
              <div className="hidden lg:flex items-center gap-4 text-xs">
                <div className="bg-card border border-border px-3.5 py-2 rounded-xl text-center shadow-xs">
                  <span className="block font-black text-base text-primary">+50</span>
                  <span className="text-[10px] text-muted-foreground font-semibold">معهد ومدرسة معتمدة</span>
                </div>
                <div className="bg-card border border-border px-3.5 py-2 rounded-xl text-center shadow-xs">
                  <span className="block font-black text-base text-foreground">+15,000</span>
                  <span className="text-[10px] text-muted-foreground font-semibold">طالب مسجل</span>
                </div>
                <div className="bg-card border border-border px-3.5 py-2 rounded-xl text-center shadow-xs">
                  <span className="block font-black text-base text-emerald-600 dark:text-emerald-400">99.9%</span>
                  <span className="text-[10px] text-muted-foreground font-semibold">استقرار سحابي</span>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* RIGHT COLUMN (8 COLS): FORM STEPS */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Step 1: Plan Picker */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                          <Layers className="w-4 h-4 text-primary" />
                          <span>1. اختيار باقة المعهد</span>
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          14 يوماً تجربة متكاملة
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        اختر الباقة المناسبة لحجم ونشاط معهدك التعليمي
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {loadingPlans ? (
                        <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          <span>جاري تحميل الباقات المتاحة...</span>
                        </div>
                      ) : plans.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {plans.map((p) => {
                            const isSelected = selectedPlan?.id === p.id;
                            return (
                              <div
                                key={p.id}
                                onClick={() => setSelectedPlan(p)}
                                className={`cursor-pointer rounded-xl p-4 border transition-all text-right flex flex-col justify-between relative ${
                                  isSelected
                                    ? 'bg-primary/5 border-primary ring-2 ring-primary/20 shadow-xs'
                                    : 'bg-card border-border hover:border-border/80 hover:bg-accent/40'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-sm text-foreground">{p.name}</span>
                                    {isSelected ? (
                                      <Badge variant="default" className="text-[10px] h-5 px-1.5 font-bold">
                                        مختارة
                                      </Badge>
                                    ) : (
                                      <div className="w-3.5 h-3.5 rounded-full border border-border" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
                                    {p.description || 'باقة إدارة متكاملة وشاملة'}
                                  </p>
                                </div>
                                <div className="pt-2 border-t border-border/60 flex items-baseline justify-between">
                                  <span className="text-sm font-bold text-primary">
                                    {Number(p.price_iqd).toLocaleString()} <span className="text-[10px]">د.ع</span>
                                  </span>
                                  <Badge variant="outline" className="text-[10px] font-medium">
                                    {p.billing_cycle === 'yearly' ? 'سنوياً' : 'شهرياً'}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Step 2: Institute Information */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/50">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span>2. بيانات وهوية المعهد</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        المعلومات الأساسية المعتمدة لتهيئة مساحة العمل والنطاق الخاص بمعهدك
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Institute Name */}
                        <div className="space-y-1.5">
                          <Label htmlFor="institute_name" className="text-xs font-semibold text-foreground">
                            اسم المعهد / المؤسسة التعليمية <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="institute_name"
                            type="text"
                            required
                            placeholder="مثال: معهد الأوائل التعليمي"
                            value={form.name}
                            onChange={handleNameChange}
                            className="text-xs h-10"
                          />
                        </div>

                        {/* Slug */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="slug" className="text-xs font-semibold text-foreground">
                              معرف الرابط اللاتيني (Slug) <span className="text-destructive">*</span>
                            </Label>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              (a-z, 0-9)
                            </span>
                          </div>
                          <Input
                            id="slug"
                            type="text"
                            required
                            dir="ltr"
                            placeholder="alawael"
                            value={form.slug}
                            onChange={handleSlugChange}
                            className={`text-xs font-mono text-left h-10 ${slugValidationError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                          />
                          {slugValidationError ? (
                            <p className="text-[11px] text-destructive mt-1">{slugValidationError}</p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              أحرف إنجليزية صغيرة وأرقام وشرطة فقط (يتم توليده تلقائياً من الاسم)
                            </p>
                          )}
                        </div>

                        {/* Live Domain Preview Notice */}
                        <div className="sm:col-span-2 p-3 rounded-lg bg-muted/40 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Globe className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium">رابط الدخول المخصص لمعهدك مستقبلاً:</span>
                          </div>
                          <span className="font-mono font-bold text-primary dir-ltr text-xs bg-background px-2.5 py-1 rounded-md border border-border shadow-xs">
                            {expectedSubdomainUrl}
                          </span>
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                          <Label htmlFor="phone" className="text-xs font-semibold text-foreground">
                            رقم هاتف المعهد <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="phone"
                            type="tel"
                            required
                            dir="ltr"
                            placeholder="077XXXXXXXX"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            className="text-xs text-left font-mono h-10"
                          />
                        </div>

                        {/* Address */}
                        <div className="space-y-1.5">
                          <Label htmlFor="address" className="text-xs font-semibold text-foreground">
                            المحافظة / العنوان
                          </Label>
                          <Input
                            id="address"
                            type="text"
                            placeholder="مثال: البصرة — الجنينة"
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            className="text-xs h-10"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 3: Admin User */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="pb-3 border-b border-border/50">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <User className="w-4 h-4 text-primary" />
                        <span>3. بيانات حساب مدير المعهد (المسؤول الأول)</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        بيانات تسجيل الدخول الخاصة بمدير المعهد للوصول للوحة التحكم
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Admin Name */}
                        <div className="space-y-1.5">
                          <Label htmlFor="admin_name" className="text-xs font-semibold text-foreground">
                            اسم المدير الكامل <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="admin_name"
                            type="text"
                            required
                            placeholder="مثال: أ. أحمد العلي"
                            value={form.admin_name}
                            onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                            className="text-xs h-10"
                          />
                        </div>

                        {/* Admin Email */}
                        <div className="space-y-1.5">
                          <Label htmlFor="admin_email" className="text-xs font-semibold text-foreground">
                            البريد الإلكتروني للدخول <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="admin_email"
                            type="email"
                            required
                            dir="ltr"
                            placeholder="admin@institute.iq"
                            value={form.admin_email}
                            onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                            className="text-xs text-left font-mono h-10"
                          />
                        </div>

                        {/* Admin Password */}
                        <div className="space-y-1.5">
                          <Label htmlFor="admin_password" className="text-xs font-semibold text-foreground">
                            كلمة المرور للدخول <span className="text-destructive">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              id="admin_password"
                              type={showPassword ? 'text' : 'password'}
                              required
                              placeholder="••••••••"
                              value={form.admin_password}
                              onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                              className="text-xs pl-9 h-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* LEFT COLUMN (4 COLS): STICKY SUMMARY & LANDING PAGE HIGHLIGHTS */}
                <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
                  {/* Plan Summary Card */}
                  <Card className="border-border shadow-sm">
                    <CardHeader className="pb-3 border-b border-border/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold text-foreground">
                          ملخص الحساب المختار
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {selectedPlan?.billing_cycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 space-y-4">
                      {/* Plan Summary Highlight */}
                      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-foreground">
                            {selectedPlan?.name || 'الباقة المختارة'}
                          </span>
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            14 يوماً تجربة
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-primary">
                            {Number(selectedPlan?.price_iqd || 0).toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">د.ع / {selectedPlan?.billing_cycle === 'yearly' ? 'سنة' : 'شهر'}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {selectedPlan?.description || 'إدارة كاملة للطلاب والصفوف والحصص والدرجات والأقساط'}
                        </p>
                      </div>

                      {/* 4 Pillars of FiStudy from Landing Page */}
                      <div className="space-y-2.5 pt-1">
                        <span className="text-[11px] font-bold text-foreground block">
                          أبرز ما ستحصل عليه في معهدك:
                        </span>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-card border border-border/60">
                            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                              <Smartphone className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-bold text-foreground block text-[11px]">بوابة أولياء الأمور والطلاب</span>
                              <span className="text-[10px] text-muted-foreground">متابعة الدرجات والغياب والواجبات لحظياً</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-card border border-border/60">
                            <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                              <CalendarDays className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-bold text-foreground block text-[11px]">جدول الحصص الذكي</span>
                              <span className="text-[10px] text-muted-foreground">توزيع آلي متوازن بدون أي تعارض زمني أو مكاني</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-card border border-border/60">
                            <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                              <CreditCard className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-bold text-foreground block text-[11px]">نظام الأقساط والمالية</span>
                              <span className="text-[10px] text-muted-foreground">إيصالات وسندات قبض رسمية وجدولة دفعات</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5 p-2 rounded-lg bg-card border border-border/60">
                            <div className="w-7 h-7 rounded-md bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center shrink-0 mt-0.5">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-bold text-foreground block text-[11px]">تكامل رسائل الواتساب</span>
                              <span className="text-[10px] text-muted-foreground">إشعار ولي الأمر فترات الغياب والنتائج</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Expected Institute Link */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          رابط معهدك المستقل:
                        </span>
                        <div className="p-2.5 rounded-lg bg-background border border-border font-mono text-[11px] text-primary dir-ltr truncate font-bold shadow-2xs">
                          {expectedSubdomainUrl}
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="flex-col gap-2 pt-0">
                      <Button
                        type="submit"
                        size="lg"
                        disabled={isSubmitting}
                        className="w-full text-xs sm:text-sm font-bold gap-2 h-11 shadow-sm"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            <span>جاري تهيئة الحساب...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>إنشاء حساب المعهد وبدء التجربة</span>
                            <ArrowLeft className="w-4 h-4 rtl:rotate-0" />
                          </>
                        )}
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center">
                        منظومة FiStudy التعليمية المتكاملة
                      </p>
                    </CardFooter>
                  </Card>

                  {/* Operational Steps Box (from Landing Page) */}
                  <Card className="border-border/70 shadow-2xs bg-card/60">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-xs font-bold text-foreground">
                        خطوات بدء العمل في المنظومة:
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0 text-[11px] text-muted-foreground space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                        <span>تسجيل المعهد والحصول على الرابط المخصص</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                        <span>إضافة الصفوف والشُعب وتعيين الكوادر التدريسية</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                        <span>استقبال الطلاب وتفعيل بوابة أولياء الأمور</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-border bg-card py-5 text-center text-xs text-muted-foreground mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">منظومة FiStudy التعليمية</span>
            <span>•</span>
            <span>كافة الحقوق محفوظة © 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-foreground transition">الرئيسية</Link>
            <Link to="/login" className="hover:text-foreground transition">دخول المعاهد</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
