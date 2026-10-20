import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { StudentSchoolHomework } from '../../types';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  X,
  FileText,
  User,
  Send,
  Loader2,
  ChevronRight,
  Eye,
  Camera,
  MessageSquare,
  CheckCheck,
  Plus
} from 'lucide-react';

interface StudentHomeworkViewProps {
  studentId: string;
  studentName: string;
  tenantSlug?: string;
  submittedBy: 'student' | 'guardian';
  onBack?: () => void;
}

const COMMON_SUBJECTS = [
  'الرياضيات',
  'الفيزياء',
  'الكيمياء',
  'اللغة الإنجليزية',
  'اللغة العربية',
  'الأحياء',
  'التربية الإسلامية',
  'الحاسوب',
  'الاجتماعيات',
];

export const StudentHomeworkView: React.FC<StudentHomeworkViewProps> = ({
  studentId,
  studentName,
  tenantSlug,
  submittedBy,
  onBack,
}) => {
  const [homeworks, setHomeworks] = useState<StudentSchoolHomework[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Upload Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [subjectName, setSubjectName] = useState<string>('الرياضيات');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fullscreen Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchHomeworks = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = `/api/v1/portal/school-homeworks?student_id=${encodeURIComponent(studentId)}`;
      const res = await apiRequest<{ success: boolean; data: StudentSchoolHomework[] }>(endpoint, {
        headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : undefined,
      });
      if (res?.success && Array.isArray(res.data)) {
        setHomeworks(res.data);
      } else {
        setHomeworks([]);
      }
    } catch (err: any) {
      setError(err.message || 'فشل تحميل سجل الواجبات اليومية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchHomeworks();
    }
  }, [studentId, tenantSlug]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setFormError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/v1/portal/homeworks/upload', {
          method: 'POST',
          headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : undefined,
          body: formData,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'فشل رفع إحدى الصور');
        }

        setUploadedImages((prev) => [...prev, json.url]);
      }
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء رفع الصور');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubject = subjectName === 'أخرى' ? customSubject.trim() : subjectName;
    if (!finalSubject) {
      setFormError('يرجى تحديد أو كتابة اسم المادة');
      return;
    }
    if (!title.trim()) {
      setFormError('يرجى كتابة عنوان أو رقم صفحة الواجب (مثال: حل تمارين ص 45)');
      return;
    }
    if (uploadedImages.length === 0 && !description.trim()) {
      setFormError('يرجى تصوير الدفتر/الكتاب أو كتابة نص الواجب');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await apiRequest<{ success: boolean; data: StudentSchoolHomework }>(
        '/api/v1/portal/school-homeworks',
        {
          method: 'POST',
          headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : undefined,
          body: JSON.stringify({
            student_id: studentId,
            subject_name: finalSubject,
            title: title.trim(),
            description: description.trim() || undefined,
            images: uploadedImages,
            submitted_by: submittedBy,
          }),
        }
      );

      if (res?.success) {
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
        setUploadedImages([]);
        setCustomSubject('');
        await fetchHomeworks();
      }
    } catch (err: any) {
      setFormError(err.message || 'فشل رفع الواجب، يرجى المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200" dir="rtl">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>واجباتي المدرسية اليومية</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            رفع واجبات المدرسة ليتابعها معك أساتذة المعهد في درس التقوية
          </p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Action Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-primary to-primary/85 text-white shadow-xl shadow-primary/20 relative overflow-hidden flex items-center justify-between">
        <div>
          <span className="text-[11px] text-white/80 block mb-0.5">
            دفتر الواجبات اليومية ({studentName})
          </span>
          <h4 className="text-base font-bold leading-tight">هل لديك واجب مدرسي اليوم؟</h4>
          <p className="text-xs text-white/90 mt-1 max-w-[240px]">
            صوّر صفحة الدفتر أو الكتاب ليرى أستاذك ما عليك تحضيره
          </p>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setFormError(null);
          }}
          className="px-4 py-2.5 bg-white text-primary font-bold rounded-2xl shadow-lg hover:bg-white/95 transition flex items-center gap-2 text-xs shrink-0"
        >
          <Camera className="w-4 h-4" />
          <span>رفع واجب</span>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          <span className="text-xs">جاري تحميل سجل الواجبات...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchHomeworks}
            className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && homeworks.length === 0 && (
        <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            لم تقم برفع أي واجب مدرسي بعد
          </h4>
          <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
            اضغط على زر "رفع واجب" والتقط صورة لدفترك أو اكتب الواجب المطلوب من مدرستك
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-md shadow-primary/20"
          >
            + رفع أول واجب الآن
          </button>
        </div>
      )}

      {/* Timeline Feed of Uploaded Homeworks */}
      <div className="space-y-3">
        {homeworks.map((hw) => {
          let imgs: string[] = [];
          if (hw.images) {
            try {
              const parsed = JSON.parse(hw.images);
              if (Array.isArray(parsed)) imgs = parsed;
            } catch {}
          }

          const teacherName = hw.teacher_profile?.person
            ? `${hw.teacher_profile.person.first_name} ${hw.teacher_profile.person.last_name}`
            : 'أستاذ المادة';

          return (
            <div
              key={hw.id}
              className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg">
                      {hw.subject_name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(hw.created_at).toLocaleDateString('ar-IQ', {
                        weekday: 'short',
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {hw.title}
                  </h4>
                </div>

                {/* Seen status badge */}
                <div>
                  {hw.is_seen ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تم الاطلاع</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>قيد الانتظار</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Description / Student Note */}
              {hw.description && (
                <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl leading-relaxed whitespace-pre-wrap">
                  {hw.description}
                </p>
              )}

              {/* Photos Gallery */}
              {imgs.length > 0 && (
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1.5 font-medium">
                    صور الدفتر / الكتاب ({imgs.length}):
                  </span>
                  <div className="flex gap-2 overflow-x-auto py-1">
                    {imgs.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewImage(imgUrl)}
                        className="w-20 h-20 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative shrink-0 group shadow-sm"
                      >
                        <img src={imgUrl} alt={`واجب ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Teacher Chat / Comment Response Bubble */}
              {hw.is_seen && (
                <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/80">
                  <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>رد وملاحظة الأستاذ ({teacherName})</span>
                      </span>
                      {hw.seen_at && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(hw.seen_at).toLocaleTimeString('ar-IQ', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed mt-1">
                      {hw.teacher_comment || 'تم الاطلاع على الواجب وسنتابعه معك في درس المعهد القادم.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =======================================================
          UPLOAD MODAL
         ======================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  رفع واجب مدرسي جديد
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  لطالب المعهد: {studentName} ({submittedBy === 'guardian' ? 'بواسطة ولي الأمر' : 'بواسطة الطالب'})
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-600">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Subject Selection Pills */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  المادة الدراسية:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_SUBJECTS.map((subj) => (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setSubjectName(subj)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                        subjectName === subj
                          ? 'bg-primary text-white shadow-sm font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {subj}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSubjectName('أخرى')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                      subjectName === 'أخرى'
                        ? 'bg-primary text-white shadow-sm font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    أخرى...
                  </button>
                </div>

                {subjectName === 'أخرى' && (
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="اكتب اسم المادة..."
                    className="w-full mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    required
                  />
                )}
              </div>

              {/* Title / Page number */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  عنوان الواجب أو رقم الصفحة:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: واجب الرياضيات - حل تمارين ص 48 (1 إلى 5)"
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Photos Upload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    تصوير صفحة الدفتر أو الكتاب:
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {uploadedImages.length} صور مرفوعة
                  </span>
                </div>

                <label className="w-full py-4 px-4 border-2 border-dashed border-primary/40 hover:border-primary rounded-2xl bg-primary/5 hover:bg-primary/10 transition cursor-pointer flex items-center justify-center gap-2 text-primary text-xs font-bold">
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري رفع الصور...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5" />
                      <span>📷 التقاط صورة بالكاميرا أو اختيار من المعرض</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>

                {/* Previews Grid */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {uploadedImages.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden aspect-square group shadow-sm"
                      >
                        <img src={url} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg opacity-80 hover:opacity-100 transition shadow-sm"
                          title="حذف"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Student Note */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  ملاحظة للأستاذ (اختياري):
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="مثال: واجهت صعوبة في السؤال الثالث وأحتاج توضيحاً في المحاضرة القادمة..."
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-lg shadow-primary/25 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>إرسال لمدرس المعهد</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          FULLSCREEN PREVIEW MODAL
         ======================================================= */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 left-0 p-2 text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="معاينة الصورة"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
