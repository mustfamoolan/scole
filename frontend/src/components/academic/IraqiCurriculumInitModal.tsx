import React, { useState } from 'react';
import { apiRequest, AppAPIError } from '../../api/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import { Sparkles, CheckSquare, Square, Trash2, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

import { useConfirm, useToast } from '../../context/NotificationContext';

interface IraqiCurriculumInitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const IraqiCurriculumInitModal: React.FC<IraqiCurriculumInitModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const confirm = useConfirm();
  const toast = useToast();

  const [stages, setStages] = useState<{ [key: string]: boolean }>({
    primary: true,
    intermediate: true,
    prep_scientific: true,
    prep_literary: true,
  });
  const [resetExisting, setResetExisting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleStage = (key: string) => {
    setStages((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    setStages({
      primary: true,
      intermediate: true,
      prep_scientific: true,
      prep_literary: true,
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedKeys = Object.entries(stages)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    if (selectedKeys.length === 0) {
      setError('يرجى تحديد مرحلة دراسية واحدة على الأقل للتوليد');
      return;
    }

    if (resetExisting) {
      const confirmed = await confirm({
        title: 'تأكيد تصفير الهيكل وإعادة البناء',
        message:
          'سيتم مسح بيانات المراحل والصفوف والمناهج المعتمدة السابقة لهذا المعهد لإعادة بنائها نظيفة وفق المنهاج العراقي 2026/2027. هل تود الاستمرار؟',
        confirmText: 'نعم، مسح وتوليد من الصفر',
        cancelText: 'تراجع',
        variant: 'danger',
      });
      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/academic/initialize-defaults', {
        method: 'POST',
        body: JSON.stringify({
          stages: selectedKeys,
          reset_existing: resetExisting,
        }),
      });

      toast.success('تم توليد الهيكل والمناهج الرسمية بنجاح');
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError(err.message);
      } else {
        setError('فشل توليد الهيكل والمناهج الرسمية');
      }
    } finally {
      setLoading(false);
    }
  };

  const stageOptions = [
    {
      id: 'primary',
      title: 'المرحلة الابتدائية',
      subtitle: 'الصفوف من الأول إلى السادس الابتدائي (الوزاري)',
      curriculaCount: '7 مواد دراسية لكل صف (إسلامية، عربي، إنكليزي، رياضيات، علوم، اجتماعيات، فنية/رياضة)',
      badge: '6 صفوف',
      color: 'border-blue-500/30 bg-blue-500/5',
    },
    {
      id: 'intermediate',
      title: 'المرحلة المتوسطة',
      subtitle: 'الصفوف الأول والثاني والثالث المتوسط (البكالوريا)',
      curriculaCount: 'مواد المرحلة المتوسطة الرسمية (إسلامية، عربي، إنكليزي، رياضيات، علوم مدمجة / كيمياء، فيزياء، أحياء، اجتماعيات، حاسوب)',
      badge: '3 صفوف',
      color: 'border-purple-500/30 bg-purple-500/5',
    },
    {
      id: 'prep_scientific',
      title: 'المرحلة الإعدادية - الفرع العلمي',
      subtitle: 'الرابع والخامس والسادس العلمي (البكالوريا)',
      curriculaCount: 'المواد العلمية والمشتركة فقط: (فيزياء، كيمياء، أحياء، رياضيات، عربي، إنكليزي، إسلامية، حاسوب)',
      badge: '3 صفوف علمية',
      color: 'border-emerald-500/30 bg-emerald-500/5',
    },
    {
      id: 'prep_literary',
      title: 'المرحلة الإعدادية - الفرع الأدبي',
      subtitle: 'الرابع والخامس والسادس الأدبي (البكالوريا)',
      curriculaCount: 'المواد الأدبية والمشتركة فقط: (تاريخ، جغرافيا، اقتصاد، فلسفة وعلم نفس، رياضيات أدبي، عربي، إنكليزي، إسلامية)',
      badge: '3 صفوف أدبية',
      color: 'border-amber-500/30 bg-amber-500/5',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-foreground">
                توليد الهيكل والمناهج الرسمية لوزارة التربية العراقية (2026 / 2027)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                توليد فوري للمراحل والصفوف وتسكين كامل مقرراتها الدراسية المعتمدة تلقائياً
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4 py-2">
          {/* Stage Selection Cards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">حدد المراحل المراد توليدها:</span>
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                تحديد جميع المراحل
              </button>
            </div>

            <div className="space-y-2.5">
              {stageOptions.map((opt) => {
                const checked = Boolean(stages[opt.id]);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleStage(opt.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      checked
                        ? `${opt.color} border-primary/50 shadow-2xs`
                        : 'border-border/60 bg-card hover:border-border'
                    }`}
                  >
                    <div className="pt-0.5 text-primary">
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1 text-right">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{opt.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-mono">
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{opt.subtitle}</p>
                      <p className="text-[10px] text-emerald-700/80 font-medium">
                        ✓ {opt.curriculaCount}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reset Existing Checkbox */}
          <div
            onClick={() => setResetExisting(!resetExisting)}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 select-none ${
              resetExisting
                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                : 'border-border bg-card text-foreground'
            }`}
          >
            <div>
              {resetExisting ? (
                <CheckSquare className="w-4 h-4 text-destructive" />
              ) : (
                <Square className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="text-xs font-semibold space-y-0.5 text-right">
              <div>مسح وتفريغ البيانات التجريبية والصفوف السابقة</div>
              <p className="text-[10px] text-muted-foreground">
                يوصى به لبدء معهدك بهيكل رسمي دقيق بدون صفوف فارغة أو مواد متكررة قديمة.
              </p>
            </div>
          </div>

          {/* Guidelines Callout */}
          <div className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] text-muted-foreground space-y-1.5 leading-relaxed text-right">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>كيف يعمل نظام التوليد الميداني؟</span>
            </div>
            <p>
              • يتم توليد المراحل والصفوف فقط دون شُعب عشوائية، لتتمكن من إنشاء الشُعب الخاصة بمعهدك (أ، ب، قاعة 1...) لاحقاً.
            </p>
            <p>
              • تُعتمد المناهج الرسمية على مستوى <strong>الصف الدراسي</strong> وتطبّق تلقائياً على كافة شُعبه الحالية والمستقبلية.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="text-xs font-bold gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loading ? 'جاري بناء المناهج والصفوف...' : 'توليد الهيكل والمناهج الرسمية الآن'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
