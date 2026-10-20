import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, Megaphone, Calendar, Award } from 'lucide-react';

export interface SchoolBanner {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  badge?: string;
  action_text?: string;
  action_url?: string;
  is_active: boolean;
  display_order: number;
}

export const DEFAULT_SCHOOL_BANNERS: SchoolBanner[] = [
  {
    id: 'banner-1',
    title: 'تكريم الطلبة الأوائل والمتميزين',
    subtitle: 'تهنئ إدارة المعهد طلبتنا المتفوقين في امتحانات الشهر الأول ونتمنى لهم دوام النجاح.',
    image_url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
    badge: 'لوحة الشرف',
    action_text: 'عرض الأسماء',
    is_active: true,
    display_order: 1,
  },
  {
    id: 'banner-2',
    title: 'بدء مراجعات التقوية والواجبات اليومية',
    subtitle: 'جدول حصص التقوية وحل الواجبات المدرسية متاح الآن عبر المنصة لجميع المراحل.',
    image_url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
    badge: 'إعلان هام',
    action_text: 'جدول المراجعة',
    is_active: true,
    display_order: 2,
  },
  {
    id: 'banner-3',
    title: 'المعرض العلمي والأنشطة الإبداعية',
    subtitle: 'ندعو طلبتنا الأعزاء وأولياء الأمور للمشاركة في المعرض العلمي السنوي لمشاريع الموهوبين.',
    image_url: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1200&q=80',
    badge: 'فعاليات المعهد',
    action_text: 'تفاصيل الفعالية',
    is_active: true,
    display_order: 3,
  },
];

interface SchoolBannerSliderProps {
  tenantSlug?: string;
  onActionClick?: (banner: SchoolBanner) => void;
}

export const SchoolBannerSlider: React.FC<SchoolBannerSliderProps> = ({
  tenantSlug,
  onActionClick,
}) => {
  const [banners, setBanners] = useState<SchoolBanner[]>(() => {
    try {
      const specificKey = `aylia_school_banners_${tenantSlug || 'default'}`;
      const saved = localStorage.getItem(specificKey) || localStorage.getItem('aylia_school_banners_default');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const actives = parsed.filter((b) => b.is_active);
          if (actives.length > 0) return actives;
        }
      }
    } catch {}
    return DEFAULT_SCHOOL_BANNERS;
  });

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  // Sync banners from localStorage on storage events or mount
  useEffect(() => {
    const loadBanners = () => {
      try {
        const specificKey = `aylia_school_banners_${tenantSlug || 'default'}`;
        const saved = localStorage.getItem(specificKey) || localStorage.getItem('aylia_school_banners_default');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const actives = parsed.filter((b: SchoolBanner) => b.is_active);
            if (actives.length > 0) {
              setBanners(actives);
              return;
            }
          }
        }
      } catch {}
      setBanners(DEFAULT_SCHOOL_BANNERS);
    };

    loadBanners();
    window.addEventListener('storage', loadBanners);
    return () => window.removeEventListener('storage', loadBanners);
  }, [tenantSlug]);

  // Auto-play timer
  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length, isPaused]);

  if (banners.length === 0) return null;

  const currentBanner = banners[currentIndex] || banners[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  return (
    <div
      className="relative w-full min-h-[185px] sm:min-h-[220px] aspect-16/9 sm:aspect-21/9 rounded-3xl overflow-hidden shadow-lg select-none group bg-slate-900 border border-slate-200/50 dark:border-slate-800"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Background Image with Smooth Fade */}
      <div className="absolute inset-0">
        <img
          key={currentBanner.id}
          src={currentBanner.image_url}
          alt={currentBanner.title}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        {/* Multi-layer Gradient Overlay for crisp readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-between z-10 text-white">
        {/* Top Badges */}
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-full bg-primary/90 text-white text-[11px] font-bold backdrop-blur-md shadow-xs flex items-center gap-1.5 border border-white/20">
            {currentBanner.badge?.includes('شرف') ? (
              <Award className="w-3.5 h-3.5 text-amber-300" />
            ) : currentBanner.badge?.includes('فعاليات') ? (
              <Calendar className="w-3.5 h-3.5 text-sky-300" />
            ) : (
              <Megaphone className="w-3.5 h-3.5 text-white" />
            )}
            <span>{currentBanner.badge || 'إعلان المعهد'}</span>
          </span>

          <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md text-white/90 text-[10px] font-mono font-bold">
            {currentIndex + 1} / {banners.length}
          </span>
        </div>

        {/* Bottom Text & Actions */}
        <div className="space-y-1.5 sm:space-y-2">
          <h3 className="font-black text-sm sm:text-base md:text-lg leading-tight drop-shadow-md text-white">
            {currentBanner.title}
          </h3>

          {currentBanner.subtitle && (
            <p className="text-xs text-white/90 line-clamp-2 leading-relaxed drop-shadow-xs max-w-md">
              {currentBanner.subtitle}
            </p>
          )}

          {currentBanner.action_text && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onActionClick && onActionClick(currentBanner)}
                className="px-3 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold backdrop-blur-md border border-white/30 transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>{currentBanner.action_text}</span>
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Arrow Navigation (Hover on desktop, visible) */}
      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition z-20 cursor-pointer"
            title="السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition z-20 cursor-pointer"
            title="التالي"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Bottom Pagination Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
          {banners.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`rounded-full transition-all duration-300 cursor-pointer ${
                currentIndex === idx
                  ? 'w-5 h-1.5 bg-primary'
                  : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
              }`}
              title={`شريحة ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
