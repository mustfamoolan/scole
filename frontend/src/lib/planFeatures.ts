/**
 * Plan Features Utilities & Helpers
 */

export const PRESET_PLAN_FEATURES = [
  'تطبيق ولي الأمر للهواتف (iOS / Android)',
  'إشعارات WhatsApp ورسائل SMS تلقائية للغياب والدرجات',
  'نظام الحضور والغياب والبصمة الذكي',
  'إدارة الرسوم والأقساط وطباعة الوصولات المالية',
  'دومين مخصص مجاني للمعهد (.iq / .com)',
  'بطاقات وهوية الطالب مع الباركود الذكي',
  'إصدار الشهادات والتقارير الشهرية بضغطة زر',
  'منصة تفاعلية للواجبات والامتحانات الإلكترونية',
  'دعم فني وتدريب مجاني لكادر المعهد 24/7',
  'إدارة فروع متعددة وصلاحيات موظفين مخصصة',
  'نسخ احتياطي يومي وحماية البيانات السحابية',
];

export function parsePlanFeatures(featuresStr?: string | null): string[] {
  if (!featuresStr) return [];
  try {
    const trimmed = featuresStr.trim();
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    }
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      return Object.values(parsed).map((item) => String(item).trim()).filter(Boolean);
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  } catch {
    return featuresStr ? featuresStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
  }
}

export function serializePlanFeatures(features: string[]): string {
  const clean = features.map((f) => f.trim()).filter(Boolean);
  return JSON.stringify(clean);
}
