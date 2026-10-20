import React, { useState, useEffect } from 'react';
import { apiRequest, getAuthToken } from '../api/client';
import {
  Tenant,
  Plan,
  Subscription,
  PaymentReceipt,
  Domain,
  AuditLog,
  LandingInquiry,
  SupportTicket,
  PlatformSetting,
} from '../types';
import { ErrorAlert, LoadingSpinner, EmptyState } from '../components/common';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { PRESET_PLAN_FEATURES, parsePlanFeatures, serializePlanFeatures } from '../lib/planFeatures';

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
  Separator,
} from '@/components/ui';

// Lucide Icons
import {
  School,
  CreditCard,
  Receipt,
  Globe,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ShieldCheck,
  ExternalLink,
  Edit2,
  Palette,
  Calendar,
  RotateCw,
  XCircle,
  Eye,
  DollarSign,
  Printer,
  MessageSquare,
  LifeBuoy,
  Sliders,
  Reply,
  Sparkles,
  Save,
  Check,
  Trash2,
  Tag,
  X,
  Upload,
  Image,
  ArrowRight,
} from 'lucide-react';

export const PlatformDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'institutes' | 'plans' | 'subscriptions' | 'receipts' | 'inquiries' | 'support' | 'cms' | 'domains' | 'audit'
  >('institutes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  // Data states
  const [institutes, setInstitutes] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [inquiries, setInquiries] = useState<LandingInquiry[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [settings, setSettings] = useState<PlatformSetting[]>([]);

  // CMS Settings form state
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [saveSettingsLoading, setSaveSettingsLoading] = useState(false);

  // Inquiry Conversion Modal state
  const [convertingInquiry, setConvertingInquiry] = useState<LandingInquiry | null>(null);
  const [convertForm, setConvertForm] = useState({
    slug: '',
    admin_email: '',
    admin_password: '',
  });
  const [convertLoading, setConvertLoading] = useState(false);

  // Support Ticket Reply Modal state
  const [replyingTicket, setReplyingTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<string>('resolved');
  const [replyLoading, setReplyLoading] = useState(false);

  // Creation modal states
  const [showCreateInstitute, setShowCreateInstitute] = useState(false);
  const [createInstLoading, setCreateInstLoading] = useState(false);
  const [instForm, setInstForm] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '#4f46e5',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  // Edit institute modal states
  const [showEditInstitute, setShowEditInstitute] = useState(false);
  const [editInstLoading, setEditInstLoading] = useState(false);
  const [editInstForm, setEditInstForm] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '#4f46e5',
  });

  // Plan management states (in-page view mode: list | create | edit)
  const [planViewMode, setPlanViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [createPlanLoading, setCreatePlanLoading] = useState(false);
  const [createPlanFeatures, setCreatePlanFeatures] = useState<string[]>([
    'تطبيق ولي الأمر للهواتف (iOS / Android)',
    'إشعارات WhatsApp ورسائل SMS تلقائية للغياب والدرجات',
    'نظام الحضور والغياب والبصمة الذكي',
    'إدارة الرسوم والأقساط وطباعة الوصولات المالية',
  ]);
  const [createFeatureInput, setCreateFeatureInput] = useState('');
  const [planForm, setPlanForm] = useState({
    name: '',
    slug: '',
    description: '',
    price_iqd: 50000,
    billing_cycle: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    max_students: 100,
    max_teachers: 10,
    max_branches: 1,
    image_url: '/images/plan_basic.jpg',
    is_active: true,
  });

  // Plan editing states
  const [editPlanLoading, setEditPlanLoading] = useState(false);
  const [editPlanFeatures, setEditPlanFeatures] = useState<string[]>([]);
  const [editFeatureInput, setEditFeatureInput] = useState('');
  const [editPlanForm, setEditPlanForm] = useState<{
    id: string;
    name: string;
    description: string;
    price_iqd: number;
    billing_cycle: string;
    max_students: number;
    max_teachers: number;
    max_branches: number;
    features: string;
    image_url: string;
    is_active: boolean;
  }>({
    id: '',
    name: '',
    description: '',
    price_iqd: 0,
    billing_cycle: 'monthly',
    max_students: 100,
    max_teachers: 10,
    max_branches: 1,
    features: '',
    image_url: '/images/plan_basic.jpg',
    is_active: true,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Subscription management states
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [createSubLoading, setCreateSubLoading] = useState(false);
  const [subForm, setSubForm] = useState({
    tenant_id: '',
    plan_id: '',
    duration_days: 30,
  });

  // Change Plan states
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [changePlanLoading, setChangePlanLoading] = useState(false);
  const [changePlanSub, setChangePlanSub] = useState<Subscription | null>(null);
  const [selectedNewPlanId, setSelectedNewPlanId] = useState('');

  // Payment Recording states
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [recordPaymentLoading, setRecordPaymentLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    tenant_id: '',
    subscription_id: '',
    amount_iqd: 50000,
    payment_method: 'cash',
    reference_note: '',
  });

  // Receipt viewing modal
  const [viewingReceipt, setViewingReceipt] = useState<PaymentReceipt | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [instRes, plansRes, subsRes, receiptsRes, domainsRes, auditRes, inqRes, ticketsRes, settingsRes] = await Promise.all([
        apiRequest<{ success: boolean; data: Tenant[] }>('/api/v1/platform/institutes').catch(() => null),
        apiRequest<{ success: boolean; data: Plan[] }>('/api/v1/platform/plans').catch(() => null),
        apiRequest<{ success: boolean; data: Subscription[] }>('/api/v1/platform/subscriptions').catch(() => null),
        apiRequest<{ success: boolean; data: PaymentReceipt[] }>('/api/v1/platform/receipts').catch(() => null),
        apiRequest<{ success: boolean; data: Domain[] }>('/api/v1/platform/domains').catch(() => null),
        apiRequest<{ success: boolean; data: AuditLog[] }>('/api/v1/platform/audit-logs').catch(() => null),
        apiRequest<{ success: boolean; data: LandingInquiry[] }>('/api/v1/platform/inquiries').catch(() => null),
        apiRequest<{ success: boolean; data: SupportTicket[] }>('/api/v1/platform/support/tickets').catch(() => null),
        apiRequest<{ success: boolean; data: PlatformSetting[] }>('/api/v1/platform/settings').catch(() => null),
      ]);

      setInstitutes(instRes?.data || []);
      setPlans(plansRes?.data || []);
      setSubscriptions(subsRes?.data || []);
      setReceipts(receiptsRes?.data || []);
      setDomains(domainsRes?.data || []);
      setAuditLogs(auditRes?.data || []);
      setInquiries(inqRes?.data || []);
      setSupportTickets(ticketsRes?.data || []);
      const loadedSettings = settingsRes?.data || [];
      setSettings(loadedSettings);
      const sMap: Record<string, string> = {};
      loadedSettings.forEach((s) => {
        sMap[s.key] = s.value;
      });
      setSettingsForm(sMap);
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateInstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateInstLoading(true);
    setError(null);

    try {
      await apiRequest('/api/v1/platform/institutes', {
        method: 'POST',
        body: JSON.stringify({
          ...instForm,
          logo_url: instForm.logo_url || undefined,
          favicon_url: instForm.favicon_url || undefined,
          primary_color: instForm.primary_color || undefined,
        }),
      });
      setShowCreateInstitute(false);
      setInstForm({
        name: '',
        slug: '',
        email: '',
        phone: '',
        address: '',
        logo_url: '',
        favicon_url: '',
        primary_color: '#4f46e5',
        admin_name: '',
        admin_email: '',
        admin_password: '',
      });
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setCreateInstLoading(false);
    }
  };

  const handleOpenEditInstitute = (inst: Tenant) => {
    setEditInstForm({
      id: inst.id,
      name: inst.name,
      email: inst.email || '',
      phone: inst.phone || '',
      address: inst.address || '',
      logo_url: inst.logo_url || '',
      favicon_url: inst.favicon_url || '',
      primary_color: inst.primary_color || '#4f46e5',
    });
    setShowEditInstitute(true);
  };

  const handleUpdateInstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditInstLoading(true);
    setError(null);

    try {
      await apiRequest(`/api/v1/platform/institutes/${editInstForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editInstForm.name,
          email: editInstForm.email || undefined,
          phone: editInstForm.phone || undefined,
          address: editInstForm.address || undefined,
          logo_url: editInstForm.logo_url || undefined,
          favicon_url: editInstForm.favicon_url || undefined,
          primary_color: editInstForm.primary_color || undefined,
        }),
      });
      setShowEditInstitute(false);
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setEditInstLoading(false);
    }
  };

  const handleStatusChange = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await apiRequest(`/api/v1/platform/institutes/${tenantId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatePlanLoading(true);
    setError(null);
    try {
      await apiRequest('/api/v1/platform/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: planForm.name.trim(),
          slug: planForm.slug.trim(),
          description: planForm.description.trim(),
          price_iqd: Number(planForm.price_iqd),
          billing_cycle: planForm.billing_cycle,
          max_students: Number(planForm.max_students),
          max_teachers: Number(planForm.max_teachers),
          max_branches: Number(planForm.max_branches),
          features: serializePlanFeatures(createPlanFeatures),
          image_url: planForm.image_url.trim(),
        }),
      });
      setPlanViewMode('list');
      setPlanForm({
        name: '',
        slug: '',
        description: '',
        price_iqd: 50000,
        billing_cycle: 'monthly',
        max_students: 100,
        max_teachers: 10,
        max_branches: 1,
        image_url: '/images/plan_basic.jpg',
        is_active: true,
      });
      setCreatePlanFeatures([
        'تطبيق ولي الأمر للهواتف (iOS / Android)',
        'إشعارات WhatsApp ورسائل SMS تلقائية للغياب والدرجات',
        'نظام الحضور والغياب والبصمة الذكي',
        'إدارة الرسوم والأقساط وطباعة الوصولات المالية',
      ]);
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setCreatePlanLoading(false);
    }
  };

  const handleOpenEditPlan = (p: Plan) => {
    const parsed = parsePlanFeatures(p.features);
    setEditPlanFeatures(parsed);
    setEditFeatureInput('');
    setEditPlanForm({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price_iqd: p.price_iqd,
      billing_cycle: p.billing_cycle,
      max_students: p.max_students,
      max_teachers: p.max_teachers,
      max_branches: p.max_branches,
      features: p.features || '',
      image_url: p.image_url || '/images/plan_basic.jpg',
      is_active: p.is_active,
    });
    setPlanViewMode('edit');
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditPlanLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/platform/plans/${editPlanForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editPlanForm.name.trim(),
          description: editPlanForm.description.trim(),
          price_iqd: Number(editPlanForm.price_iqd),
          billing_cycle: editPlanForm.billing_cycle,
          max_students: Number(editPlanForm.max_students),
          max_teachers: Number(editPlanForm.max_teachers),
          max_branches: Number(editPlanForm.max_branches),
          features: serializePlanFeatures(editPlanFeatures),
          image_url: editPlanForm.image_url.trim(),
          is_active: editPlanForm.is_active,
        }),
      });
      setPlanViewMode('list');
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setEditPlanLoading(false);
    }
  };

  const handleUploadPlanImage = async (file: File, isEdit: boolean) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = getAuthToken() || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/v1/platform/plans/upload-image', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || 'فشل رفع الصورة');
      }
      if (isEdit) {
        setEditPlanForm((prev) => ({ ...prev, image_url: data.url }));
      } else {
        setPlanForm((prev) => ({ ...prev, image_url: data.url }));
      }
    } catch (err: any) {
      alert(err.message || 'فشل رفع الصورة من الجهاز');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTogglePlanStatus = async (planId: string) => {
    try {
      await apiRequest(`/api/v1/platform/plans/${planId}/status`, { method: 'PUT' });
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message || 'فشل تغيير حالة الباقة', requestId: err.requestId });
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف باقة "${planName}"؟ لن تظهر في صفحة الهبوط أو التسجيل.`)) {
      return;
    }
    try {
      await apiRequest(`/api/v1/platform/plans/${planId}`, { method: 'DELETE' });
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message || 'فشل حذف الباقة', requestId: err.requestId });
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubLoading(true);
    setError(null);
    try {
      await apiRequest('/api/v1/platform/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: subForm.tenant_id,
          plan_id: subForm.plan_id,
          duration_days: Number(subForm.duration_days) || 30,
        }),
      });
      setShowCreateSub(false);
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setCreateSubLoading(false);
    }
  };

  const handleActivateSubscription = async (subId: string, days: number = 30) => {
    try {
      await apiRequest(`/api/v1/platform/subscriptions/${subId}/activate`, {
        method: 'POST',
        body: JSON.stringify({ extension_days: days }),
      });
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    }
  };

  const handleRenewSubscription = async (subId: string, days: number = 30) => {
    try {
      await apiRequest(`/api/v1/platform/subscriptions/${subId}/renew`, {
        method: 'POST',
        body: JSON.stringify({ extension_days: days }),
      });
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    }
  };

  const handleCancelSubscription = async (subId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا الاشتراك؟ سيتم الاحتفاظ بكافة بيانات المعهد.')) return;
    try {
      await apiRequest(`/api/v1/platform/subscriptions/${subId}/cancel`, {
        method: 'POST',
      });
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    }
  };

  const handleOpenChangePlan = (sub: Subscription) => {
    setChangePlanSub(sub);
    setSelectedNewPlanId(sub.plan_id || '');
    setShowChangePlan(true);
  };

  const handleChangePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changePlanSub || !selectedNewPlanId) return;
    setChangePlanLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/platform/subscriptions/${changePlanSub.id}/change-plan`, {
        method: 'POST',
        body: JSON.stringify({ plan_id: selectedNewPlanId }),
      });
      setShowChangePlan(false);
      setChangePlanSub(null);
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setChangePlanLoading(false);
    }
  };

  const handleOpenCreateSubForTenant = (tenantId: string) => {
    setSubForm({
      tenant_id: tenantId,
      plan_id: plans[0]?.id || '',
      duration_days: 30,
    });
    setShowCreateSub(true);
  };

  const handleOpenPaymentForTenant = (tenantId: string, subscriptionId?: string) => {
    const sub = subscriptions.find((s) => s.tenant_id === tenantId && s.status === 'active');
    const defaultAmount = sub?.plan?.price_iqd || 50000;
    setPaymentForm({
      tenant_id: tenantId,
      subscription_id: subscriptionId || sub?.id || '',
      amount_iqd: defaultAmount,
      payment_method: 'cash',
      reference_note: '',
    });
    setShowRecordPayment(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordPaymentLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; receipt: PaymentReceipt }>('/api/v1/platform/receipts', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: paymentForm.tenant_id,
          subscription_id: paymentForm.subscription_id || undefined,
          amount_iqd: Number(paymentForm.amount_iqd),
          payment_method: paymentForm.payment_method,
          reference_note: paymentForm.reference_note,
        }),
      });
      setShowRecordPayment(false);
      setPaymentForm({
        tenant_id: '',
        subscription_id: '',
        amount_iqd: 50000,
        payment_method: 'cash',
        reference_note: '',
      });
      await fetchData();
      if (res?.receipt) {
        setViewingReceipt(res.receipt);
      }
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setRecordPaymentLoading(false);
    }
  };

  const handleUpdateInquiryStatus = async (id: string, status: string) => {
    try {
      await apiRequest(`/api/v1/platform/inquiries/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    }
  };

  const handleOpenConvertInquiry = (inquiry: LandingInquiry) => {
    setConvertingInquiry(inquiry);
    const slugSuggestion =
      inquiry.institute_name
        .toLowerCase()
        .replace(/[\s\-_]+/g, '-')
        .replace(/[^a-z0-9\-]/g, '') || `inst-${Date.now().toString().slice(-4)}`;
    setConvertForm({
      slug: slugSuggestion,
      admin_email: `admin@${slugSuggestion}.iq`,
      admin_password: 'Password@123',
    });
  };

  const handleConvertInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingInquiry) return;
    setConvertLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/platform/inquiries/${convertingInquiry.id}/convert`, {
        method: 'POST',
        body: JSON.stringify(convertForm),
      });
      setConvertingInquiry(null);
      await fetchData();
      setActiveTab('institutes');
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setConvertLoading(false);
    }
  };

  const handleOpenReplyTicket = (ticket: SupportTicket) => {
    setReplyingTicket(ticket);
    setReplyText(ticket.admin_response || '');
    setReplyStatus(ticket.status === 'open' ? 'resolved' : ticket.status);
  };

  const handleReplyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingTicket) return;
    setReplyLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/platform/support/tickets/${replyingTicket.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          response: replyText,
          status: replyStatus,
        }),
      });
      setReplyingTicket(null);
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setReplyLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSettingsLoading(true);
    setError(null);
    try {
      await apiRequest('/api/v1/platform/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsForm),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      await fetchData();
    } catch (err: any) {
      setError({ message: err.message, requestId: err.requestId });
    } finally {
      setSaveSettingsLoading(false);
    }
  };

  const pendingInquiriesCount = inquiries.filter((i) => i.status === 'pending').length;
  const openTicketsCount = supportTickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const totalRevenueIQD = receipts.reduce((sum, r) => sum + (r.amount_iqd || 0), 0);

  const navItems = [
    {
      id: 'institutes',
      label: 'المعاهد والمدارس',
      icon: School,
      count: institutes.length,
      active: activeTab === 'institutes',
      onClick: () => setActiveTab('institutes'),
    },
    {
      id: 'plans',
      label: 'الباقات والأسعار',
      icon: CreditCard,
      count: plans.length,
      active: activeTab === 'plans',
      onClick: () => setActiveTab('plans'),
    },
    {
      id: 'subscriptions',
      label: 'إدارة الاشتراكات',
      icon: Calendar,
      count: subscriptions.length,
      active: activeTab === 'subscriptions',
      onClick: () => setActiveTab('subscriptions'),
    },
    {
      id: 'receipts',
      label: 'السجل المالي والإيصالات',
      icon: Receipt,
      count: receipts.length,
      active: activeTab === 'receipts',
      onClick: () => setActiveTab('receipts'),
    },
    {
      id: 'inquiries',
      label: 'طلبات الانضمام والاستشارة',
      icon: MessageSquare,
      count: pendingInquiriesCount > 0 ? pendingInquiriesCount : undefined,
      active: activeTab === 'inquiries',
      onClick: () => setActiveTab('inquiries'),
    },
    {
      id: 'support',
      label: 'تذاكر دعم المعاهد',
      icon: LifeBuoy,
      count: openTicketsCount > 0 ? openTicketsCount : undefined,
      active: activeTab === 'support',
      onClick: () => setActiveTab('support'),
    },
    {
      id: 'cms',
      label: 'إعدادات المنصة وCMS',
      icon: Sliders,
      active: activeTab === 'cms',
      onClick: () => setActiveTab('cms'),
    },
    {
      id: 'domains',
      label: 'النطاقات والمجالات',
      icon: Globe,
      count: domains.length,
      active: activeTab === 'domains',
      onClick: () => setActiveTab('domains'),
    },
    {
      id: 'audit',
      label: 'سجل التدقيق والأمان',
      icon: ShieldCheck,
      count: auditLogs.length,
      active: activeTab === 'audit',
      onClick: () => setActiveTab('audit'),
    },
  ];

  const currentBreadcrumb =
    activeTab === 'institutes'
      ? 'المعاهد والمدارس'
      : activeTab === 'plans'
      ? 'الباقات والأسعار'
      : activeTab === 'subscriptions'
      ? 'إدارة الاشتراكات'
      : activeTab === 'receipts'
      ? 'السجل المالي والإيصالات'
      : activeTab === 'inquiries'
      ? 'طلبات الانضمام والاستشارة'
      : activeTab === 'support'
      ? 'تذاكر دعم المعاهد'
      : activeTab === 'cms'
      ? 'إعدادات المنصة وCMS'
      : activeTab === 'domains'
      ? 'النطاقات والمجالات'
      : 'سجل التدقيق والأمان';

  return (
    <DashboardLayout
      brandTitle="منصة FiStudy"
      brandSubtitle="الإدارة المركزية"
      brandIcon={Building2}
      navSectionTitle="أقسام المنظومة"
      navItems={navItems}
      currentBreadcrumb={currentBreadcrumb}
      roleBadgeText="أدمن المنصة"
      headerActions={
        activeTab === 'institutes' ? (
          <Button
            size="sm"
            onClick={() => setShowCreateInstitute(true)}
            className="gap-1.5 text-xs font-bold shadow-xs h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>إنشاء معهد جديد</span>
          </Button>
        ) : activeTab === 'plans' ? (
          planViewMode === 'list' ? (
            <Button
              size="sm"
              onClick={() => {
                setPlanForm({
                  name: '',
                  slug: '',
                  description: '',
                  price_iqd: 50000,
                  billing_cycle: 'monthly',
                  max_students: 100,
                  max_teachers: 10,
                  max_branches: 1,
                  image_url: '/images/plan_basic.jpg',
                  is_active: true,
                });
                setCreatePlanFeatures([
                  'تطبيق ولي الأمر للهواتف (iOS / Android)',
                  'إشعارات WhatsApp ورسائل SMS تلقائية للغياب والدرجات',
                  'نظام الحضور والغياب والبصمة الذكي',
                  'إدارة الرسوم والأقساط وطباعة الوصولات المالية',
                ]);
                setPlanViewMode('create');
              }}
              className="gap-1.5 text-xs font-bold shadow-xs h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>إضافة باقة جديدة</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPlanViewMode('list')}
              className="gap-1.5 text-xs font-bold shadow-xs h-8"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>العودة لقائمة الباقات</span>
            </Button>
          )
        ) : activeTab === 'subscriptions' ? (
          <Button
            size="sm"
            onClick={() => setShowCreateSub(true)}
            className="gap-1.5 text-xs font-bold shadow-xs h-8"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>تخصيص اشتراك</span>
          </Button>
        ) : activeTab === 'receipts' ? (
          <Button
            size="sm"
            onClick={() => setShowRecordPayment(true)}
            className="gap-1.5 text-xs font-bold shadow-xs h-8"
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>تسجيل إيصال مالي</span>
          </Button>
        ) : null
      }
    >
      {error && (
        <ErrorAlert
          message={error.message}
          requestId={error.requestId}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Metric Overview Cards matching Phase 5 KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">المعاهد والمدارس</p>
              <p className="text-2xl font-black text-foreground">{institutes.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <School className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">الإيرادات المحصلة</p>
              <p className="text-xl font-black text-emerald-600 font-mono">
                {totalRevenueIQD > 0 ? totalRevenueIQD.toLocaleString() : '0'}{' '}
                <span className="text-xs font-normal">د.ع</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">طلبات الانضمام</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-black text-foreground">{inquiries.length}</p>
                {pendingInquiriesCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] font-bold px-1.5 py-0.5">
                    {pendingInquiriesCount} معلق
                  </Badge>
                )}
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <MessageSquare className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">تذاكر الدعم العالقة</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-black text-foreground">{supportTickets.length}</p>
                {openTicketsCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700">
                    {openTicketsCount} نشطة
                  </Badge>
                )}
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <LifeBuoy className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Content */}
      {loading ? (
        <LoadingSpinner message="جاري مزامنة بيانات المنصة..." />
      ) : (
        <div className="space-y-6">
          {/* 1. INSTITUTES SECTION */}
          {activeTab === 'institutes' && (
            <Card className="shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <School className="h-4 w-4 text-primary" />
                    قائمة المعاهد والمدارس المشتركة
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    إدارة حسابات المعاهد، التحقق من العناوين المعرفة، وتعديل حالات النشاط
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateInstitute(true)}
                  className="gap-1.5 text-xs font-bold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة معهد
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {institutes.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      title="لا توجد معاهد مسجلة حالياً"
                      description="قم بإنشاء أول معهد لتجهيز بيئته وتفعيل بيانات مديره المؤسس"
                      actionLabel="إنشاء معهد الآن"
                      onAction={() => setShowCreateInstitute(true)}
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-xs">المعهد والهوية</TableHead>
                        <TableHead className="font-bold text-xs">المعرّف والرابط</TableHead>
                        <TableHead className="font-bold text-xs">اللون المعتمد</TableHead>
                        <TableHead className="font-bold text-xs">بيانات الاتصال</TableHead>
                        <TableHead className="font-bold text-xs">الاشتراك والصلاحية</TableHead>
                        <TableHead className="font-bold text-xs">الحالة</TableHead>
                        <TableHead className="font-bold text-xs text-center">الإجراءات والاشتراك</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {institutes.map((inst) => {
                        const activeSub =
                          subscriptions.find(
                            (s) => s.tenant_id === inst.id && (s.status === 'active' || s.status === 'trialing')
                          ) || subscriptions.find((s) => s.tenant_id === inst.id);
                        const isExpired = activeSub ? new Date(activeSub.ends_at) < new Date() : false;
                        const remainingDays = activeSub
                          ? Math.ceil(
                              (new Date(activeSub.ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                            )
                          : null;

                        return (
                          <TableRow key={inst.id} className="text-xs">
                            <TableCell className="font-bold text-foreground">
                              <div className="flex items-center gap-2.5">
                                {inst.logo_url ? (
                                  <img
                                    src={inst.logo_url}
                                    alt={inst.name}
                                    className="w-8 h-8 rounded-md object-cover border border-border"
                                  />
                                ) : (
                                  <div
                                    className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold shadow-xs"
                                    style={{ backgroundColor: inst.primary_color || '#4f46e5' }}
                                  >
                                    <School className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-foreground">{inst.name}</div>
                                  <div className="text-[10px] text-muted-foreground font-normal">
                                    {inst.address || 'العنوان غير محدد'}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 font-mono text-xs">
                                <span className="font-semibold text-primary">{inst.slug}</span>
                                <a
                                  href={`http://${inst.slug}.localhost:8080/login`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="فتح بوابة المعهد"
                                  className="text-muted-foreground hover:text-primary transition"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                                  style={{ backgroundColor: inst.primary_color || '#4f46e5' }}
                                />
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {inst.primary_color || '#4f46e5'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <div>{inst.email || '—'}</div>
                              <div className="text-[11px] text-muted-foreground/80">{inst.phone || ''}</div>
                            </TableCell>
                            <TableCell>
                              {activeSub ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className="font-bold text-[11px] border-primary/20 bg-primary/5 text-primary"
                                    >
                                      {activeSub.plan?.name || 'باقة محددة'}
                                    </Badge>
                                    {activeSub.status === 'trialing' ? (
                                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] font-bold">
                                        تجريبي
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                        نشط رسمي
                                      </Badge>
                                    )}
                                    {activeSub.plan && (
                                      <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                                        {Number(activeSub.plan.price_iqd).toLocaleString('ar-IQ')} د.ع
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px]">
                                    {isExpired ? (
                                      <span className="text-destructive font-bold flex items-center gap-0.5">
                                        <AlertTriangle className="w-3 h-3" />
                                        منتهي الصلاحية
                                      </span>
                                    ) : (
                                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                        <CheckCircle2 className="w-3 h-3" />
                                        متبقي {remainingDays} يوماً
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>بدون اشتراك نشط</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={inst.status === 'active' ? 'default' : 'destructive'}
                                className="gap-1 text-[11px] font-bold"
                              >
                                {inst.status === 'active' ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    نشط
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-3 h-3" />
                                    موقوف
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {activeSub ? (
                                  <>
                                    {activeSub.status === 'trialing' && (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleActivateSubscription(activeSub.id, 30)}
                                        className="h-7 px-2 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                        title="تفعيل الاشتراك رسمياً (تحويل من تجريبي إلى نشط)"
                                      >
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>تفعيل رسمي</span>
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRenewSubscription(activeSub.id, 30)}
                                      className="h-7 px-2 text-[11px] font-bold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                                      title="تجديد الاشتراك +30 يوم"
                                    >
                                      <RotateCw className="w-3 h-3" />
                                      <span>تجديد 30يوم</span>
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleOpenCreateSubForTenant(inst.id)}
                                    className="h-7 px-2 text-[11px] font-bold gap-1 bg-primary text-white"
                                    title="ربط واشتراك جديد"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>تخصيص اشتراك</span>
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenPaymentForTenant(inst.id, activeSub?.id)}
                                  className="h-7 px-2 text-[11px] font-bold gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  title="تسجيل دفعة وسند قبض"
                                >
                                  <DollarSign className="w-3 h-3" />
                                  <span>سند قبض</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenEditInstitute(inst)}
                                  className="h-7 px-2 text-xs font-bold gap-1"
                                  title="تعديل الهوية والبيانات"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>تعديل</span>
                                </Button>
                                <Button
                                  variant={inst.status === 'active' ? 'ghost' : 'default'}
                                  size="sm"
                                  onClick={() => handleStatusChange(inst.id, inst.status)}
                                  className="h-7 px-2 text-[11px] font-bold text-destructive hover:bg-destructive/10"
                                >
                                  {inst.status === 'active' ? 'إيقاف' : 'تفعيل'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* 2. PLANS SECTION */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              {/* ========================================================= */}
              {/* VIEW MODE 1: CREATE PLAN (IN-PAGE)                        */}
              {/* ========================================================= */}
              {planViewMode === 'create' && (
                <div className="space-y-6">
                  {/* In-page Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPlanViewMode('list')}
                        className="gap-1.5 text-xs font-bold shadow-2xs hover:bg-muted"
                      >
                        <ArrowRight className="h-4 w-4" />
                        <span>العودة لقائمة الباقات</span>
                      </Button>
                      <div>
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-primary" />
                          إضافة خطة اشتراك جديدة
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          تحديد تسعير الخطة بالدينار العراقي (IQD)، السعات التشغيلية، وصورة العرض والميزات
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPlanViewMode('list')}
                        className="text-xs font-bold"
                      >
                        إلغاء والعودة
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreatePlan}
                        disabled={createPlanLoading}
                        className="text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-xs"
                      >
                        <Save className="h-4 w-4" />
                        <span>{createPlanLoading ? 'جاري إنشاء الباقة...' : 'حفظ ونشر الباقة'}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Two Column Layout: Form (Right) and Live Visitor Card Preview (Left) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Form Column */}
                    <div className="lg:col-span-7 xl:col-span-8 space-y-5">
                      <form onSubmit={handleCreatePlan} className="space-y-5">
                        {/* 1. Basic Information */}
                        <Card className="shadow-xs">
                          <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <Tag className="w-4 h-4 text-primary" />
                              البيانات الأساسية للباقة
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">اسم الخطة *</Label>
                                <Input
                                  required
                                  value={planForm.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPlanForm((prev) => ({
                                      ...prev,
                                      name: val,
                                      slug: prev.slug === '' ? val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : prev.slug,
                                    }));
                                  }}
                                  placeholder="مثال: الخطة الذهبية"
                                  className="text-xs h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">المعرّف اللاتيني (Slug) *</Label>
                                <Input
                                  required
                                  dir="ltr"
                                  value={planForm.slug}
                                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-') })}
                                  placeholder="golden-tier"
                                  className="text-xs h-9 font-mono"
                                />
                                <p className="text-[11px] text-muted-foreground">أحرف صغيرة وأرقام وشرطات (3-50 حرفاً)</p>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold">وصف الخطة</Label>
                              <Input
                                value={planForm.description}
                                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                                placeholder="وصف موجز للمستوى الموجه والمزايا الرئيسية للمعاهد"
                                className="text-xs h-9"
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* 2. Plan Visual Image Banner & Upload */}
                        <Card className="shadow-xs">
                          <CardHeader className="pb-3 border-b border-border/50">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Image className="w-4 h-4 text-primary" />
                                صورة الباقة (تظهر في البطاقة وصفحة الهبوط)
                              </CardTitle>
                              {uploadingImage && (
                                <span className="text-xs text-primary font-bold animate-pulse">جاري رفع ومعالجة الصورة...</span>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            {/* Direct File Upload from Computer / Device */}
                            <label className="flex flex-col sm:flex-row items-center justify-center gap-2.5 p-4 border-2 border-dashed border-primary/40 hover:border-primary rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 transition text-xs font-bold text-primary group">
                              <Upload className="w-5 h-5 group-hover:scale-110 transition-transform text-primary" />
                              <span>{uploadingImage ? 'جاري رفع وحفظ الصورة في الخادم...' : 'انقر لرفع صورة مباشرة من حاسوبك أو هاتفك'}</span>
                              <span className="text-[11px] font-normal text-muted-foreground">(JPG, PNG, WEBP, SVG)</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                                className="hidden"
                                disabled={uploadingImage}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadPlanImage(f, false);
                                }}
                              />
                            </label>

                            {/* Preset Quick Images */}
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-muted-foreground">أو اختر صورة جاهزة من النماذج المصممة:</Label>
                              <div className="grid grid-cols-3 gap-3">
                                {[
                                  { label: 'الباقة التأسيسية', url: '/images/plan_basic.jpg' },
                                  { label: 'الباقة الاحترافية', url: '/images/plan_pro.jpg' },
                                  { label: 'باقة المؤسسات', url: '/images/plan_enterprise.jpg' },
                                ].map((imgOpt) => (
                                  <button
                                    key={imgOpt.url}
                                    type="button"
                                    onClick={() => setPlanForm({ ...planForm, image_url: imgOpt.url })}
                                    className={`group relative rounded-xl overflow-hidden border-2 transition p-1 text-right ${
                                      planForm.image_url === imgOpt.url
                                        ? 'border-primary ring-2 ring-primary/20 shadow-sm'
                                        : 'border-border hover:border-muted-foreground/40 opacity-75 hover:opacity-100'
                                    }`}
                                  >
                                    <img src={imgOpt.url} alt={imgOpt.label} className="w-full h-16 object-cover rounded-lg group-hover:scale-105 transition duration-200" />
                                    <div className="p-1 text-xs font-bold truncate text-foreground">{imgOpt.label}</div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Image URL Manual Field */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">رابط الصورة (URL)</Label>
                              <Input
                                dir="ltr"
                                value={planForm.image_url}
                                onChange={(e) => setPlanForm({ ...planForm, image_url: e.target.value })}
                                placeholder="/images/plan_basic.jpg أو /uploads/plans/..."
                                className="text-xs h-9 font-mono"
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* 3. Pricing & Operational Quotas */}
                        <Card className="shadow-xs">
                          <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-primary" />
                              التسعير بالدينار العراقي والحدود التشغيلية
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">السعر (دينار عراقي IQD) *</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  required
                                  dir="ltr"
                                  value={planForm.price_iqd}
                                  onChange={(e) => setPlanForm({ ...planForm, price_iqd: parseInt(e.target.value) || 0 })}
                                  className="text-xs h-9 font-mono text-left font-bold"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                  القيمة بالدينار: {Number(planForm.price_iqd).toLocaleString()} د.ع
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">دورة الفوترة *</Label>
                                <select
                                  value={planForm.billing_cycle}
                                  onChange={(e) => setPlanForm({ ...planForm, billing_cycle: e.target.value as any })}
                                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                  <option value="monthly">شهري</option>
                                  <option value="quarterly">فصلي (3 أشهر)</option>
                                  <option value="yearly">سنوي</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">أقصى عدد طلاب *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  required
                                  dir="ltr"
                                  value={planForm.max_students}
                                  onChange={(e) => setPlanForm({ ...planForm, max_students: parseInt(e.target.value) || 1 })}
                                  className="text-xs h-9 font-mono"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">أقصى عدد أساتذة *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  required
                                  dir="ltr"
                                  value={planForm.max_teachers}
                                  onChange={(e) => setPlanForm({ ...planForm, max_teachers: parseInt(e.target.value) || 1 })}
                                  className="text-xs h-9 font-mono"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">أقصى عدد فروع *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  required
                                  dir="ltr"
                                  value={planForm.max_branches}
                                  onChange={(e) => setPlanForm({ ...planForm, max_branches: parseInt(e.target.value) || 1 })}
                                  className="text-xs h-9 font-mono"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* 4. Features Builder */}
                        <Card className="shadow-xs">
                          <CardHeader className="pb-3 border-b border-border/50">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Tag className="w-4 h-4 text-primary" />
                                ميزات الباقة المخصصة ({createPlanFeatures.length})
                              </CardTitle>
                              <span className="text-xs text-muted-foreground">تظهر كبنود ميزات في صفحة الهبوط والتسجيل</span>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            {/* Feature Badges list */}
                            <div className="min-h-[50px] p-3 rounded-xl border border-border bg-muted/20 flex flex-wrap gap-2 items-center">
                              {createPlanFeatures.length === 0 ? (
                                <span className="text-xs text-muted-foreground italic">
                                  لم تتم إضافة ميزات بعد، أضف ميزة أو اختر من المقترحات أدناه
                                </span>
                              ) : (
                                createPlanFeatures.map((feat, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-foreground text-xs font-medium shadow-2xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{feat}</span>
                                    <button
                                      type="button"
                                      onClick={() => setCreatePlanFeatures(createPlanFeatures.filter((_, i) => i !== idx))}
                                      className="text-muted-foreground hover:text-destructive transition mr-1"
                                      title="حذف الميزة"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>

                            {/* Add custom feature input */}
                            <div className="flex items-center gap-2">
                              <Input
                                value={createFeatureInput}
                                onChange={(e) => setCreateFeatureInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (createFeatureInput.trim() && !createPlanFeatures.includes(createFeatureInput.trim())) {
                                      setCreatePlanFeatures([...createPlanFeatures, createFeatureInput.trim()]);
                                      setCreateFeatureInput('');
                                    }
                                  }
                                }}
                                placeholder="اكتب ميزة مخصصة واضغط إضافة (مثال: شهادات تخرج إلكترونية)"
                                className="text-xs h-9 flex-1"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  if (createFeatureInput.trim() && !createPlanFeatures.includes(createFeatureInput.trim())) {
                                    setCreatePlanFeatures([...createPlanFeatures, createFeatureInput.trim()]);
                                    setCreateFeatureInput('');
                                  }
                                }}
                                className="h-9 px-4 text-xs font-bold"
                              >
                                إضافة ميزة
                              </Button>
                            </div>

                            {/* Preset quick feature suggestions */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-semibold text-muted-foreground block">
                                مقترحات سريعة بنقرة واحدة:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {PRESET_PLAN_FEATURES.filter((pf) => !createPlanFeatures.includes(pf))
                                  .slice(0, 8)
                                  .map((pf, pIdx) => (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={() => setCreatePlanFeatures([...createPlanFeatures, pf])}
                                      className="px-2.5 py-1 rounded-md text-xs bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 transition flex items-center gap-1 font-medium"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>{pf}</span>
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* 5. Active Status Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-xs">
                          <div className="space-y-0.5 text-right">
                            <Label className="text-xs font-bold cursor-pointer">تفعيل الخطة فوراً</Label>
                            <p className="text-xs text-muted-foreground">عند التفعيل تظهر فوراً في صفحة الهبوط وإتاحة الاشتراك للمعاهد</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={planForm.is_active}
                            onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                            className="w-5 h-5 rounded border-border text-primary cursor-pointer"
                          />
                        </div>

                        {/* Submit Bar */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPlanViewMode('list')}
                            className="text-xs font-bold"
                          >
                            إلغاء والعودة
                          </Button>
                          <Button
                            type="submit"
                            disabled={createPlanLoading}
                            className="text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-2 h-10 px-6 shadow-sm"
                          >
                            <Save className="h-4 w-4" />
                            <span>{createPlanLoading ? 'جاري إنشاء الباقة...' : 'حفظ ونشر الباقة'}</span>
                          </Button>
                        </div>
                      </form>
                    </div>

                    {/* Live Card Preview Column - Sticky */}
                    <div className="lg:col-span-5 xl:col-span-4 sticky top-6">
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 px-1">
                          <Eye className="w-3.5 h-3.5 text-primary" />
                          <span>معاينة البطاقة كما تظهر للزوار في صفحة الهبوط:</span>
                        </div>

                        <Card className="flex flex-col justify-between shadow-md border-primary/30 overflow-hidden bg-card">
                          {/* Banner Image */}
                          <div className="relative h-40 w-full overflow-hidden bg-slate-100 border-b border-border/50">
                            <img
                              src={planForm.image_url || '/images/plan_basic.jpg'}
                              alt={planForm.name || 'معاينة الباقة'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/images/plan_basic.jpg';
                              }}
                            />
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                              <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                                {planForm.billing_cycle === 'monthly' ? 'شهري' : planForm.billing_cycle === 'yearly' ? 'سنوي' : 'فصلي'}
                              </span>
                            </div>
                            <div className="absolute bottom-2 left-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold backdrop-blur-xs ${
                                planForm.is_active ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
                              }`}>
                                {planForm.is_active ? 'نشطة' : 'مسودة'}
                              </span>
                            </div>
                          </div>

                          <CardHeader className="pb-3 border-b border-border/60">
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-base font-bold truncate">
                                {planForm.name || 'اسم الباقة'}
                              </CardTitle>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {planForm.slug || 'plan-slug'}
                              </Badge>
                            </div>
                            <CardDescription className="text-xs mt-1 line-clamp-2">
                              {planForm.description || 'وصف مختصر لمزايا وخدمات الباقة'}
                            </CardDescription>
                          </CardHeader>

                          <CardContent className="pt-4 space-y-4">
                            {/* Price Display */}
                            <div className="text-2xl font-black text-foreground">
                              {Number(planForm.price_iqd || 0).toLocaleString()}{' '}
                              <span className="text-xs font-normal text-muted-foreground">د.ع / دورة الفوترة</span>
                            </div>

                            <Separator />

                            {/* Quotas */}
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex items-center justify-between py-0.5">
                                <span>سعة الطلاب:</span>
                                <strong className="text-foreground font-bold">{Number(planForm.max_students || 0).toLocaleString()} طالب</strong>
                              </div>
                              <div className="flex items-center justify-between py-0.5">
                                <span>سعة الكادر والمدرسين:</span>
                                <strong className="text-foreground font-bold">{planForm.max_teachers || 0} أستاذ</strong>
                              </div>
                              <div className="flex items-center justify-between py-0.5">
                                <span>الفروع المصرح بها:</span>
                                <strong className="text-foreground font-bold">{planForm.max_branches || 1} فرع</strong>
                              </div>
                            </div>

                            <Separator />

                            {/* Features List */}
                            <div>
                              <div className="text-xs font-bold text-foreground mb-2 flex items-center gap-1">
                                <Tag className="w-3 h-3 text-primary" />
                                <span>الميزات المشمولة ({createPlanFeatures.length}):</span>
                              </div>
                              {createPlanFeatures.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">لم يتم إدخال ميزات بعد</p>
                              ) : (
                                <ul className="space-y-1.5 text-xs text-muted-foreground max-h-48 overflow-y-auto">
                                  {createPlanFeatures.map((feat, fIdx) => (
                                    <li key={fIdx} className="flex items-start gap-1.5 leading-tight">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                      <span>{feat}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* VIEW MODE 2: EDIT PLAN (IN-PAGE)                          */}
              {/* ========================================================= */}
              {planViewMode === 'edit' && (
                <div className="space-y-6">
                  {/* In-page Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPlanViewMode('list')}
                        className="gap-1.5 text-xs font-bold shadow-2xs hover:bg-muted"
                      >
                        <ArrowRight className="h-4 w-4" />
                        <span>العودة لقائمة الباقات</span>
                      </Button>
                      <div>
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <Edit2 className="h-5 w-5 text-primary" />
                          تعديل باقة: {editPlanForm.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          تحديث التسعير بالدينار العراقي، السعات التشغيلية، وصورة العرض وقائمة الميزات
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPlanViewMode('list')}
                        className="text-xs font-bold"
                      >
                        إلغاء والعودة
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleUpdatePlan}
                        disabled={editPlanLoading}
                        className="text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-xs"
                      >
                        <Save className="h-4 w-4" />
                        <span>{editPlanLoading ? 'جاري حفظ التعديلات...' : 'حفظ التعديلات'}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Two Column Layout: Form (Right) and Live Visitor Card Preview (Left) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Form Column */}
                    <div className="lg:col-span-7 xl:col-span-8 space-y-5">
                      <form onSubmit={handleUpdatePlan} className="space-y-5">
                        {/* 1. Basic Information */}
                        <Card className="shadow-xs">
                          <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <Tag className="w-4 h-4 text-primary" />
                              البيانات الأساسية للباقة
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold">اسم الخطة *</Label>
                              <Input
                                required
                                value={editPlanForm.name}
                                onChange={(e) => setEditPlanForm({ ...editPlanForm, name: e.target.value })}
                                className="text-xs h-9"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold">وصف الخطة</Label>
                              <Input
                                value={editPlanForm.description}
                                onChange={(e) => setEditPlanForm({ ...editPlanForm, description: e.target.value })}
                                className="text-xs h-9"
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* 2. Plan Visual Image Banner & Upload */}
                        <Card className="shadow-xs">
                          <CardHeader className="pb-3 border-b border-border/50">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Image className="w-4 h-4 text-primary" />
                                صورة الباقة (تظهر في البطاقة وصفحة الهبوط)
                              </CardTitle>
                              {uploadingImage && (
                                <span className="text-xs text-primary font-bold animate-pulse">جاري رفع ومعالجة الصورة...</span>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            {/* Direct File Upload from Computer / Device */}
                            <label className="flex flex-col sm:flex-row items-center justify-center gap-2.5 p-4 border-2 border-dashed border-primary/40 hover:border-primary rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 transition text-xs font-bold text-primary group">
                              <Upload className="w-5 h-5 group-hover:scale-110 transition-transform text-primary" />
                              <span>{uploadingImage ? 'جاري رفع وحفظ الصورة في الخادم...' : 'انقر لرفع صورة مباشرة من حاسوبك أو هاتفك'}</span>
                              <span className="text-[11px] font-normal text-muted-foreground">(JPG, PNG, WEBP, SVG)</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                                className="hidden"
                                disabled={uploadingImage}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadPlanImage(f, true);
                                }}
                              />
                            </label>

                            {/* Preset Quick Images */}
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-muted-foreground">أو اختر صورة جاهزة من النماذج المصممة:</Label>
                              <div className="grid grid-cols-3 gap-3">
                                {[
                                  { label: 'الباقة التأسيسية', url: '/images/plan_basic.jpg' },
                                  { label: 'الباقة الاحترافية', url: '/images/plan_pro.jpg' },
                                  { label: 'باقة المؤسسات', url: '/images/plan_enterprise.jpg' },
                                ].map((imgOpt) => (
                                  <button
                                    key={imgOpt.url}
                                    type="button"
                                    onClick={() => setEditPlanForm({ ...editPlanForm, image_url: imgOpt.url })}
                                    className={`group relative rounded-xl overflow-hidden border-2 transition p-1 text-right ${
                                      editPlanForm.image_url === imgOpt.url
                                        ? 'border-primary ring-2 ring-primary/20 shadow-sm'
                                        : 'border-border hover:border-muted-foreground/40 opacity-75 hover:opacity-100'
                                    }`}
                                  >
                                    <img src={imgOpt.url} alt={imgOpt.label} className="w-full h-16 object-cover rounded-lg group-hover:scale-105 transition duration-200" />
                                    <div className="p-1 text-xs font-bold truncate text-foreground">{imgOpt.label}</div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Image URL Manual Field */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">رابط الصورة (URL)</Label>
                              <Input
                                dir="ltr"
                                value={editPlanForm.image_url}
                                onChange={(e) => setEditPlanForm({ ...editPlanForm, image_url: e.target.value })}
                                placeholder="/images/plan_basic.jpg أو /uploads/plans/..."
                                className="text-xs h-9 font-mono"
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* 3. Pricing & Operational Quotas */}
                        <Card className="shadow-xs">
                          <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-primary" />
                              التسعير بالدينار العراقي والحدود التشغيلية
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">السعر (دينار عراقي IQD) *</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  required
                                  dir="ltr"
                                  value={editPlanForm.price_iqd}
                                  onChange={(e) => setEditPlanForm({ ...editPlanForm, price_iqd: parseInt(e.target.value) || 0 })}
                                  className="text-xs h-9 font-mono text-left font-bold"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                  القيمة بالدينار: {Number(editPlanForm.price_iqd).toLocaleString()} د.ع
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">دورة الفوترة *</Label>
                                <select
                                  value={editPlanForm.billing_cycle}
                                  onChange={(e) => setEditPlanForm({ ...editPlanForm, billing_cycle: e.target.value })}
                                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                  <option value="monthly">شهري</option>
                                  <option value="quarterly">فصلي (3 أشهر)</option>
                                  <option value="yearly">سنوي</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">أقصى عدد طلاب *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  required
                                  dir="ltr"
                                  value={editPlanForm.max_students}
                                  onChange={(e) => setEditPlanForm({ ...editPlanForm, max_students: parseInt(e.target.value) || 1 })}
                                  className="text-xs h-9 font-mono"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">أقصى عدد أساتذة *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  required
                                  dir="ltr"
                                  value={editPlanForm.max_teachers}
                                  onChange={(e) => setEditPlanForm({ ...editPlanForm, max_teachers: parseInt(e.target.value) || 1 })}
                                  className="text-xs h-9 font-mono"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">أقصى عدد فروع *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  required
                                  dir="ltr"
                                  value={editPlanForm.max_branches}
                                  onChange={(e) => setEditPlanForm({ ...editPlanForm, max_branches: parseInt(e.target.value) || 1 })}
                                  className="text-xs h-9 font-mono"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* 4. Features Builder */}
                        <Card className="shadow-xs">
                          <CardHeader className="pb-3 border-b border-border/50">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Tag className="w-4 h-4 text-primary" />
                                ميزات الباقة المخصصة ({editPlanFeatures.length})
                              </CardTitle>
                              <span className="text-xs text-muted-foreground">تظهر كبنود ميزات في صفحة الهبوط والتسجيل</span>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            {/* Feature Badges list */}
                            <div className="min-h-[50px] p-3 rounded-xl border border-border bg-muted/20 flex flex-wrap gap-2 items-center">
                              {editPlanFeatures.length === 0 ? (
                                <span className="text-xs text-muted-foreground italic">
                                  لا توجد ميزات مسجلة، أضف ميزاتك المخصصة أدناه
                                </span>
                              ) : (
                                editPlanFeatures.map((feat, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-foreground text-xs font-medium shadow-2xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{feat}</span>
                                    <button
                                      type="button"
                                      onClick={() => setEditPlanFeatures(editPlanFeatures.filter((_, i) => i !== idx))}
                                      className="text-muted-foreground hover:text-destructive transition mr-1"
                                      title="حذف الميزة"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>

                            {/* Add custom feature input */}
                            <div className="flex items-center gap-2">
                              <Input
                                value={editFeatureInput}
                                onChange={(e) => setEditFeatureInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (editFeatureInput.trim() && !editPlanFeatures.includes(editFeatureInput.trim())) {
                                      setEditPlanFeatures([...editPlanFeatures, editFeatureInput.trim()]);
                                      setEditFeatureInput('');
                                    }
                                  }
                                }}
                                placeholder="اكتب ميزة واضغط إضافة"
                                className="text-xs h-9 flex-1"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  if (editFeatureInput.trim() && !editPlanFeatures.includes(editFeatureInput.trim())) {
                                    setEditPlanFeatures([...editPlanFeatures, editFeatureInput.trim()]);
                                    setEditFeatureInput('');
                                  }
                                }}
                                className="h-9 px-4 text-xs font-bold"
                              >
                                إضافة ميزة
                              </Button>
                            </div>

                            {/* Preset quick feature suggestions */}
                            <div className="space-y-1.5">
                              <span className="text-xs font-semibold text-muted-foreground block">
                                مقترحات سريعة بنقرة واحدة:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {PRESET_PLAN_FEATURES.filter((pf) => !editPlanFeatures.includes(pf))
                                  .slice(0, 8)
                                  .map((pf, pIdx) => (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={() => setEditPlanFeatures([...editPlanFeatures, pf])}
                                      className="px-2.5 py-1 rounded-md text-xs bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 transition flex items-center gap-1 font-medium"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>{pf}</span>
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* 5. Active Status Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-xs">
                          <div className="space-y-0.5 text-right">
                            <Label className="text-xs font-bold cursor-pointer">حالة تفعيل الخطة</Label>
                            <p className="text-xs text-muted-foreground">عند التفعيل تظهر فوراً في صفحة الهبوط وإتاحة الاشتراك للمعاهد</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={editPlanForm.is_active}
                            onChange={(e) => setEditPlanForm({ ...editPlanForm, is_active: e.target.checked })}
                            className="w-5 h-5 rounded border-border text-primary cursor-pointer"
                          />
                        </div>

                        {/* Submit Bar */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPlanViewMode('list')}
                            className="text-xs font-bold"
                          >
                            إلغاء والعودة
                          </Button>
                          <Button
                            type="submit"
                            disabled={editPlanLoading}
                            className="text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-2 h-10 px-6 shadow-sm"
                          >
                            <Save className="h-4 w-4" />
                            <span>{editPlanLoading ? 'جاري حفظ التعديلات...' : 'حفظ التعديلات'}</span>
                          </Button>
                        </div>
                      </form>
                    </div>

                    {/* Live Card Preview Column - Sticky */}
                    <div className="lg:col-span-5 xl:col-span-4 sticky top-6">
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 px-1">
                          <Eye className="w-3.5 h-3.5 text-primary" />
                          <span>معاينة البطاقة بعد التعديل في صفحة الهبوط:</span>
                        </div>

                        <Card className="flex flex-col justify-between shadow-md border-primary/30 overflow-hidden bg-card">
                          {/* Banner Image */}
                          <div className="relative h-40 w-full overflow-hidden bg-slate-100 border-b border-border/50">
                            <img
                              src={editPlanForm.image_url || '/images/plan_basic.jpg'}
                              alt={editPlanForm.name || 'معاينة الباقة'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/images/plan_basic.jpg';
                              }}
                            />
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                              <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                                {editPlanForm.billing_cycle === 'monthly' ? 'شهري' : editPlanForm.billing_cycle === 'yearly' ? 'سنوي' : 'فصلي'}
                              </span>
                            </div>
                            <div className="absolute bottom-2 left-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold backdrop-blur-xs ${
                                editPlanForm.is_active ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
                              }`}>
                                {editPlanForm.is_active ? 'نشطة' : 'معطلة'}
                              </span>
                            </div>
                          </div>

                          <CardHeader className="pb-3 border-b border-border/60">
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-base font-bold truncate">
                                {editPlanForm.name || 'اسم الباقة'}
                              </CardTitle>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {editPlanForm.id.slice(0, 8)}
                              </Badge>
                            </div>
                            <CardDescription className="text-xs mt-1 line-clamp-2">
                              {editPlanForm.description || 'وصف مختصر لمزايا وخدمات الباقة'}
                            </CardDescription>
                          </CardHeader>

                          <CardContent className="pt-4 space-y-4">
                            {/* Price Display */}
                            <div className="text-2xl font-black text-foreground">
                              {Number(editPlanForm.price_iqd || 0).toLocaleString()}{' '}
                              <span className="text-xs font-normal text-muted-foreground">د.ع / دورة الفوترة</span>
                            </div>

                            <Separator />

                            {/* Quotas */}
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <div className="flex items-center justify-between py-0.5">
                                <span>سعة الطلاب:</span>
                                <strong className="text-foreground font-bold">{Number(editPlanForm.max_students || 0).toLocaleString()} طالب</strong>
                              </div>
                              <div className="flex items-center justify-between py-0.5">
                                <span>سعة الكادر والمدرسين:</span>
                                <strong className="text-foreground font-bold">{editPlanForm.max_teachers || 0} أستاذ</strong>
                              </div>
                              <div className="flex items-center justify-between py-0.5">
                                <span>الفروع المصرح بها:</span>
                                <strong className="text-foreground font-bold">{editPlanForm.max_branches || 1} فرع</strong>
                              </div>
                            </div>

                            <Separator />

                            {/* Features List */}
                            <div>
                              <div className="text-xs font-bold text-foreground mb-2 flex items-center gap-1">
                                <Tag className="w-3 h-3 text-primary" />
                                <span>الميزات المشمولة ({editPlanFeatures.length}):</span>
                              </div>
                              {editPlanFeatures.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">لم يتم إدخال ميزات بعد</p>
                              ) : (
                                <ul className="space-y-1.5 text-xs text-muted-foreground max-h-48 overflow-y-auto">
                                  {editPlanFeatures.map((feat, fIdx) => (
                                    <li key={fIdx} className="flex items-start gap-1.5 leading-tight">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                      <span>{feat}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* VIEW MODE 3: PLANS LIST (DEFAULT VIEW)                   */}
              {/* ========================================================= */}
              {planViewMode === 'list' && (
                <div className="space-y-5">
                  {/* Top Stats & Actions Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        باقات وخطط اشتراك المعاهد
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        التحكم الكامل بالباقات المعروضة في صفحة الهبوط، التسعير بالدينار العراقي، السعات والميزات المخصصة
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-stretch sm:self-auto">
                      <Button
                        size="sm"
                        onClick={() => {
                          setPlanForm({
                            name: '',
                            slug: '',
                            description: '',
                            price_iqd: 50000,
                            billing_cycle: 'monthly',
                            max_students: 100,
                            max_teachers: 10,
                            max_branches: 1,
                            image_url: '/images/plan_basic.jpg',
                            is_active: true,
                          });
                          setCreatePlanFeatures([
                            'تطبيق ولي الأمر للهواتف (iOS / Android)',
                            'إشعارات WhatsApp ورسائل SMS تلقائية للغياب والدرجات',
                            'نظام الحضور والغياب والبصمة الذكي',
                            'إدارة الرسوم والأقساط وطباعة الوصولات المالية',
                          ]);
                          setPlanViewMode('create');
                        }}
                        className="gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        إضافة باقة جديدة
                      </Button>
                    </div>
                  </div>

                  {/* Quick Metrics Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
                      <div className="text-[11px] text-muted-foreground font-semibold">إجمالي الباقات</div>
                      <div className="text-xl font-black text-foreground mt-0.5">{plans.length}</div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs">
                      <div className="text-[11px] text-emerald-700 font-semibold">الباقات النشطة (تظهر للعامة)</div>
                      <div className="text-xl font-black text-emerald-600 mt-0.5">
                        {plans.filter((p) => p.is_active).length}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-xs">
                      <div className="text-[11px] text-amber-700 font-semibold">باقات معطلة / مسودة</div>
                      <div className="text-xl font-black text-amber-600 mt-0.5">
                        {plans.filter((p) => !p.is_active).length}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 shadow-xs">
                      <div className="text-[11px] text-blue-700 font-semibold">المعاهد المشتركة</div>
                      <div className="text-xl font-black text-blue-600 mt-0.5">{subscriptions.length}</div>
                    </div>
                  </div>

                  {plans.length === 0 ? (
                    <Card className="p-8">
                      <EmptyState
                        title="لا توجد باقات معرّفة حالياً"
                        description="أضف باقات اشتراك لعرضها في صفحة الهبوط وتمكين المعاهد من الاشتراك والتسجيل"
                        actionLabel="إضافة أول باقة الآن"
                        onAction={() => setPlanViewMode('create')}
                      />
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {plans.map((p) => {
                        const parsedFeatures = parsePlanFeatures(p.features);
                        return (
                          <Card
                            key={p.id}
                            className={`flex flex-col justify-between shadow-xs transition-all duration-200 overflow-hidden ${
                              p.is_active
                                ? 'border-border hover:border-primary/40 hover:shadow-md'
                                : 'border-dashed border-border/80 opacity-75 bg-muted/20'
                            }`}
                          >
                            {/* Plan Visual Image Banner */}
                            <div className="relative h-36 w-full overflow-hidden bg-slate-100 border-b border-border/50">
                              <img
                                src={p.image_url || '/images/plan_basic.jpg'}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/images/plan_basic.jpg';
                                }}
                              />
                              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                                  {p.billing_cycle === 'monthly' ? 'شهري' : p.billing_cycle === 'yearly' ? 'سنوي' : p.billing_cycle}
                                </span>
                              </div>
                              <div className="absolute bottom-2 left-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold backdrop-blur-xs ${
                                  p.is_active ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
                                }`}>
                                  {p.is_active ? 'نشطة (معروضة)' : 'معطلة (مخفية)'}
                                </span>
                              </div>
                            </div>

                            <CardHeader className="pb-3 border-b border-border/60">
                              <div className="flex items-center justify-between gap-2">
                                <CardTitle className="text-base font-bold truncate">{p.name}</CardTitle>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlanStatus(p.id)}
                                  title={p.is_active ? 'انقر لإيقاف الباقة وإخفائها من صفحة الهبوط' : 'انقر لتفعيل الباقة وإظهارها'}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                                    p.is_active
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                  }`}
                                >
                                  {p.is_active ? 'نشطة' : 'معطلة'}
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground font-mono">
                                <span>Slug:</span>
                                <span className="bg-muted px-1.5 py-0.2 rounded text-foreground font-semibold">{p.slug}</span>
                              </div>
                              <CardDescription className="text-xs mt-1.5 line-clamp-2">
                                {p.description || 'باقة متكاملة لإدارة شؤون المعهد والطلاب'}
                              </CardDescription>
                            </CardHeader>

                            <CardContent className="pt-4 space-y-4 flex-1">
                              {/* Price */}
                              <div className="text-2xl font-black text-foreground">
                                {Number(p.price_iqd).toLocaleString()}{' '}
                                <span className="text-xs font-normal text-muted-foreground">د.ع / دورة الفوترة</span>
                              </div>

                              <Separator />

                              {/* Quotas */}
                              <div className="space-y-1.5 text-xs text-muted-foreground">
                                <div className="flex items-center justify-between py-0.5">
                                  <span>سعة الطلاب القصوى:</span>
                                  <strong className="text-foreground font-bold">{p.max_students.toLocaleString()} طالب</strong>
                                </div>
                                <div className="flex items-center justify-between py-0.5">
                                  <span>سعة الكادر والمدرسين:</span>
                                  <strong className="text-foreground font-bold">{p.max_teachers} أستاذ</strong>
                                </div>
                                <div className="flex items-center justify-between py-0.5">
                                  <span>الفروع المصرح بها:</span>
                                  <strong className="text-foreground font-bold">{p.max_branches} فرع</strong>
                                </div>
                              </div>

                              <Separator />

                              {/* Features Badges Cloud */}
                              <div>
                                <div className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1">
                                  <Tag className="w-3 h-3 text-primary" />
                                  <span>الميزات المشمولة ({parsedFeatures.length}):</span>
                                </div>
                                {parsedFeatures.length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground italic">لم يتم إدخال ميزات مخصصة بعد</p>
                                ) : (
                                  <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                                    {parsedFeatures.map((feat, fIdx) => (
                                      <li key={fIdx} className="flex items-start gap-1.5 leading-tight">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                        <span>{feat}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </CardContent>

                            {/* Action Buttons Toolbar */}
                            <div className="p-4 pt-2 border-t border-border/60 flex items-center gap-2 bg-muted/10">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditPlan(p)}
                                className="flex-1 text-xs font-bold gap-1 h-8"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>تعديل</span>
                              </Button>
                              <Button
                                variant={p.is_active ? 'ghost' : 'default'}
                                size="sm"
                                onClick={() => handleTogglePlanStatus(p.id)}
                                className={`h-8 px-2.5 text-xs font-bold ${
                                  p.is_active ? 'text-amber-700 hover:bg-amber-50' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                                title={p.is_active ? 'إيقاف الباقة مؤقتاً' : 'تفعيل الباقة'}
                              >
                                {p.is_active ? 'إيقاف' : 'تفعيل'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePlan(p.id, p.name)}
                                className="h-8 px-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                                title="حذف الباقة نهائياً"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. SUBSCRIPTIONS SECTION */}
          {activeTab === 'subscriptions' && (
            <Card className="shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    إدارة الاشتراكات والتراخيص
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    متابعة اشتراكات المعاهد النشطة وتواريخ الصلاحية والتجديد والإلغاء الفوري
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowCreateSub(true)}
                  className="gap-1.5 text-xs font-bold"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  تخصيص اشتراك جديد
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {subscriptions.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      title="لا توجد اشتراكات مسجلة حالياً"
                      description="قم بربط معهد بباقة اشتراك لتفعيل تراخيصه وصلاحياته فورياً"
                      actionLabel="تخصيص اشتراك الآن"
                      onAction={() => setShowCreateSub(true)}
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-xs">المعهد المشترك</TableHead>
                        <TableHead className="font-bold text-xs">الباقة والتسعير</TableHead>
                        <TableHead className="font-bold text-xs">حدود السعة</TableHead>
                        <TableHead className="font-bold text-xs">الحالة والصلاحية</TableHead>
                        <TableHead className="font-bold text-xs">تاريخ البدء والانتهاء</TableHead>
                        <TableHead className="font-bold text-xs text-center">إدارة الاشتراك والترقية</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => {
                        const tenant = institutes.find((i) => i.id === sub.tenant_id);
                        const isExpired = new Date(sub.ends_at) < new Date();
                        const remainingDays = Math.ceil(
                          (new Date(sub.ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        );

                        return (
                          <TableRow key={sub.id} className="text-xs">
                            <TableCell className="font-bold text-foreground">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs shadow-xs"
                                  style={{ backgroundColor: tenant?.primary_color || '#4f46e5' }}
                                >
                                  <School className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="font-bold">{tenant?.name || 'معهد غير معرّف'}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">{tenant?.slug}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <Badge variant="outline" className="font-bold text-[11px] border-primary/20 bg-primary/5 text-primary">
                                  {sub.plan?.name || 'باقة محددة'}
                                </Badge>
                                <div className="font-mono text-[11px] text-emerald-600 font-bold">
                                  {sub.plan ? `${Number(sub.plan.price_iqd).toLocaleString('ar-IQ')} د.ع` : '—'}
                                  <span className="text-[10px] text-muted-foreground font-normal mr-1">
                                    ({sub.plan?.billing_cycle === 'monthly' ? 'شهري' : sub.plan?.billing_cycle || ''})
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[11px]">
                              {sub.plan ? (
                                <div className="space-y-0.5">
                                  <div>{sub.plan.max_students} طالب</div>
                                  <div className="text-[10px] text-muted-foreground/80">
                                    {sub.plan.max_teachers} أستاذ • {sub.plan.max_branches} فرع
                                  </div>
                                </div>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge
                                  variant={
                                    sub.status === 'active' && !isExpired
                                      ? 'default'
                                      : sub.status === 'trialing'
                                      ? 'secondary'
                                      : 'destructive'
                                  }
                                  className="font-bold text-[10px]"
                                >
                                  {sub.status === 'active' && !isExpired
                                    ? 'نشط'
                                    : sub.status === 'trialing'
                                    ? 'تجريبي'
                                    : sub.status === 'canceled'
                                    ? 'ملغى'
                                    : 'منتهي الصلاحية'}
                                </Badge>
                                <div className="text-[10px]">
                                  {isExpired ? (
                                    <span className="text-destructive font-semibold">منتهي الصلاحية</span>
                                  ) : (
                                    <span className="text-emerald-600 font-semibold">متبقي {remainingDays} يوماً</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground text-[11px]" dir="ltr">
                              <div>{new Date(sub.starts_at).toLocaleDateString('ar-IQ')}</div>
                              <div className={isExpired ? 'text-destructive font-bold' : 'text-foreground font-semibold'}>
                                {new Date(sub.ends_at).toLocaleDateString('ar-IQ')}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {sub.status === 'trialing' && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleActivateSubscription(sub.id, 30)}
                                    className="h-7 px-2 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                    title="تفعيل الاشتراك رسمياً وإنهاء الفترة التجريبية"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>تفعيل رسمي</span>
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenChangePlan(sub)}
                                  className="h-7 px-2 text-[11px] font-bold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                                  title="ترقية أو تغيير الخطة"
                                >
                                  <Sparkles className="w-3 h-3 text-primary" />
                                  <span>تغيير الخطة</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRenewSubscription(sub.id, 30)}
                                  className="h-7 px-2 text-[11px] font-bold gap-1"
                                  title="تجديد +30 يوم"
                                >
                                  <RotateCw className="w-3 h-3" />
                                  <span>تجديد</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenPaymentForTenant(sub.tenant_id, sub.id)}
                                  className="h-7 px-2 text-[11px] font-bold gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  title="تسجيل دفعة وسند قبض"
                                >
                                  <DollarSign className="w-3 h-3" />
                                  <span>سند قبض</span>
                                </Button>
                                {sub.status !== 'canceled' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCancelSubscription(sub.id)}
                                    className="h-7 px-2 text-[11px] font-bold text-destructive hover:bg-destructive/10"
                                    title="إلغاء الاشتراك"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>إلغاء</span>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* 4. RECEIPTS SECTION */}
          {activeTab === 'receipts' && (
            <Card className="shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    السجل المالي وإيصالات القبض
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    سجل القيود المالية الصارمة بالدينار العراقي للمشتركين مع تفاصيل الدفع والتدقيق
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowRecordPayment(true)}
                  className="gap-1.5 text-xs font-bold"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  تسجيل إيصال مالي
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {receipts.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      title="لا توجد إيصالات مسجلة حالياً"
                      description="تظهر هنا قيود المدفوعات المسجلة مع توثيق هوية المحاسب"
                      actionLabel="تسجيل إيصال الآن"
                      onAction={() => setShowRecordPayment(true)}
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-xs">رقم الإيصال</TableHead>
                        <TableHead className="font-bold text-xs">المعهد المسدد</TableHead>
                        <TableHead className="font-bold text-xs">المبلغ المحصل</TableHead>
                        <TableHead className="font-bold text-xs">طريقة الدفع</TableHead>
                        <TableHead className="font-bold text-xs">ملاحظات التدقيق</TableHead>
                        <TableHead className="font-bold text-xs">تاريخ القيد</TableHead>
                        <TableHead className="font-bold text-xs text-center">السند</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.map((r) => {
                        const tenant = institutes.find((i) => i.id === r.tenant_id);
                        return (
                          <TableRow key={r.id} className="text-xs">
                            <TableCell className="font-mono font-bold text-primary">
                              {r.receipt_number}
                            </TableCell>
                            <TableCell className="font-bold text-foreground">
                              {tenant?.name || 'معهد غير معرّف'}
                            </TableCell>
                            <TableCell className="font-bold text-emerald-600">
                              {r.amount_iqd.toLocaleString()} د.ع
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <Badge variant="secondary" className="font-medium text-[11px]">
                                {r.payment_method === 'cash'
                                  ? 'نقدي'
                                  : r.payment_method === 'bank_transfer'
                                  ? 'حوالة مصرفية'
                                  : r.payment_method === 'cheque'
                                  ? 'صك'
                                  : r.payment_method}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {r.reference_note || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground font-mono text-[11px]" dir="ltr">
                              {new Date(r.paid_at).toLocaleDateString('ar-IQ')}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingReceipt(r)}
                                className="h-7 px-2 text-xs font-bold gap-1"
                                title="معاينة سند القبض"
                              >
                                <Eye className="w-3 h-3 text-primary" />
                                <span>معاينة</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* 4. DOMAINS SECTION */}
          {activeTab === 'domains' && (
            <Card className="shadow-xs">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  النطاقات والمجالات المسجلة
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  حالة النطاقات المخصصة ورموز التحقق عبر DNS TXT
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {domains.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      title="لا توجد نطاقات مخصصة مسجلة"
                      description="تظهر هنا النطاقات المخصصة المسجلة لكل معهد وحالة توثيق ملكيتها"
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-xs">النطاق</TableHead>
                        <TableHead className="font-bold text-xs">الحالة</TableHead>
                        <TableHead className="font-bold text-xs">رمز التحقق</TableHead>
                        <TableHead className="font-bold text-xs text-center">أساسي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {domains.map((d) => (
                        <TableRow key={d.id} className="text-xs">
                          <TableCell className="font-mono font-bold text-foreground">
                            {d.domain}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={d.status === 'active' || d.status === 'verified' ? 'default' : 'secondary'}
                              className="text-[11px] font-bold"
                            >
                              {d.status === 'active' ? 'نشط وموجه' : 'قيد التحقق'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground text-[11px]">
                            {d.verification_token}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {d.is_primary ? (
                              <Badge variant="outline" className="text-primary border-primary/30">نعم</Badge>
                            ) : (
                              <span className="text-muted-foreground">لا</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* AUDIT LOGS TAB */}
          {activeTab === 'audit' && (
            <Card className="shadow-sm">
              <CardHeader className="text-right">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  سجل التدقيق والأمان الإداري والمالي
                </CardTitle>
                <CardDescription className="text-xs">
                  سجل غير قابل للتعديل يوثق كافة العمليات الإدارية والمالية والأمنية الحساسة
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <EmptyState
                    title="لا توجد سجلات تدقيق"
                    description="لا توجد سجلات تدقيق مسجلة حتى الآن."
                  />
                ) : (
                  <Table dir="rtl">
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="text-right">التاريخ والوقت</TableHead>
                        <TableHead className="text-right">نوع العملية</TableHead>
                        <TableHead className="text-right">الكيان</TableHead>
                        <TableHead className="text-right">الدور المنفذ</TableHead>
                        <TableHead className="text-right">التفاصيل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id} className="text-xs">
                          <TableCell className="text-muted-foreground font-mono text-[11px]" dir="ltr">
                            {new Date(log.created_at).toLocaleString('ar-IQ')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[11px] font-bold border-primary/20 bg-primary/5 text-primary">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {log.entity_type} {log.entity_id ? `(${log.entity_id.substring(0, 8)}...)` : ''}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground font-semibold">
                              {log.actor_role || 'النظام'}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground max-w-xs truncate" dir="ltr">
                            {log.details}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* INQUIRIES TAB */}
          {activeTab === 'inquiries' && (
            <Card className="shadow-xs border-border/80">
              <CardHeader className="text-right">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      طلبات الانضمام والاستشارات الواردة
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      استعراض بيانات الزوار وأصحاب المعاهد المهتمين، مع إمكانية تحويل أي طلب مباشرة إلى معهد جديد
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {inquiries.length} طلب إجمالي
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {inquiries.length === 0 ? (
                  <EmptyState
                    title="لا توجد طلبات واردة حالياً"
                    description="ستظهر هنا كافة طلبات الاستشارة والتسجيل المعبأة من صفحة الهبوط."
                  />
                ) : (
                  <Table dir="rtl">
                    <TableHeader>
                      <TableRow className="text-xs font-bold bg-muted/40">
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الاسم الكامل</TableHead>
                        <TableHead className="text-right">رقم الهاتف</TableHead>
                        <TableHead className="text-right">اسم المعهد</TableHead>
                        <TableHead className="text-right">نوع الطلب</TableHead>
                        <TableHead className="text-right">الملاحظات</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-left">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inquiries.map((inq) => (
                        <TableRow key={inq.id} className="text-xs">
                          <TableCell className="text-muted-foreground font-mono text-[11px]" dir="ltr">
                            {new Date(inq.created_at).toLocaleDateString('ar-IQ')}
                          </TableCell>
                          <TableCell className="font-bold text-foreground">
                            {inq.full_name}
                          </TableCell>
                          <TableCell dir="ltr" className="font-mono text-primary font-bold">
                            <a href={`tel:${inq.phone}`} className="hover:underline">
                              {inq.phone}
                            </a>
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {inq.institute_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[11px]">
                              {inq.request_type === 'consultation'
                                ? 'استشارة مجانية'
                                : inq.request_type === 'booking'
                                ? 'حجز واشتراك'
                                : 'معاينة المنظومة'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[11px] max-w-xs truncate">
                            {inq.notes || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                inq.status === 'converted'
                                  ? 'default'
                                  : inq.status === 'contacted'
                                  ? 'secondary'
                                  : inq.status === 'rejected'
                                  ? 'outline'
                                  : 'destructive'
                              }
                              className="text-[11px] font-bold"
                            >
                              {inq.status === 'pending'
                                ? 'معلق جديد'
                                : inq.status === 'contacted'
                                ? 'تم التواصل'
                                : inq.status === 'converted'
                                ? 'تم التحويل لمعهد'
                                : 'مرفوض'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left">
                            <div className="flex items-center justify-end gap-1.5">
                              {inq.status !== 'converted' ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenConvertInquiry(inq)}
                                    className="h-7 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>تحويل لمعهد</span>
                                  </Button>
                                  {inq.status !== 'contacted' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUpdateInquiryStatus(inq.id, 'contacted')}
                                      className="h-7 text-[11px]"
                                    >
                                      تم التواصل
                                    </Button>
                                  )}
                                  {inq.status !== 'rejected' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleUpdateInquiryStatus(inq.id, 'rejected')}
                                      className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                                    >
                                      رفض
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <Badge variant="outline" className="text-emerald-700 text-[11px] border-emerald-300">
                                  معهد قائم ✓
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* SUPPORT TICKETS TAB */}
          {activeTab === 'support' && (
            <Card className="shadow-xs border-border/80">
              <CardHeader className="text-right">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <LifeBuoy className="h-4 w-4 text-primary" />
                      تذاكر الدعم الفني للمنظومة
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      متابعة البلاغات والاستفسارات الفنية الواردة من إدارات المعاهد المشتركة والرد عليها
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {supportTickets.length} تذكرة
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {supportTickets.length === 0 ? (
                  <EmptyState
                    title="لا توجد تذاكر دعم فني"
                    description="تظهر هنا البلاغات والاستفسارات المرفوعة من قبل مديري المعاهد."
                  />
                ) : (
                  <Table dir="rtl">
                    <TableHeader>
                      <TableRow className="text-xs font-bold bg-muted/40">
                        <TableHead className="text-right">رقم التذكرة</TableHead>
                        <TableHead className="text-right">المعهد</TableHead>
                        <TableHead className="text-right">الموضوع</TableHead>
                        <TableHead className="text-right">الأولوية</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">تاريخ الإرسال</TableHead>
                        <TableHead className="text-left">الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supportTickets.map((t) => (
                        <TableRow key={t.id} className="text-xs">
                          <TableCell className="font-mono font-bold text-foreground">
                            {t.ticket_number}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {t.tenant?.name || institutes.find((i) => i.id === t.tenant_id)?.name || 'معهد'}
                          </TableCell>
                          <TableCell className="font-medium text-foreground max-w-sm truncate">
                            {t.subject}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                t.priority === 'urgent'
                                  ? 'destructive'
                                  : t.priority === 'high'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="text-[11px] font-bold"
                            >
                              {t.priority === 'urgent'
                                ? 'عاجل جداً'
                                : t.priority === 'high'
                                ? 'أولوية عالية'
                                : t.priority === 'low'
                                ? 'منخفضة'
                                : 'متوسطة'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                t.status === 'resolved'
                                  ? 'default'
                                  : t.status === 'in_progress'
                                  ? 'secondary'
                                  : t.status === 'closed'
                                  ? 'outline'
                                  : 'destructive'
                              }
                              className="text-[11px] font-bold"
                            >
                              {t.status === 'open'
                                ? 'مفتوحة'
                                : t.status === 'in_progress'
                                ? 'قيد المعالجة'
                                : t.status === 'resolved'
                                ? 'تم الحل والرد'
                                : 'مغلقة'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-[11px]" dir="ltr">
                            {new Date(t.created_at).toLocaleDateString('ar-IQ')}
                          </TableCell>
                          <TableCell className="text-left">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReplyTicket(t)}
                              className="h-7 text-[11px] font-bold gap-1"
                            >
                              <Reply className="w-3 h-3 text-primary" />
                              <span>معاينة والرد</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* CMS SETTINGS TAB */}
          {activeTab === 'cms' && (
            <Card className="shadow-xs border-border/80 max-w-3xl">
              <CardHeader className="text-right">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  إعدادات المحتوى العام للمنصة (Landing Page CMS)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  تحديث نصوص صفحة الهبوط ومعلومات التواصل الرسمية فورياً للزوار
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  {settingsSaved && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-right flex items-center gap-2 text-emerald-800 text-xs font-bold">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>تم حفظ ونشر إعدادات المنصة بنجاح على صفحة الهبوط!</span>
                    </div>
                  )}

                  {/* Section 1: Hero Settings */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-foreground text-right border-b pb-1.5">
                      قسم الترويسة الرئيسية (Hero Section)
                    </p>
                    <div className="space-y-1.5 text-right">
                      <Label className="text-xs font-semibold">العنوان الرئيسي للواجهة</Label>
                      <Input
                        value={settingsForm.hero_title || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, hero_title: e.target.value })}
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <Label className="text-xs font-semibold">الوصف الترحيبي الفرعي</Label>
                      <Input
                        value={settingsForm.hero_subtitle || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, hero_subtitle: e.target.value })}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  {/* Section 2: Contact info */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-foreground text-right border-b pb-1.5">
                      بيانات التواصل والدعم الرسمية
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-right">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">رقم الهاتف الرسمي</Label>
                        <Input
                          dir="ltr"
                          value={settingsForm.platform_phone || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, platform_phone: e.target.value })}
                          className="text-xs h-9 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">البريد الإلكتروني الرسمي</Label>
                        <Input
                          dir="ltr"
                          type="email"
                          value={settingsForm.platform_email || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, platform_email: e.target.value })}
                          className="text-xs h-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <Label className="text-xs font-semibold">العنوان الجغرافي للمنصة</Label>
                      <Input
                        value={settingsForm.platform_address || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, platform_address: e.target.value })}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  {/* Section 3: Pricing highlight */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-foreground text-right border-b pb-1.5">
                      إعدادات الباقات والتسعير
                    </p>
                    <div className="space-y-1.5 text-right">
                      <Label className="text-xs font-semibold">معرّف الخطة الأكثر طلباً (Featured Slug)</Label>
                      <Input
                        dir="ltr"
                        value={settingsForm.featured_plan_slug || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, featured_plan_slug: e.target.value })}
                        placeholder="pro"
                        className="text-xs h-9 font-mono max-w-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        يحدد أي خطة يتم تمييزها بإطار خاص وتاج 'الأكثر طلباً' في جدول الأسعار
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t">
                    <Button
                      type="submit"
                      disabled={saveSettingsLoading}
                      className="text-xs font-bold gap-2 px-6 h-9"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saveSettingsLoading ? 'جاري الحفظ...' : 'حفظ ونشر التعديلات'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* CREATE INSTITUTE DIALOG */}
      <Dialog open={showCreateInstitute} onOpenChange={setShowCreateInstitute}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              إنشاء معهد جديد وحساب مديره
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              قم بتعبئة بيانات المعهد وتحديد معرّف الوصول وبيانات المدير المؤسس
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInstitute} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">اسم المعهد</Label>
                <Input
                  required
                  value={instForm.name}
                  onChange={(e) => setInstForm({ ...instForm, name: e.target.value })}
                  placeholder="معهد المتفوقين"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">المعرّف (Slug)</Label>
                <Input
                  dir="ltr"
                  required
                  value={instForm.slug}
                  onChange={(e) => setInstForm({ ...instForm, slug: e.target.value })}
                  placeholder="al-motafawqeen"
                  className="text-xs font-mono h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">بريد التواصل</Label>
                <Input
                  type="email"
                  dir="ltr"
                  value={instForm.email}
                  onChange={(e) => setInstForm({ ...instForm, email: e.target.value })}
                  placeholder="info@institute.edu"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رقم الهاتف</Label>
                <Input
                  type="text"
                  dir="ltr"
                  value={instForm.phone}
                  onChange={(e) => setInstForm({ ...instForm, phone: e.target.value })}
                  placeholder="07700000000"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رابط شعار المعهد (Logo URL)</Label>
                <Input
                  dir="ltr"
                  value={instForm.logo_url}
                  onChange={(e) => setInstForm({ ...instForm, logo_url: e.target.value })}
                  placeholder="https://.../logo.png"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-primary" />
                  <span>اللون الرئيسي</span>
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={instForm.primary_color}
                    onChange={(e) => setInstForm({ ...instForm, primary_color: e.target.value })}
                    className="w-9 h-9 p-0.5 rounded border border-border cursor-pointer bg-background"
                  />
                  <Input
                    dir="ltr"
                    value={instForm.primary_color}
                    onChange={(e) => setInstForm({ ...instForm, primary_color: e.target.value })}
                    placeholder="#4f46e5"
                    className="text-xs font-mono h-9 flex-1"
                  />
                </div>
              </div>
            </div>

            <Separator />
            <p className="text-xs font-bold text-foreground text-right">بيانات المدير المؤسس</p>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اسم المدير</Label>
              <Input
                required
                value={instForm.admin_name}
                onChange={(e) => setInstForm({ ...instForm, admin_name: e.target.value })}
                placeholder="الأستاذ مصطفى علي"
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">بريد الدخول للمدير</Label>
                <Input
                  type="email"
                  dir="ltr"
                  required
                  value={instForm.admin_email}
                  onChange={(e) => setInstForm({ ...instForm, admin_email: e.target.value })}
                  placeholder="admin@institute.edu"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">كلمة المرور للمدير</Label>
                <Input
                  type="password"
                  dir="ltr"
                  required
                  value={instForm.admin_password}
                  onChange={(e) => setInstForm({ ...instForm, admin_password: e.target.value })}
                  placeholder="••••••••"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateInstitute(false)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createInstLoading}
                className="text-xs font-bold"
              >
                {createInstLoading ? 'جاري الإنشاء...' : 'إنشاء المعهد'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT INSTITUTE DIALOG */}
      <Dialog open={showEditInstitute} onOpenChange={setShowEditInstitute}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              تعديل بيانات وهويّة المعهد
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              تحديث الاسم، بيانات الاتصال، شعار المعهد ولونه المخصص
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateInstitute} className="space-y-4 py-2">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اسم المعهد</Label>
              <Input
                required
                value={editInstForm.name}
                onChange={(e) => setEditInstForm({ ...editInstForm, name: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">بريد التواصل</Label>
                <Input
                  type="email"
                  dir="ltr"
                  value={editInstForm.email}
                  onChange={(e) => setEditInstForm({ ...editInstForm, email: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رقم الهاتف</Label>
                <Input
                  type="text"
                  dir="ltr"
                  value={editInstForm.phone}
                  onChange={(e) => setEditInstForm({ ...editInstForm, phone: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">العنوان الجغرافي</Label>
              <Input
                value={editInstForm.address}
                onChange={(e) => setEditInstForm({ ...editInstForm, address: e.target.value })}
                placeholder="بغداد - المنصور"
                className="text-xs h-9"
              />
            </div>

            <Separator />
            <p className="text-xs font-bold text-foreground text-right flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" />
              الهوية البصرية للمعهد
            </p>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">رابط الشعار (Logo URL)</Label>
              <Input
                dir="ltr"
                value={editInstForm.logo_url}
                onChange={(e) => setEditInstForm({ ...editInstForm, logo_url: e.target.value })}
                placeholder="https://.../logo.png"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اللون الرئيسي للبراند</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editInstForm.primary_color}
                  onChange={(e) => setEditInstForm({ ...editInstForm, primary_color: e.target.value })}
                  className="w-9 h-9 p-0.5 rounded border border-border cursor-pointer bg-background"
                />
                <Input
                  dir="ltr"
                  value={editInstForm.primary_color}
                  onChange={(e) => setEditInstForm({ ...editInstForm, primary_color: e.target.value })}
                  placeholder="#4f46e5"
                  className="text-xs font-mono h-9 flex-1"
                />
                <div
                  className="px-3 h-9 rounded flex items-center justify-center text-xs text-white font-bold shadow-xs"
                  style={{ backgroundColor: editInstForm.primary_color }}
                >
                  معاينة
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEditInstitute(false)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={editInstLoading}
                className="text-xs font-bold"
              >
                {editInstLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE SUBSCRIPTION DIALOG */}
      <Dialog open={showCreateSub} onOpenChange={setShowCreateSub}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              ربط وتفعيل اشتراك لمعهد
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              تحديد المعهد والخطة ومدة الصلاحية بالشهور أو الأيام
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubscription} className="space-y-3.5 py-2">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اختر المعهد المستفيد</Label>
              <select
                required
                value={subForm.tenant_id}
                onChange={(e) => setSubForm({ ...subForm, tenant_id: e.target.value })}
                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">-- اضغط لاختيار المعهد --</option>
                {institutes.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اختر خطة الاشتراك</Label>
              <select
                required
                value={subForm.plan_id}
                onChange={(e) => setSubForm({ ...subForm, plan_id: e.target.value })}
                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">-- اضغط لاختيار الخطة --</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {p.price_iqd.toLocaleString()} د.ع ({p.billing_cycle === 'monthly' ? 'شهري' : p.billing_cycle})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">مدة الاشتراك (بالأيام)</Label>
              <Input
                type="number"
                min="1"
                required
                dir="ltr"
                value={subForm.duration_days}
                onChange={(e) => setSubForm({ ...subForm, duration_days: parseInt(e.target.value) || 30 })}
                placeholder="30"
                className="text-xs h-9 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">الافتراضي: 30 يوماً لشهر كامل، أو 365 يوماً لسنة كاملة</p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateSub(false)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createSubLoading}
                className="text-xs font-bold"
              >
                {createSubLoading ? 'جاري التفعيل...' : 'تفعيل الاشتراك'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CHANGE / UPGRADE PLAN DIALOG */}
      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              ترقية وتغيير خطة الاشتراك
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              اختر باقة جديدة لترقية أو تبديل اشتراك المعهد فورياً
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePlan} className="space-y-4 py-2">
            {changePlanSub && (
              <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs space-y-1">
                <div className="font-bold text-foreground">
                  المعهد: {institutes.find((i) => i.id === changePlanSub.tenant_id)?.name || 'معهد محدد'}
                </div>
                <div className="text-muted-foreground">
                  الخطة الحالية: {changePlanSub.plan?.name || 'غير محددة'} ({changePlanSub.plan ? `${Number(changePlanSub.plan.price_iqd).toLocaleString('ar-IQ')} د.ع` : ''})
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اختر الخطة الجديدة</Label>
              <select
                required
                value={selectedNewPlanId}
                onChange={(e) => setSelectedNewPlanId(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">-- اضغط لاختيار الخطة --</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {p.price_iqd.toLocaleString()} د.ع ({p.billing_cycle === 'monthly' ? 'شهري' : p.billing_cycle})
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowChangePlan(false)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={changePlanLoading || !selectedNewPlanId}
                className="text-xs font-bold bg-primary text-white"
              >
                {changePlanLoading ? 'جاري التحديث...' : 'تأكيد تغيير الخطة'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RECORD PAYMENT DIALOG */}
      <Dialog open={showRecordPayment} onOpenChange={setShowRecordPayment}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              تسجيل سند قبض مالي يدوي
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              تسجيل الدفعة بالدينار العراقي (IQD) وإصدار رقم سند معتمد
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-3.5 py-2">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">المعهد الدافع</Label>
              <select
                required
                value={paymentForm.tenant_id}
                onChange={(e) => setPaymentForm({ ...paymentForm, tenant_id: e.target.value })}
                className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">-- اضغط لاختيار المعهد --</option>
                {institutes.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">المبلغ (دينار عراقي IQD)</Label>
                <Input
                  type="number"
                  min="1"
                  step="1000"
                  required
                  dir="ltr"
                  value={paymentForm.amount_iqd}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount_iqd: parseInt(e.target.value) || 0 })}
                  className="text-xs h-9 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">طريقة الاستلام</Label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="cash">نقداً (كاش)</option>
                  <option value="bank_transfer">حوالة مصرفية / زين كاش</option>
                  <option value="manual_receipt">وصل قبض ورقي</option>
                  <option value="cheque">صك مصدّق</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">ملاحظات السند / رقم الإشعار</Label>
              <Input
                value={paymentForm.reference_note}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference_note: e.target.value })}
                placeholder="مثال: تسديد اشتراك سنوي - إشعار محفظة 98214"
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRecordPayment(false)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={recordPaymentLoading}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {recordPaymentLoading ? 'جاري الإصدار...' : 'إصدار سند القبض'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW RECEIPT VOUCHER MODAL */}
      <Dialog open={!!viewingReceipt} onOpenChange={(open) => !open && setViewingReceipt(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader className="text-right border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
                  <Receipt className="h-4 w-4 text-primary" />
                  سند قبض مالي رسمي
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  منظومة إدارة المنصة الأكاديمية المركزية
                </DialogDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold bg-muted px-2.5 py-1">
                {viewingReceipt?.receipt_number}
              </Badge>
            </div>
          </DialogHeader>

          {viewingReceipt && (
            <div className="space-y-4 py-2 text-xs">
              {/* Receipt Details Card */}
              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">المعهد المسدد:</span>
                  <span className="font-bold text-foreground">
                    {institutes.find((i) => i.id === viewingReceipt.tenant_id)?.name || viewingReceipt.tenant_id}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">المبلغ الإجمالي المدفوع:</span>
                  <span className="font-black text-sm text-emerald-600 font-mono">
                    {viewingReceipt.amount_iqd.toLocaleString()} د.ع ({viewingReceipt.currency})
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">طريقة الدفع:</span>
                  <Badge variant="secondary" className="font-bold text-[11px]">
                    {viewingReceipt.payment_method === 'cash' ? 'نقداً (كاش)' :
                     viewingReceipt.payment_method === 'bank_transfer' ? 'حوالة مصرفية / محفظة' :
                     viewingReceipt.payment_method === 'manual_receipt' ? 'وصل ورقي' :
                     viewingReceipt.payment_method === 'cheque' ? 'صك مصدّق' : 'أخرى'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-medium">تاريخ وساعة القبض:</span>
                  <span className="font-mono text-muted-foreground">
                    {new Date(viewingReceipt.paid_at).toLocaleString('ar-IQ')}
                  </span>
                </div>

                {viewingReceipt.reference_note && (
                  <div className="py-1">
                    <span className="text-muted-foreground block mb-1">البيان والملاحظات:</span>
                    <p className="p-2.5 rounded-lg bg-muted/50 border border-border/50 font-medium text-foreground">
                      {viewingReceipt.reference_note}
                    </p>
                  </div>
                )}
              </div>

              {/* Stamp & Certification watermark footer */}
              <div className="flex items-center justify-between px-2 pt-2 text-[11px] text-muted-foreground border-t border-dashed border-border">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>سند مالي مؤكد بنظام الحسابات المركزي</span>
                </div>
                <span>العملة الرسمية: الدينار العراقي (IQD)</span>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingReceipt(null)}
                  className="text-xs font-bold"
                >
                  إغلاق
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => window.print()}
                  className="text-xs font-bold flex items-center gap-1.5 bg-primary text-primary-foreground"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة السند
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CONVERT INQUIRY TO TENANT DIALOG */}
      <Dialog open={!!convertingInquiry} onOpenChange={(open) => !open && setConvertingInquiry(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              تحويل الطلب لحساب معهد رسمي
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              سيتم إنشاء قاعدة بيانات المعهد وحساب المدير المؤسس تلقائياً بضغطة زر واحدة
            </DialogDescription>
          </DialogHeader>

          {convertingInquiry && (
            <form onSubmit={handleConvertInquiry} className="space-y-3.5 py-2">
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1.5 text-xs text-right">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">اسم المعهد المطلوب:</span>
                  <span className="font-bold">{convertingInquiry.institute_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">صاحب الطلب:</span>
                  <span className="font-semibold">{convertingInquiry.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رقم الهاتف:</span>
                  <span className="font-mono" dir="ltr">{convertingInquiry.phone}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">المعرّف اللاتيني (Slug)</Label>
                <Input
                  required
                  dir="ltr"
                  value={convertForm.slug}
                  onChange={(e) => setConvertForm({ ...convertForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="text-xs h-9 font-mono"
                />
                <p className="text-[11px] text-muted-foreground">يُستخدم لتسجيل الدخول والنطاق الفرعي</p>
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">بريد المدير المؤسس</Label>
                <Input
                  type="email"
                  required
                  dir="ltr"
                  value={convertForm.admin_email}
                  onChange={(e) => setConvertForm({ ...convertForm, admin_email: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">كلمة المرور الأولية</Label>
                <Input
                  type="password"
                  required
                  dir="ltr"
                  value={convertForm.admin_password}
                  onChange={(e) => setConvertForm({ ...convertForm, admin_password: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConvertingInquiry(null)}
                  className="text-xs font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={convertLoading}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {convertLoading ? 'جاري التأسيس...' : 'إنشاء المعهد وتفعيله'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* REPLY SUPPORT TICKET DIALOG */}
      <Dialog open={!!replyingTicket} onOpenChange={(open) => !open && setReplyingTicket(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Reply className="h-4 w-4 text-primary" />
              الرد على تذكرة الدعم الفني
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              رقم التذكرة: {replyingTicket?.ticket_number}
            </DialogDescription>
          </DialogHeader>

          {replyingTicket && (
            <form onSubmit={handleReplyTicket} className="space-y-3.5 py-2">
              <div className="space-y-1 text-right">
                <span className="text-xs font-semibold text-muted-foreground block">موضوع التذكرة:</span>
                <p className="text-xs font-bold text-foreground">{replyingTicket.subject}</p>
              </div>

              <div className="space-y-1 text-right">
                <span className="text-xs font-semibold text-muted-foreground block">وصف المشكلة من المعهد:</span>
                <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-foreground max-h-32 overflow-y-auto leading-relaxed">
                  {replyingTicket.description}
                </div>
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">نص رد إدارة المنصة</Label>
                <textarea
                  required
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="اكتب ردك أو التوجيهات أو الحل المقدم لإدارة المعهد هنا..."
                  className="w-full p-2.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">حالة التذكرة بعد الرد</Label>
                <select
                  value={replyStatus}
                  onChange={(e) => setReplyStatus(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="resolved">تم الحل والرد (Resolved)</option>
                  <option value="in_progress">قيد المعالجة الفنية (In Progress)</option>
                  <option value="closed">إغلاق التذكرة نهائياً (Closed)</option>
                  <option value="open">إبقاء مفتوحة (Open)</option>
                </select>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReplyingTicket(null)}
                  className="text-xs font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={replyLoading}
                  className="text-xs font-bold bg-primary text-primary-foreground"
                >
                  {replyLoading ? 'جاري الإرسال...' : 'إرسال الرد وتحديث التذكرة'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};
