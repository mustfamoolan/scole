import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { Plan } from '../types';
import { parsePlanFeatures } from '../lib/planFeatures';
import {
  School,
  Shield,
  CheckCircle2,
  Star,
  Play,
  Send,
  ArrowLeft,
  Phone,
  MapPin,
  BookOpen,
  Calendar,
  Sparkles,
  Users,
  Smartphone,
  Clock,
  CreditCard,
  GraduationCap,
  Trophy,
  Building2,
  Bot,
  MessageSquare,
  Cpu,
  BarChart3,
  CalendarDays,
  FileCheck,
  ExternalLink,
  X,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(0);

  // Dynamic platform CMS settings
  const [cmsSettings, setCmsSettings] = useState<Record<string, string>>({
    hero_title: 'المنظومة التعليمية المتكاملة لإدارة المعاهد والمدارس الحديثة',
    hero_subtitle: 'نظام سحابي ذكي مصمم وفق أعلى المعايير لإدارة الطلاب، الكوادر، الدرجات، الحصص، والحسابات بكل سهولة واحترافية.',
    platform_phone: '07737777424',
    platform_address: 'العراق — البصرة',
    platform_email: 'contact@fistudy.iq',
  });

  // Dynamic live plans from platform
  const [livePlans, setLivePlans] = useState<Plan[]>([]);

  // Self-Registration & Onboarding Modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    slug: '',
    phone: '',
    address: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registeredResult, setRegisteredResult] = useState<{
    tenant: any;
    admin: any;
    subscription: any;
    redirect_url: string;
    token: string;
  } | null>(null);

  // Contact / Inquiry Form state
  const [inquiryForm, setInquiryForm] = useState({
    fullName: '',
    phone: '',
    instituteName: '',
    requestType: 'consultation',
    notes: '',
  });
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch public settings
    apiRequest<{ success: boolean; data: Record<string, string> }>('/api/v1/public/settings')
      .then((res) => {
        if (res?.data) {
          setCmsSettings((prev) => ({ ...prev, ...res.data }));
        }
      })
      .catch(() => {});

    // 2. Fetch public active plans from platform
    apiRequest<{ success: boolean; data: Plan[] }>('/api/v1/public/plans')
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          setLivePlans(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenRegister = (plan: Plan) => {
    setSelectedPlan(plan);
    setRegisteredResult(null);
    setRegisterError(null);
    setShowRegisterModal(true);
  };

  const handleSelfRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    setRegisterError(null);
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
          ...registerForm,
          plan_id: selectedPlan?.id,
        }),
      });
      setRegisteredResult(res);
    } catch (err: any) {
      setRegisterError(err.message || 'فشل إنشاء الحساب، يرجى التأكد من صحة البيانات');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryLoading(true);
    setInquiryError(null);
    try {
      await apiRequest('/api/v1/public/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          full_name: inquiryForm.fullName,
          phone: inquiryForm.phone,
          institute_name: inquiryForm.instituteName,
          request_type: inquiryForm.requestType,
          notes: inquiryForm.notes,
        }),
      });
      setInquirySuccess(true);
      setInquiryForm({
        fullName: '',
        phone: '',
        instituteName: '',
        requestType: 'consultation',
        notes: '',
      });
    } catch (err: any) {
      setInquiryError(err.message || 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً');
    } finally {
      setInquiryLoading(false);
    }
  };

  // 14 Core Platform Features categorized into 4 operational pillars
  const featureCategories = [
    {
      id: 'students-parents',
      title: 'شؤون الطلاب وأولياء الأمور',
      tag: '5 مميزات رئيسية',
      description: 'منظومة متكاملة لبيانات الطلاب وبوابة مخصصة لأولياء الأمور لمتابعة مستمرة.',
      features: [
        {
          name: 'سجلات الطلاب وتسجيل الطلاب',
          desc: 'أرشفة إلكترونية شاملة لكافة بيانات وملفات الطالب مع إمكانية التسجيل الذكي السريع.',
          icon: Users,
        },
        {
          name: 'رصد درجات الطلاب والتقارير',
          desc: 'إدخال وحساب الدرجات والمعدلات تلقائياً مع إصدار بطاقات النتائج الشهرية والنهائية.',
          icon: BarChart3,
        },
        {
          name: 'تتبع سلوك وحضور الطلاب',
          desc: 'تسجيل الحضور والغياب اليومي لحظياً وتدوين الملاحظات السلوكية والتراكمية.',
          icon: Clock,
        },
        {
          name: 'بوابة أولياء الأمور الشاملة',
          desc: 'صفحة خاصة لولي الأمر لمتابعة درجات ابنه، التبليغات، الإشعارات، جدول الامتحانات، وسلوكه وحضوره لحظة بلحظة.',
          icon: Smartphone,
          badge: 'مميز',
        },
        {
          name: 'نظام الامتحانات ونقاط التحفيز',
          desc: 'جدولة الامتحانات ومنح نقاط ومكافآت تشجيعية للطلاب لتعزيز التنافس الإيجابي.',
          icon: Trophy,
        },
      ],
    },
    {
      id: 'classes-schedule',
      title: 'الصفوف والجدول الذكي والكادر',
      tag: '3 مميزات ذكية',
      description: 'تنظيم متكامل للشُعب الدراسية والكادر وتوزيع ذكي متوازن للحصص دون أي تعارض.',
      features: [
        {
          name: 'إدارة الصفوف والشُعب والحصص',
          desc: 'تنظيم الفصول والقاعات وتحديد السعة الاستيعابية والحصص الأسبوعية بدقة.',
          icon: BookOpen,
        },
        {
          name: 'جدول الدروس الذكي (توزيع ذكي)',
          desc: 'توزيع تلقائي ذكي لجدول الحصص بين المدرسين والقاعات دون أي تعارض زمني أو مكاني وبأعلى كفاءة.',
          icon: CalendarDays,
          badge: 'جدولة ذكية',
        },
        {
          name: 'إدارة المدرسين والكادر التعليمي',
          desc: 'متابعة سجلات المدرسين، نصاب الحصص، الحضور، وتوزيع المواد الدراسية بكفاءة.',
          icon: GraduationCap,
        },
      ],
    },
    {
      id: 'finance-admin',
      title: 'المالية والأقساط والكتب الرسمية',
      tag: 'إدارة مالية متكاملة',
      description: 'إدارة الحسابات والأقساط الرسمية بدقة متناهية مع أرشيف الكتب والتعاميم.',
      features: [
        {
          name: 'إدارة الدفعات والأقساط',
          desc: 'متابعة أقساط الطلاب، خطط الدفع الميسرة، المتأخرات، وطباعة إيصالات وسندات القبض الرسمية.',
          icon: CreditCard,
          badge: 'مالية وحسابات',
        },
        {
          name: 'الكتب الرسمية والتعاميم والعطل',
          desc: 'أرشفة الكتب الوزارية والإدارية الصادرة والواردة، وتقويم مدمج للعطل الرسمية والمناسبات.',
          icon: FileCheck,
        },
        {
          name: 'إدارة المعاهد والمدارس المستقلة',
          desc: 'مساحة رقمية متكاملة خاصة بمعهدك ومدرستك بهويتك وشعارك وأعلى معايير الخصوصية والأمان.',
          icon: Building2,
        },
      ],
    },
    {
      id: 'smart-integrations',
      title: 'التكاملات الذكية (واتساب، AI، تيليجرام)',
      tag: 'أتمتة متطورة',
      description: 'تواصل فوري مع أولياء الأمور والطلاب عبر أحدث تقنيات الذكاء والرسائل.',
      features: [
        {
          name: 'تكامل واتساب المباشر للإشعارات',
          desc: 'إرسال إشعارات فورية لولي الأمر عبر الواتساب عند تسجيل الغياب، صدور الدرجات، أو حلول موعد القسط.',
          icon: MessageSquare,
          badge: 'واتساب فوري',
        },
        {
          name: 'تكامل الذكاء الاصطناعي (AI)',
          desc: 'مساعد ذكي لتحليل مستويات الطلاب، توليد نماذج الامتحانات، وتقديم تقارير استشرافية للأداء.',
          icon: Cpu,
          badge: 'AI متقدم',
        },
        {
          name: 'تكامل بوت تيليجرام التفاعلي',
          desc: 'بوت تيليجرام على مدار الساعة يتيح للطلاب وأولياء الأمور الاستعلام الذاتي عن النتائج والجداول.',
          icon: Bot,
          badge: '24/7 متصل',
        },
      ],
    },
  ];

  // Flat list of the 14 features for the showcase grid
  const allFourteenFeatures = [
    { title: 'إدارة المعاهد والمدارس', desc: 'حل رقمي شامل يمنح مؤسستك نظاماً مستقلاً متكاملاً لإدارة الفروع والشؤون التعليمية بكل سهولة.', icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { title: 'سجلات الطلاب والتسجيل', desc: 'قاعدة بيانات متكاملة لملفات الطلاب والوثائق مع بوابات تسجيل إلكتروني.', icon: Users, color: 'text-indigo-600 bg-indigo-50' },
    { title: 'رصد درجات الطلاب', desc: 'دفتر درجات إلكتروني متقدم، حساب المعدلات تلقائياً، وإصدار الشهادات والتقارير.', icon: BarChart3, color: 'text-emerald-600 bg-emerald-50' },
    { title: 'سلوك وحضور الطلاب', desc: 'سجل غياب وتأخر لحظي مع نظام تقييم السلوك والانضباط الصفي اليومي.', icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { title: 'صفحة وبوابة أولياء الأمور', desc: 'منصة مخصصة لولي الأمر لمتابعة درجات ابنه، تبليغات المعهد، جدول الامتحانات وسلوكه وحضوره.', icon: Smartphone, color: 'text-blue-700 bg-blue-100', highlight: true },
    { title: 'إدارة الصفوف والحصص', desc: 'توزيع الشُعب والقاعات وإدارة السعة الطلابية وجداول الحصص اليومية.', icon: BookOpen, color: 'text-purple-600 bg-purple-50' },
    { title: 'إدارة الدفعات والأقساط', desc: 'جدولة أقساط الطلاب، متابعة الإيرادات والمتبقي، وإصدار وصولات وسندات القبض الرسمية.', icon: CreditCard, color: 'text-teal-600 bg-teal-50', highlight: true },
    { title: 'جدول الدروس الذكي', desc: 'توزيع آلي ذكي للحصص بين المدرسين والقاعات والصفوف دون أي تضارب زمني بضغطة زر واحدة.', icon: CalendarDays, color: 'text-blue-600 bg-blue-50', highlight: true },
    { title: 'إدارة المدرسين والكادر', desc: 'ملفات المعلمين، نصاب الحصص، متابعة الحضور والغياب، وتقييم الأداء الأكاديمي.', icon: GraduationCap, color: 'text-cyan-600 bg-cyan-50' },
    { title: 'امتحانات ونقاط للطلاب', desc: 'إدارة جداول الاختبارات مع نظام نقاط تحفيزي يمنح شارات ومكافآت للمتفوقين.', icon: Trophy, color: 'text-yellow-600 bg-yellow-50' },
    { title: 'الكتب الرسمية والعطل', desc: 'أرشفة رقمية لكافة الكتب الرسمية والتعاميم الصادرة والواردة مع تقويم العطل المدرسية.', icon: FileCheck, color: 'text-rose-600 bg-rose-50' },
    { title: 'تكامل واتساب للإشعارات', desc: 'إرسال رسائل واتساب تلقائية لأولياء الأمور عند الغياب، إعلان الدرجات، ومواعيد الأقساط.', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-100', highlight: true },
    { title: 'تكامل الذكاء الاصطناعي (AI)', desc: 'تحليل ذكي لمستوى استيعاب الطلاب، توليد مقترحات الأسئلة، ومساعد إداري آلي.', icon: Cpu, color: 'text-violet-600 bg-violet-100', highlight: true },
    { title: 'تكامل بوت تيليجرام', desc: 'بوت خدمة ذاتية تفاعلي يزود الطلاب وأولياء الأمور بالجداول والدرجات والتبليغات فوراً.', icon: Bot, color: 'text-sky-600 bg-sky-100', highlight: true },
  ];

  const plans = [
    {
      title: 'باقة المعهد الأساسية',
      subtitle: 'للمعاهد الناشئة والمراكز التعليمية',
      price: '150,000',
      period: 'شهرياً',
      students: 'حتى 200 طالب مسجل',
      rating: '4.9',
      reviews: '48 تقييم',
      image: '/images/plan_basic.jpg',
      tag: 'تأسيسي',
      features: [
        'سجلات الطلاب والدرجات والغياب',
        'بوابة أولياء الأمور الأساسية',
        'إدارة الأقساط والتحصيل المالي',
        'إدارة الصفوف والمدرسين',
      ],
    },
    {
      title: 'باقة المدارس الاحترافية',
      subtitle: 'للمدارس والمعاهد المتوسطة والمتقدمة',
      price: '350,000',
      period: 'شهرياً',
      students: 'حتى 800 طالب مسجل',
      rating: '5.0',
      reviews: '124 تقييم',
      image: '/images/plan_pro.jpg',
      tag: 'الأكثر طلباً',
      highlighted: true,
      features: [
        'جميع ميزات الباقة الأساسية',
        'جدول الدروس الذكي وتوزيع الحصص',
        'تكامل إشعارات واتساب المباشرة',
        'نظام الامتحانات ونقاط التحفيز',
        'الكتب الرسمية وتقويم العطل',
      ],
    },
    {
      title: 'باقة المجمعات والمؤسسات',
      subtitle: 'للمؤسسات الكبرى والفروع المتعددة',
      price: '750,000',
      period: 'شهرياً',
      students: 'طلاب غير محدود',
      rating: '5.0',
      reviews: '86 تقييم',
      image: '/images/plan_enterprise.jpg',
      tag: 'مؤسسات',
      features: [
        'كافة الـ 14 ميزة المتقدمة للمنظومة',
        'تكامل الذكاء الاصطناعي (AI) والتحليلات',
        'تكامل بوت تيليجرام التفاعلي 24/7',
        'نظام مخصص بهوية وشعار المعهد لكل فرع',
        'دعم فني استشاري خاص ومباشر',
      ],
    },
  ];

  const team = [
    {
      name: 'د. أحمد الكرخي',
      role: 'مستشار التطوير التعليمي',
      color: 'bg-rose-100 text-rose-700',
      image: '/images/team_alkarkhi.jpg',
    },
    {
      name: 'م. سارة المهداوي',
      role: 'مهندسة النظم والبنية التقنية',
      color: 'bg-sky-100 text-sky-700',
      image: '/images/team_sara.jpg',
    },
    {
      name: 'أ. حيدر الزبيدي',
      role: 'خبير حماية وأمن المعلومات',
      color: 'bg-amber-100 text-amber-700',
      image: '/images/team_haidar.jpg',
    },
    {
      name: 'أ. عمر الراوي',
      role: 'مسؤول الأنظمة والدعم الفني',
      color: 'bg-emerald-100 text-emerald-700',
      image: '/images/team_omar.jpg',
    },
  ];

  const blogPosts = [
    {
      title: 'كيف تسهم بوابة أولياء الأمور في رفع انضباط الطلاب والتواصل الأسري؟',
      date: '11 تشرين الأول 2026',
      author: 'إدارة التعليم الرقمي',
      image: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'جدول الحصص الذكي: القضاء التام على تضارب الأوقات وتوزيع الحصص بسلاسة',
      date: '08 تشرين الأول 2026',
      author: 'فريق البرمجة والذكاء',
      image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'إشعارات الواتساب وبوت التيليجرام: مستقبل إشعار أولياء الأمور في العراق',
      date: '05 تشرين الأول 2026',
      author: 'القسم التقني والتكاملات',
      image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Top Contact Info Bar */}
      <div className="bg-blue-600 text-white text-xs py-2 px-4 border-b border-blue-700">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 opacity-90">
              <MapPin className="w-3.5 h-3.5" />
              <span>العراق — البصرة</span>
            </span>
            <a href="tel:07737777424" className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition" dir="ltr">
              <Phone className="w-3.5 h-3.5" />
              <span>07737777424</span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://wa.me/9647737777424" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>واتساب مباشر: 07737777424</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <School className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">FiStudy</span>
              <span className="block text-[11px] text-blue-600 font-bold -mt-1">المنظومة التعليمية الذكية</span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-bold text-slate-600">
            <a href="#hero" className="text-blue-600 hover:text-blue-700 transition">الرئيسية</a>
            <a href="#features" className="hover:text-blue-600 transition">كافة المميزات</a>
            <a href="#categories" className="hover:text-blue-600 transition">أقسام المنظومة</a>
            <a href="#about" className="hover:text-blue-600 transition">عن المنظومة</a>
            <a href="#pricing" className="hover:text-blue-600 transition">الباقات والأسعار</a>
            <a href="#team" className="hover:text-blue-600 transition">الكادر</a>
            <a href="#contact" className="hover:text-blue-600 transition">تواصل واستفسارات</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-blue-600 transition flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>دخول المعهد</span>
            </Link>
            <Link
              to="/platform/login"
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-600 transition hidden md:flex items-center gap-1"
            >
              <span>إدارة المنصة</span>
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>تسجيل معهد جديد</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 3. Hero Section */}
      <section id="hero" className="relative pt-16 pb-20 overflow-hidden bg-gradient-to-b from-blue-50/50 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left/Start Column: Text & Floating Feature Badges */}
            <div className="lg:col-span-7 text-right">
              {/* Feature Pill Highlights */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-extrabold flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> بوابة أولياء الأمور
                </span>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-extrabold flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> إشعارات واتساب
                </span>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-extrabold flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> جدول الحصص الذكي
                </span>
                <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-extrabold flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5" /> تكامل AI وبوت تيليجرام
                </span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-black text-slate-900 leading-[1.18] tracking-tight mb-5">
                إدارة المعاهد والمدارس <br />
                <span className="text-blue-600">بذكاء، استقلالية ودقة.</span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-xl mb-8 leading-relaxed">
                المنظومة التعليمية المتكاملة لإدارة شؤون الطلاب، الدرجات، الحضور، الأقساط، وجدول الحصص الذكي، مع صفحة خاصة لأولياء الأمور وتواصل فوري عبر الواتساب والتيليجرام.
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-10">
                <Link
                  to="/register"
                  className="px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-xl shadow-blue-600/25 transition-all duration-200"
                >
                  إنشاء حساب المعهد وبدء التجربة
                </Link>
                <a
                  href="#features"
                  className="px-6 py-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
                >
                  استكشف الـ 14 ميزة
                </a>
              </div>

              {/* Floating Filter Card */}
              <div className="bg-white p-5 rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-100 max-w-xl">
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-3 border-b border-slate-100 pb-2">
                  <span className="text-blue-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    حل شامل للمعاهد والمدارس
                  </span>
                  <span>•</span>
                  <span>أقساط ودفعات ميسرة</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full sm:w-1/3 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700">
                    نوع المؤسسة: معهد / مدرسة
                  </div>
                  <div className="w-full sm:w-1/2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-500">
                    بوابة أولياء الأمور، الجدول، واتساب...
                  </div>
                  <a
                    href="#features"
                    className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/30 text-center transition"
                  >
                    عرض الميزات
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-4 text-[11px] font-semibold text-slate-400">
                  <span className="text-slate-500 font-bold">الميزات الأبرز:</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-slate-600">بوابة الأولياء</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-slate-600">الجدول الذكي</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-slate-600">الأقساط المالية</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-slate-600">بوت تيليجرام</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-slate-600">إشعارات واتساب</span>
                </div>
              </div>
            </div>

            {/* Right/End Column: Student Photo + Circular Purple Halo + Floating Cards */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div className="absolute w-[360px] h-[360px] sm:w-[440px] sm:h-[440px] rounded-full bg-gradient-to-tr from-blue-600/15 via-indigo-500/10 to-transparent blur-xl pointer-events-none" />

              <div className="relative w-80 sm:w-96 rounded-[40px] overflow-hidden shadow-2xl border-4 border-white bg-white">
                <img
                  src="/images/hero_student.jpg"
                  alt="طالبة في المعهد"
                  className="w-full h-[460px] object-cover object-top"
                />

                {/* Floating Badge 1: Active Students */}
                <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">
                    +2.5K
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-800">طالب مسجل</span>
                    <span className="block text-[10px] text-slate-400">في أكثر من 20 معهداً</span>
                  </div>
                </div>

                {/* Floating Badge 2: Certified Isolation System */}
                <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-black text-slate-800">تكامل واتساب وAI فوري</span>
                    <span className="block text-[11px] text-slate-500">إشعارات لحظية لأولياء الأمور</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Numbers & Stats Counter Ticker */}
      <section className="bg-blue-600 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-blue-500/50">
            <div className="pt-3 md:pt-0">
              <span className="block text-3xl font-black">14+</span>
              <span className="text-xs font-medium text-blue-100">ميزة شاملة للمعاهد والمدارس</span>
            </div>
            <div className="pt-3 md:pt-0">
              <span className="block text-3xl font-black">100%</span>
              <span className="text-xs font-medium text-blue-100">جدولة ذكية بدون تضارب</span>
            </div>
            <div className="pt-3 md:pt-0">
              <span className="block text-3xl font-black">24/7</span>
              <span className="text-xs font-medium text-blue-100">بوابة أولياء الأمور وبوت تيليجرام</span>
            </div>
            <div className="pt-3 md:pt-0">
              <span className="block text-3xl font-black">100%</span>
              <span className="text-xs font-medium text-blue-100">إدارة الأقساط والتحصيل المالي</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. ALL 14 CORE FEATURES SHOWCASE GRID */}
      <section id="features" className="py-24 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-2">
              باقة إمكانيات المنظومة الشاملة
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
              14 ميزة رئيسية <span className="text-blue-600">صُممت خصيصاً لإدارة مؤسستك</span>
            </h2>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
              كل ما يحتاجه المعهد والمدرسة من تسجيل الطلاب وحتى وصول الإشعارات لهواتف أولياء الأمور عبر الواتساب والتيليجرام.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allFourteenFeatures.map((f, idx) => {
              const IconComp = f.icon;
              return (
                <div
                  key={idx}
                  className={`p-6 rounded-3xl border transition-all duration-200 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden ${
                    f.highlight
                      ? 'bg-gradient-to-br from-blue-50/60 to-white border-blue-200 shadow-md shadow-blue-500/5'
                      : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  {f.highlight && (
                    <span className="absolute top-4 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white">
                      ميزة ذكية
                    </span>
                  )}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${f.color}`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 6. Browse Categories Section (Interactive Pillars with Detailed Views) */}
      <section id="categories" className="py-20 bg-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Category Pillars Tabs */}
            <div className="lg:col-span-7">
              <span className="text-xs font-black text-blue-200 uppercase tracking-widest block mb-2">أركان المنظومة</span>
              <h2 className="text-3xl sm:text-4xl font-black mb-8 leading-tight">
                استكشف أقسام المنظومة بالتفصيل <br />
                <span className="text-blue-200">لتجربة إدارية وتعليمية استثنائية</span>
              </h2>

              <div className="space-y-3">
                {featureCategories.map((cat, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveCategory(idx)}
                    className={`cursor-pointer p-4 rounded-2xl flex items-center justify-between transition-all duration-200 border ${
                      activeCategory === idx
                        ? 'bg-blue-800 border-blue-400 shadow-lg text-white'
                        : 'bg-blue-650/40 border-blue-500/20 hover:bg-blue-600 text-blue-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base">{cat.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500 text-white font-bold">{cat.tag}</span>
                      </div>
                      <span className="block text-xs text-blue-200 mt-1">{cat.description}</span>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform ${activeCategory === idx ? 'bg-white text-blue-700 rotate-90' : 'bg-blue-500'}`}>
                      <ArrowLeft className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Pillar Details Card */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full bg-blue-800/90 backdrop-blur-md rounded-3xl p-6 border-2 border-blue-400/40 shadow-2xl text-right">
                <div className="flex items-center justify-between pb-4 border-b border-blue-600/60 mb-5">
                  <span className="text-xs font-black text-blue-200 uppercase tracking-wider">تفاصيل القسم المحدد</span>
                  <span className="px-2.5 py-1 rounded-full bg-blue-500 text-white text-[10px] font-black">
                    {featureCategories[activeCategory].tag}
                  </span>
                </div>
                
                <h3 className="text-xl font-black text-white mb-2">
                  {featureCategories[activeCategory].title}
                </h3>
                <p className="text-xs text-blue-100 mb-6 leading-relaxed">
                  {featureCategories[activeCategory].description}
                </p>

                <div className="space-y-3.5">
                  {featureCategories[activeCategory].features.map((feat, fIdx) => {
                    const FeatIcon = feat.icon;
                    return (
                      <div key={fIdx} className="bg-blue-900/60 p-3.5 rounded-2xl border border-blue-500/30 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <FeatIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{feat.name}</span>
                            {feat.badge && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-blue-950">
                                {feat.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-blue-200 block mt-0.5 leading-relaxed">
                            {feat.desc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. About Story Section */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            {/* Visual Photo Composition */}
            <div className="lg:col-span-6 relative">
              <div className="grid grid-cols-2 gap-4">
                <img
                  src="/images/about_campus.jpg"
                  alt="مجمع ومبنى مدرسي"
                  className="w-full h-64 object-cover rounded-3xl shadow-lg"
                />
                <img
                  src="/images/about_classroom.jpg"
                  alt="قاعة دراسية ذكية"
                  className="w-full h-64 object-cover rounded-3xl shadow-lg mt-8"
                />
              </div>

              {/* Floating Stat Badge */}
              <div className="absolute -bottom-6 right-10 bg-blue-600 text-white p-5 rounded-3xl shadow-xl text-center">
                <span className="block text-3xl font-black">45+</span>
                <span className="text-xs font-bold text-blue-100">معهد متميز يعتمدنا</span>
              </div>
            </div>

            {/* Content Column */}
            <div className="lg:col-span-6 text-right">
              <span className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-2">عن المنظومة</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-6 leading-tight">
                قصتنا: بنيت على القيم، <br />
                <span className="text-blue-600">ومدفوعة بالابتكار التعليمي</span>
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-8">
                نحن مكرسون لتمكين المعاهد والمدارس في العراق عبر منظومة ذكية متطورة توفر حلاً شاملاً يجمع بين الحسابات والأقساط، إدارة الصفوف والامتحانات، وراحة تامة لإدارة المعهد وأولياء الأمور.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-100">
                  <h4 className="font-extrabold text-blue-900 text-sm mb-2">رسالتنا</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    تمكين المدارس والمعاهد بحلول تقنية متكاملة تريح الإدارة وتبقي أولياء الأمور في قلب الحدث لحظياً.
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                  <h4 className="font-extrabold text-indigo-900 text-sm mb-2">رؤيتنا</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    أن نكون المنظومة التعليمية الأكثر موثوقية وتميزاً في العراق، المدعومة بالذكاء الاصطناعي وجداول الحصص الذكية.
                  </p>
                </div>
              </div>

              <a
                href="#pricing"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition"
              >
                <span>اعرف أكثر عن الباقات والأسعار</span>
                <ArrowLeft className="w-4 h-4" />
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* 8. Plans / Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-2">باقات الاشتراك</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
              أكثر من مجرد منصة: <span className="text-blue-600">رحلة من التميز والنجاح</span>
            </h2>
            <p className="text-slate-500 text-sm">
              اختر الخطة المناسبة لحجم معهدك أو مدرستك دون أي رسوم خفية.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {livePlans.length > 0 ? (
              livePlans.map((lp, idx) => {
                const defaultImages = [
                  '/images/plan_basic.jpg',
                  '/images/plan_pro.jpg',
                  '/images/plan_enterprise.jpg',
                ];
                const planImage = lp.image_url && lp.image_url.trim() !== ''
                  ? lp.image_url
                  : defaultImages[idx % defaultImages.length];

                return (
                  <div
                    key={lp.id || idx}
                    className={`bg-white rounded-3xl p-6 border transition-all duration-200 flex flex-col justify-between ${
                      lp.is_popular
                        ? 'border-blue-600 shadow-2xl ring-2 ring-blue-600/20 relative scale-105 z-10'
                        : 'border-slate-200 shadow-md hover:shadow-lg'
                    }`}
                  >
                    <div>
                      {/* Plan Image with floating Tag and Free Trial Badge */}
                      <div className="relative h-44 rounded-2xl overflow-hidden mb-5 bg-slate-100">
                        <img
                          src={planImage}
                          alt={lp.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = defaultImages[idx % defaultImages.length];
                          }}
                        />
                        <span className="absolute top-3 right-3 px-3 py-1 bg-slate-900/80 text-white text-[11px] font-bold rounded-lg backdrop-blur-sm">
                          {lp.is_popular ? 'الأكثر طلباً' : idx === 0 ? 'تأسيسي' : idx === 1 ? 'احترافي' : 'مؤسسات'}
                        </span>
                        <span className="absolute bottom-3 left-3 px-2.5 py-1 bg-emerald-600/90 text-white text-[10px] font-bold rounded-md backdrop-blur-sm shadow-xs">
                          14 يوم تجربة مجانية
                        </span>
                      </div>

                      <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="font-bold text-blue-600">
                          حتى {lp.max_students.toLocaleString()} طالب
                        </span>
                        <span className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          <span>5.0 (تقييم ممتاز)</span>
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-slate-900 mb-1">{lp.name}</h3>
                      <p className="text-xs text-slate-500 mb-5 leading-relaxed min-h-[32px]">
                        {lp.description || 'باقة متكاملة لإدارة شؤون المعهد والطلاب والكوادر بكل كفاءة'}
                      </p>

                    {(() => {
                      const customFeatures = parsePlanFeatures(lp.features);
                      return (
                        <div className="space-y-2.5 mb-6 border-t border-slate-100 pt-4">
                          <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>سعة حتى <strong className="text-slate-900 font-bold">{lp.max_students.toLocaleString()}</strong> طالب مسجل</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>حتى <strong className="text-slate-900 font-bold">{lp.max_teachers}</strong> مدرسين وأعضاء كادر</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>إدارة حتى <strong className="text-slate-900 font-bold">{lp.max_branches}</strong> مقرات وفروع</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>دومين ولوحة تحكم مخصصة للمعهد</span>
                          </div>
                          {customFeatures.map((feat, fIdx) => (
                            <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="border-t border-slate-100 pt-5">
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        <span className="text-3xl font-black text-slate-900">
                          {Number(lp.price_iqd).toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500 font-bold mr-1">
                          د.ع / {(lp.billing_cycle || lp.billing_period) === 'yearly' ? 'سنوي' : 'شهري'}
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/register?plan_id=${lp.id}`}
                      className={`w-full py-3.5 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 ${
                        lp.is_popular
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'
                          : 'bg-slate-900 hover:bg-black text-white'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>اشتراك وبدء التجربة الفورية</span>
                    </Link>
                  </div>
                </div>
              );
            })
            ) : (
              plans.map((p, idx) => (
                <div
                  key={idx}
                  className={`bg-white rounded-3xl p-6 border transition-all duration-200 flex flex-col justify-between ${
                    p.highlighted
                      ? 'border-blue-600 shadow-2xl ring-2 ring-blue-600/20 relative scale-105 z-10'
                      : 'border-slate-200 shadow-md hover:shadow-lg'
                  }`}
                >
                  <div>
                    <div className="relative h-44 rounded-2xl overflow-hidden mb-6">
                      <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                      <span className="absolute top-3 right-3 px-3 py-1 bg-slate-900/80 text-white text-[11px] font-bold rounded-lg backdrop-blur-sm">
                        {p.tag}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="font-bold text-blue-600">{p.students}</span>
                      <span className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-500" />
                        <span>{p.rating} ({p.reviews})</span>
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 mb-1">{p.title}</h3>
                    <p className="text-xs text-slate-500 mb-6">{p.subtitle}</p>

                    <div className="space-y-2 mb-6 border-t border-slate-100 pt-4">
                      {p.features.map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-5">
                    <div className="flex items-baseline justify-between mb-4">
                      <div>
                        <span className="text-3xl font-black text-slate-900">{p.price}</span>
                        <span className="text-xs text-slate-500 font-bold mr-1">د.ع / {p.period}</span>
                      </div>
                    </div>

                    <Link
                      to="/register"
                      className={`w-full py-3.5 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 ${
                        p.highlighted
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'
                          : 'bg-slate-900 hover:bg-black text-white'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>اشتراك وبدء التجربة الفورية</span>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </section>

      {/* 9. Team Section */}
      <section id="team" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-2">الكادر الاستشاري</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              تعرّف على الخبراء الملتزمين <span className="text-blue-600">بنجاحك</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {team.map((m, idx) => (
              <div key={idx} className="text-center p-6 rounded-3xl bg-slate-50/70 border border-slate-100 hover:shadow-lg transition">
                <img
                  src={m.image}
                  alt={m.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full object-cover mb-4 ring-4 ring-white shadow-md"
                />
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 mb-1">{m.name}</h4>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${m.color}`}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 10. Newsletter Banner */}
      <section className="py-12 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 rounded-3xl p-8 sm:p-12 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-right max-w-md">
              <h3 className="text-2xl sm:text-3xl font-black mb-2">اشترك في نشرتنا وتحديثات المنظومة</h3>
              <p className="text-xs sm:text-sm text-orange-100">
                احصل على نصائح التحول الرقمي وأحدث الميزات وترقيات المعاهد والمدارس في العراق.
              </p>
            </div>
            <div className="w-full md:w-auto flex-1 max-w-md">
              <form onSubmit={(e) => { e.preventDefault(); alert('تم تسجيل بريدك بنجاح في نشرة التحديثات!'); }} className="flex items-center bg-white rounded-full p-1.5 shadow-lg">
                <input
                  type="email"
                  dir="ltr"
                  placeholder="name@example.com"
                  className="w-full px-4 py-2 text-xs text-slate-800 placeholder-slate-400 bg-transparent outline-none rounded-full"
                  required
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition"
                >
                  اشترك
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* 11. Testimonials Section */}
      <section id="testimonials" className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-2">آراء العملاء</span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-12">
            استكشف آراء مدراء المعاهد <span className="text-blue-600">المشتركين معنا</span>
          </h2>

          <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-xl border border-slate-100 relative">
            <img
              src="/images/manager_shamari.jpg"
              alt="أ. محمد الشمري"
              className="w-16 h-16 rounded-full mx-auto mb-4 object-cover ring-4 ring-blue-50"
            />
            <div className="flex justify-center gap-1 text-amber-400 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <blockquote className="text-sm sm:text-base text-slate-700 font-medium leading-relaxed mb-6 max-w-2xl mx-auto">
              "وفرت لنا منصة FiStudy راحة غير مسبوقة في إدارة المعهد؛ بوابة أولياء الأمور وتكامل الواتساب المباشر أراح الكادر تماماً من الاتصالات، وجدول الحصص الذكي ينظم يومنا بدون أي تضارب."
            </blockquote>
            <cite className="not-italic">
              <span className="block font-black text-sm text-slate-900">أ. محمد الشمري</span>
              <span className="block text-xs text-blue-600 font-semibold">مدير معهد النور للغات والعلوم — بغداد</span>
            </cite>
          </div>
        </div>
      </section>

      {/* 12. Live Interactive Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900">
              <img
                src="https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=800&q=80"
                alt="Live Classroom Preview"
                className="w-full h-80 sm:h-96 object-cover opacity-80"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => alert('معاينة النظام التجريبي: تواصل مع فريق المبيعات للحصول على رابط تجربة فوري!')}
                  className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition duration-200"
                >
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 text-right">
              <span className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-2">تكاملات ذكية ومباشرة</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-6 leading-tight">
                اربط معهدك بالواتساب والذكاء <br />
                <span className="text-blue-600">وتحقق من راحة أولياء الأمور</span>
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                لا مزيد من الاتصالات الهاتفية المرهقة. المنظومة ترسل إشعارات الحضور والغياب والدرجات والأقساط مباشرة إلى هواتف أولياء الأمور عبر الواتساب وبوت التيليجرام بشكل آلي بالكامل.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-extrabold flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> إشعارات واتساب فورية
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-extrabold flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" /> بوت تيليجرام 24/7
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-xs font-extrabold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> ذكاء اصطناعي تحليلي
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 13. Blog Section */}
      <section className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-2">المدونة التعليمية</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              رؤى وأفكار <span className="text-blue-600">لإدارة المعاهد الحديثة</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {blogPosts.map((b, idx) => (
              <div key={idx} className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg transition">
                <img src={b.image} alt={b.title} className="w-full h-44 object-cover" />
                <div className="p-6 text-right">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{b.date}</span>
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 mb-4 line-clamp-2 leading-snug">
                    {b.title}
                  </h4>
                  <span className="text-xs font-bold text-blue-600 hover:text-blue-700 transition inline-block">
                    {b.author}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 14. Contact Form Section */}
      <section id="contact" className="py-20 bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-5 flex justify-center">
              <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-50 max-w-sm">
                <img
                  src="/images/consultant_contact.jpg"
                  alt="استشاري التسجيل"
                  className="w-full h-96 object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 text-right">
              {/* Instant Registration Highlight Banner */}
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-white">جاهز لإنشاء حساب معهدك وبدء التجربة؟</h4>
                    <p className="text-xs text-blue-200 mt-0.5">أنشئ حساب معهدك واحصل على دومينك ولوحة تحكمك فوراً</p>
                  </div>
                </div>
                <Link
                  to="/register"
                  className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-black text-xs transition shadow-md shrink-0"
                >
                  إنشاء حساب المعهد الآن
                </Link>
              </div>

              <span className="text-xs font-black text-blue-600 uppercase tracking-widest block mb-2">تواصل واستفسارات</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
                هل لديك استفسار؟ <span className="text-blue-600">فريقنا بخدمتك دائماً</span>
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 mb-6 bg-blue-50/70 p-4 rounded-2xl border border-blue-100">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>العنوان: {cmsSettings.platform_address || 'العراق — البصرة'}</span>
                </span>
                <span className="text-slate-300">•</span>
                <a href={`tel:${cmsSettings.platform_phone || '07737777424'}`} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition" dir="ltr">
                  <Phone className="w-4 h-4" />
                  <span>{cmsSettings.platform_phone || '07737777424'}</span>
                </a>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mb-6 leading-relaxed">
                املأ الاستمارة وسيتواصل معك المهندس المختص هاتفياً لتحديد موعد الاستشارة أو إعداد وتهيئة نظام معهدك والبدء فوراً.
              </p>

              {inquirySuccess ? (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-right space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>تم استلام طلبكم بنجاح!</span>
                  </div>
                  <p className="text-xs text-emerald-600 font-medium">
                    شكراً لتواصلكم مع منصة FiStudy. تم تسجيل الطلب لدى إدارة المنصة وسيتواصل معكم فريق الدعم والاستشارات هاتفياً في أقرب وقت.
                  </p>
                  <button
                    type="button"
                    onClick={() => setInquirySuccess(false)}
                    className="mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
                  >
                    إرسال طلب آخر
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  {inquiryError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                      {inquiryError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="الاسم الكامل"
                      value={inquiryForm.fullName}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, fullName: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 outline-none focus:border-blue-600 font-medium"
                      required
                    />
                    <input
                      type="tel"
                      dir="ltr"
                      placeholder="رقم الهاتف (مثال: 07737777424)"
                      value={inquiryForm.phone}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 outline-none focus:border-blue-600 font-medium"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="اسم المعهد أو المدرسة"
                      value={inquiryForm.instituteName}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, instituteName: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 outline-none focus:border-blue-600 font-medium"
                      required
                    />
                    <select
                      value={inquiryForm.requestType}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, requestType: e.target.value as any })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 outline-none focus:border-blue-600 font-bold"
                    >
                      <option value="consultation">نوع الطلب: استشارة مجانية</option>
                      <option value="booking">نوع الطلب: حجز واشتراك فوري</option>
                      <option value="demo">نوع الطلب: تجربة المنظومة ومعاينة</option>
                    </select>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="ملاحظات أو استفسارات إضافية (عدد الطلاب المتوقع، الفرع، إلخ)..."
                    value={inquiryForm.notes}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, notes: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 outline-none focus:border-blue-600 resize-none font-medium"
                  />
                  <button
                    type="submit"
                    disabled={inquiryLoading}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2"
                  >
                    {inquiryLoading ? (
                      <span>جاري الإرسال...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال طلب الاستشارة أو الحجز</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* 15. Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black">
                <School className="w-5 h-5" />
              </div>
              <span className="text-lg font-black text-white">FiStudy — المنظومة التعليمية الذكية</span>
            </div>
            <div className="flex items-center gap-6 font-semibold">
              <a href="#features" className="hover:text-white transition">المميزات (14 ميزة)</a>
              <a href="#about" className="hover:text-white transition">عن المنظومة</a>
              <a href="#pricing" className="hover:text-white transition">الباقات والأسعار</a>
              <a href="#contact" className="hover:text-white transition">طلب استشارة أو حجز</a>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
            <div className="flex items-center gap-2">
              <span>منصة FiStudy لإدارة المعاهد والمدارس © 2026.</span>
              <span className="text-slate-700">•</span>
              <span className="text-slate-400 font-medium">العراق — البصرة</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-slate-300">
              <span>تطوير مهندس مصطفى</span>
              <span className="text-slate-600">•</span>
              <a href="tel:07737777424" dir="ltr" className="text-blue-400 hover:text-white transition">07737777424</a>
            </div>
            <span>خدمة ودعم فني مباشر على مدار الساعة</span>
          </div>
        </div>
      </footer>

      {/* 16. Self-Registration & Institute Onboarding Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </div>
                  <h3 className="text-lg font-black">بدء تجربة المنظومة وإنشاء حساب المعهد</h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  14 يوماً مجاناً • دومين مخصص • لوحة تحكم فورية
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Plan Summary Banner */}
            {selectedPlan && (
              <div className="bg-blue-50/70 border-b border-blue-100 px-6 py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="font-bold text-blue-900">الباقة المختارة:</span>
                  <span className="font-black text-blue-700 bg-white px-2.5 py-0.5 rounded-md border border-blue-200">
                    {selectedPlan.name}
                  </span>
                  <span className="text-slate-500">
                    ({Number(selectedPlan.price_iqd).toLocaleString()} د.ع / {(selectedPlan.billing_cycle || selectedPlan.billing_period) === 'yearly' ? 'سنوي' : 'شهري'})
                  </span>
                </div>
                <span className="font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  تجريبي لمدة 14 يوماً
                </span>
              </div>
            )}

            <div className="p-6">
              {registeredResult ? (
                /* Success State */
                <div className="py-6 text-center space-y-5">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900">تم إنشاء معهدك وحسابك بنجاح!</h4>
                    <p className="text-sm text-slate-500 mt-1">
                      حالة الاشتراك: <strong className="text-amber-600 font-bold">قيد التجربة (Trialing) لمدة 14 يوماً</strong>
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-right space-y-2 max-w-lg mx-auto">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">اسم المعهد:</span>
                      <span className="font-black text-slate-900">{registeredResult.tenant?.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">الرابط المخصص للمعهد:</span>
                      <a
                        href={registeredResult.redirect_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-blue-600 hover:underline flex items-center gap-1 dir-ltr"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{registeredResult.redirect_url}</span>
                      </a>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">البريد الإلكتروني للإدارة:</span>
                      <span className="font-bold text-slate-800">{registeredResult.admin?.email}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    تم إنشاء لوحة التحكم الخاصة بمعهدك بنجاح. يمكنك الآن الدخول وتخصيص بياناتك، وستقوم إدارة المنصة بمراجعة وتفعيل اشتراكك رسمياً.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <a
                      href={registeredResult.redirect_url}
                      className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
                    >
                      <span>الدخول إلى لوحة تحكم المعهد الآن</span>
                      <ArrowLeft className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowRegisterModal(false)}
                      className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              ) : (
                /* Registration Form */
                <form onSubmit={handleSelfRegisterSubmit} className="space-y-4">
                  {registerError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                      {registerError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        اسم المعهد / المؤسسة <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: معهد الأوائل النموذجي"
                        value={registerForm.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegisterForm((prev) => ({
                            ...prev,
                            name: val,
                            // auto slug suggestion if slug is pristine
                            slug: prev.slug === '' ? val.toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/^-|-$/g, '') : prev.slug,
                          }));
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        معرف الرابط اللاتيني (Slug) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        dir="ltr"
                        placeholder="alawael"
                        value={registerForm.slug}
                        onChange={(e) =>
                          setRegisterForm({ ...registerForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-left"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 font-mono" dir="ltr">
                        رابطك: http://{registerForm.slug || 'slug'}.localhost:8080
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رقم هاتف المعهد <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        placeholder="077XXXXXXXX"
                        value={registerForm.phone}
                        onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-left"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        المحافظة / العنوان
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: البصرة — المعقل"
                        value={registerForm.address}
                        onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-[11px] font-black text-blue-600 uppercase tracking-wider block mb-3">
                      بيانات حساب مدير المعهد (المؤسس)
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          اسم المدير <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="الاسم الكامل"
                          value={registerForm.admin_name}
                          onChange={(e) => setRegisterForm({ ...registerForm, admin_name: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          البريد الإلكتروني <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          dir="ltr"
                          placeholder="admin@institute.iq"
                          value={registerForm.admin_email}
                          onChange={(e) => setRegisterForm({ ...registerForm, admin_email: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-left"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          كلمة المرور <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={registerForm.admin_password}
                          onChange={(e) => setRegisterForm({ ...registerForm, admin_password: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={registerLoading}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {registerLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>جاري تهيئة المعهد والدومين...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تأكيد إنشاء المعهد وبدء التجربة المجانية</span>
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-slate-400 text-center mt-2">
                      بالتسجيل، ستحصل على فترة تجريبية مجانية لمدة 14 يوماً مع كافة صلاحيات الباقة المختارة.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
