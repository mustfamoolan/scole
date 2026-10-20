-- 20261019000001_create_platform_settings.up.sql
-- Create platform_settings table for Landing Page CMS and platform configuration

CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings (key);
CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings (category);

-- Insert default seed settings for Landing Page CMS
INSERT INTO platform_settings (key, value, category, description)
VALUES 
('hero_title', 'المنظومة التعليمية المتكاملة لإدارة المعاهد والمدارس الحديثة', 'hero', 'العنوان الرئيسي في صفحة الهبوط'),
('hero_subtitle', 'نظام سحابي ذكي مصمم وفق أعلى المعايير لإدارة الطلاب، الكوادر، الدرجات، الحصص، والحسابات بكل سهولة واحترافية.', 'hero', 'الوصف الترحيبي لصفحة الهبوط'),
('platform_phone', '07737777424', 'contact', 'رقم الهاتف الرسمي للدعم والمبيعات'),
('platform_address', 'العراق — البصرة', 'contact', 'العنوان الجغرافي للمنصة'),
('platform_email', 'contact@fistudy.iq', 'contact', 'البريد الإلكتروني الرسمي للمنصة'),
('featured_plan_slug', 'pro', 'pricing', 'معرّف الخطة الأكثر شعبية أو تميزاً')
ON CONFLICT (key) DO NOTHING;
