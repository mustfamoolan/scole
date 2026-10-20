import React, { useState, useEffect } from 'react';
import { SchoolBanner, DEFAULT_SCHOOL_BANNERS, SchoolBannerSlider } from '../portal/SchoolBannerSlider';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
} from '@/components/ui';
import { AppModal, EmptyState } from '../common';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Check,
  X,
  Upload,
  Sparkles,
  Layers,
  ArrowUpDown,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface BannersManagementProps {
  tenantSlug?: string;
}

export const BannersManagement: React.FC<BannersManagementProps> = ({ tenantSlug }) => {
  const storageKey = `aylia_school_banners_${tenantSlug || 'default'}`;

  const [banners, setBanners] = useState<SchoolBanner[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SCHOOL_BANNERS;
  });

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingBanner, setEditingBanner] = useState<SchoolBanner | null>(null);

  // Form states
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [badge, setBadge] = useState<string>('إعلان هام');
  const [actionText, setActionText] = useState<string>('عرض التفاصيل');
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Save to localStorage & fire event
  const persistBanners = (newList: SchoolBanner[]) => {
    setBanners(newList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList));
      window.dispatchEvent(new Event('storage'));
    } catch {}
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingBanner(null);
    setTitle('');
    setSubtitle('');
    setImageUrl('https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80');
    setBadge('إعلان هام');
    setActionText('عرض التفاصيل');
    setDisplayOrder(banners.length + 1);
    setIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (b: SchoolBanner) => {
    setEditingBanner(b);
    setTitle(b.title);
    setSubtitle(b.subtitle || '');
    setImageUrl(b.image_url);
    setBadge(b.badge || 'إعلان هام');
    setActionText(b.action_text || '');
    setDisplayOrder(b.display_order);
    setIsActive(b.is_active);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الشريحة من السلايدر؟')) {
      const filtered = banners.filter((b) => b.id !== id);
      persistBanners(filtered);
      showNotice('تم حذف الشريحة بنجاح ✓');
    }
  };

  const handleToggleActive = (id: string) => {
    const updated = banners.map((b) => (b.id === id ? { ...b, is_active: !b.is_active } : b));
    persistBanners(updated);
    showNotice('تم تحديث حالة الشريحة ✓');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) {
      alert('يرجى كتابة عنوان الشريحة وتحديد الصورة');
      return;
    }

    if (editingBanner) {
      // Update
      const updated = banners.map((b) =>
        b.id === editingBanner.id
          ? {
              ...b,
              title: title.trim(),
              subtitle: subtitle.trim() || undefined,
              image_url: imageUrl.trim(),
              badge: badge.trim() || undefined,
              action_text: actionText.trim() || undefined,
              display_order: displayOrder,
              is_active: isActive,
            }
          : b
      );
      persistBanners(updated.sort((a, b) => a.display_order - b.display_order));
      showNotice('تم تعديل شريحة السلايدر بنجاح ✓');
    } else {
      // Create new
      const newBanner: SchoolBanner = {
        id: `banner-${Date.now()}`,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        image_url: imageUrl.trim(),
        badge: badge.trim() || undefined,
        action_text: actionText.trim() || undefined,
        display_order: displayOrder,
        is_active: isActive,
      };
      const updated = [...banners, newBanner].sort((a, b) => a.display_order - b.display_order);
      persistBanners(updated);
      showNotice('تمت إضافة الشريحة الجديدة إلى السلايدر بنجاح ✓');
    }

    setModalOpen(false);
  };

  // Image Upload handler
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/portal/homeworks/upload', {
        method: 'POST',
        headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : undefined,
        body: formData,
      });
      const json = await res.json();
      if (json?.url) {
        setImageUrl(json.url);
        return;
      }
    } catch {}

    // Fallback Data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    setUploadingImage(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Alert Notice */}
      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">
                سلايدر إعلانات وفعاليات المعهد
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                إدارة الصور المتحركة واللوحات الإعلانية التي تظهر في شاشات الطلاب وأولياء الأمور
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-2 shrink-0 h-10 px-4 rounded-xl shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة شريحة جديدة للسلايدر</span>
        </Button>
      </div>

      {/* Live Mobile Preview Card */}
      <div className="p-5 rounded-3xl bg-card border border-border space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground">
              معاينة حية ومباشرة لشكل السلايدر في تطبيق الموبايل
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            {banners.filter((b) => b.is_active).length} شرائح نشطة
          </Badge>
        </div>

        <div className="max-w-md mx-auto">
          <SchoolBannerSlider tenantSlug={tenantSlug} />
        </div>
      </div>

      {/* Banners List / Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span>قائمة الشرائح والإعلانات ({banners.length})</span>
          </h3>
        </div>

        {banners.length === 0 ? (
          <EmptyState
            title="لا توجد شرائح في السلايدر"
            description="انقر على إضافة شريحة جديدة لإضافة أول صورة وإعلان للمعهد."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banners.map((b) => (
              <Card
                key={b.id}
                className={`overflow-hidden border transition hover:shadow-md ${
                  !b.is_active ? 'opacity-60 bg-secondary/30' : 'border-border'
                }`}
              >
                <div className="relative aspect-16/9 bg-slate-900">
                  <img
                    src={b.image_url}
                    alt={b.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold">
                      {b.badge || 'إعلان'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-white font-mono text-[9px]">
                      ترتيب #{b.display_order}
                    </span>
                  </div>

                  <div className="absolute bottom-2.5 right-2.5 left-2.5 text-white">
                    <h4 className="text-xs font-bold leading-snug line-clamp-1">{b.title}</h4>
                  </div>
                </div>

                <CardContent className="p-3.5 space-y-3">
                  {b.subtitle && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {b.subtitle}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(b.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                        b.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {b.is_active ? '✓ مفعل ومعروض' : 'معطل'}
                    </button>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(b)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="تعديل الشريحة"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(b.id)}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
                        title="حذف الشريحة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AppModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingBanner ? 'تعديل شريحة السلايدر' : 'إضافة شريحة جديدة لسلايدر المعهد'}
        description="تحديد الصورة وعنوان الإعلان والوسم الذي سيظهر للطلاب وأولياء الأمور"
        icon={<ImageIcon className="w-5 h-5 text-primary" />}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Image Preview & Upload */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">صورة البنر:</Label>
            {imageUrl && (
              <div className="relative aspect-16/9 rounded-2xl overflow-hidden border border-border shadow-xs">
                <img src={imageUrl} alt="معاينة" className="w-full h-full object-cover" />
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold">
                  معاينة الصورة
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="رابط الصورة (URL)..."
                className="text-xs h-9"
                dir="ltr"
                required
              />
              <label className="h-9 px-3 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingImage ? 'جاري الرفع...' : 'رفع صورة'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-foreground">عنوان الإعلان أو الفعالية:</Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تكريم الطلبة الأوائل والمتميزين..."
              className="text-xs h-9"
              required
            />
          </div>

          {/* Subtitle */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-foreground">نص تفصيلي أو شرح إضافي:</Label>
            <textarea
              rows={3}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="اكتب تفاصيل الإعلان أو التهنئة..."
              className="w-full text-xs p-2.5 rounded-xl border border-input bg-background resize-none focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Grid options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">الوسم / التصنيف:</Label>
              <select
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold focus-visible:outline-hidden"
              >
                <option value="إعلان هام">إعلان هام</option>
                <option value="لوحة الشرف">لوحة الشرف</option>
                <option value="فعاليات المعهد">فعاليات المعهد</option>
                <option value="جدول الامتحانات">جدول الامتحانات</option>
                <option value="تهنئة وتكريم">تهنئة وتكريم</option>
                <option value="عام">عام</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">نص زر الإجراء:</Label>
              <Input
                type="text"
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="مثال: عرض التفاصيل"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-foreground">ترتيب الظهور:</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 1)}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActiveBanner"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary w-4 h-4"
            />
            <Label htmlFor="isActiveBanner" className="text-xs font-bold cursor-pointer">
              تفعيل وعرض هذه الشريحة في سلايدر التطبيق فوراً
            </Label>
          </div>

          {/* Submit buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="h-9 text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              className="h-9 text-xs font-bold bg-primary text-primary-foreground gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingBanner ? 'حفظ التعديلات' : 'إضافة الشريحة'}</span>
            </Button>
          </div>
        </form>
      </AppModal>
    </div>
  );
};
