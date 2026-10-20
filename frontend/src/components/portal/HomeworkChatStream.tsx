import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../../api/client';
import { StudentSchoolHomework } from '../../types';
import {
  Send,
  Camera,
  Mic,
  MicOff,
  Check,
  CheckCheck,
  Clock,
  ChevronRight,
  RotateCw,
  ZoomIn,
  ZoomOut,
  X,
  Play,
  Pause,
  BookOpen,
  Sparkles,
} from 'lucide-react';

export interface HomeworkChatStreamProps {
  studentId: string;
  studentName: string;
  studentGradeSection?: string;
  tenantSlug?: string;
  viewerRole: 'guardian' | 'student' | 'teacher' | 'admin';
  teacherId?: string;
  teacherName?: string;
  onBack?: () => void;
  initialHomeworks?: StudentSchoolHomework[];
  onHomeworksUpdated?: (updated: StudentSchoolHomework[]) => void;
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

export const HomeworkChatStream: React.FC<HomeworkChatStreamProps> = ({
  studentId,
  studentName,
  studentGradeSection,
  tenantSlug,
  viewerRole,
  teacherId,
  teacherName = 'المدرس',
  onBack,
  initialHomeworks,
  onHomeworksUpdated,
}) => {
  const [homeworks, setHomeworks] = useState<StudentSchoolHomework[]>(initialHomeworks || []);
  const [loading, setLoading] = useState<boolean>(!initialHomeworks);
  const [inputText, setInputText] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('الرياضيات');
  const [showSubjectPicker, setShowSubjectPicker] = useState<boolean>(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  // Voice recording simulation
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const recordingTimerRef = useRef<any>(null);

  // Audio playback simulation
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Lightbox preview for photos
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [photoRotation, setPhotoRotation] = useState<number>(0);
  const [photoZoom, setPhotoZoom] = useState<number>(1);

  // Teacher reply inline modal/sheet
  const [activeReplyHwId, setActiveReplyHwId] = useState<string | null>(null);
  const [teacherReplyText, setTeacherReplyText] = useState<string>('');
  const [replying, setReplying] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Haptic feedback helper
  const triggerHaptic = (duration = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [homeworks, isRecording]);

  // Fetch homeworks if not provided or if studentId changes
  const fetchHomeworks = async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const endpoint = `/api/v1/portal/school-homeworks?student_id=${encodeURIComponent(studentId)}`;
      const res = await apiRequest<{ success: boolean; data: StudentSchoolHomework[] }>(endpoint, {
        headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : undefined,
      });
      if (res?.success && Array.isArray(res.data)) {
        setHomeworks(res.data);
        if (onHomeworksUpdated) onHomeworksUpdated(res.data);
      }
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialHomeworks && studentId) {
      fetchHomeworks();
    } else if (initialHomeworks) {
      setHomeworks(initialHomeworks);
    }
  }, [studentId, initialHomeworks]);

  // Image upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    triggerHaptic(10);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        try {
          const res = await fetch('/api/v1/portal/homeworks/upload', {
            method: 'POST',
            headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : undefined,
            body: formData,
          });
          const json = await res.json();
          if (json?.url) {
            setAttachedImages((prev) => [...prev, json.url]);
            continue;
          }
        } catch {}

        // Fallback: local DataURL preview
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setAttachedImages((prev) => [...prev, event.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Voice recording toggle
  const toggleRecording = () => {
    triggerHaptic(25);
    if (isRecording) {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      if (recordDuration > 1) {
        handleSendMessage({ isVoice: true, duration: recordDuration });
      }
      setRecordDuration(0);
    } else {
      setIsRecording(true);
      setRecordDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  // Play/pause simulated voice audio
  const togglePlayAudio = (id: string) => {
    triggerHaptic(15);
    if (playingAudioId === id) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(id);
      setTimeout(() => {
        setPlayingAudioId(null);
      }, 4000);
    }
  };

  // Safe parse JSON images
  const parseImages = (raw: string | undefined): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // Send message
  const handleSendMessage = async (options?: { isVoice?: boolean; duration?: number }) => {
    const text = inputText.trim();
    const hasImages = attachedImages.length > 0;
    const isVoice = options?.isVoice || false;

    if (!text && !hasImages && !isVoice) return;

    triggerHaptic(30);
    setSending(true);

    const subject = selectedSubject;
    const titleText = isVoice
      ? `تسجيل صوتي (${options?.duration || 3} ثانية)`
      : text
      ? text.slice(0, 40)
      : `حل واجب ${subject}`;

    const newHwId = `temp-${Date.now()}`;
    const optimisticHw = {
      id: newHwId,
      tenant_id: 'default',
      student_profile_id: studentId,
      subject_name: subject,
      title: titleText,
      description: isVoice
        ? `[تسجيل صوتي لشرح أو إجابة الواجب]`
        : text || undefined,
      images: JSON.stringify(attachedImages),
      submitted_by: viewerRole === 'guardian' ? 'guardian' : 'student',
      is_seen: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      student_profile: {
        id: studentId,
        student_number: 'STU',
        full_name: studentName,
      } as any,
    } as unknown as StudentSchoolHomework;

    // Optimistic state update
    const updatedList = [...homeworks, optimisticHw];
    setHomeworks(updatedList);
    if (onHomeworksUpdated) onHomeworksUpdated(updatedList);

    // Clear inputs immediately for instant feel
    setInputText('');
    setAttachedImages([]);
    setShowSubjectPicker(false);

    try {
      const res = await apiRequest<{ success: boolean; data: StudentSchoolHomework }>(
        '/api/v1/portal/school-homeworks',
        {
          method: 'POST',
          headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : undefined,
          body: JSON.stringify({
            student_id: studentId,
            subject_name: subject,
            title: titleText,
            description: optimisticHw.description,
            images: attachedImages,
            submitted_by: viewerRole === 'guardian' ? 'guardian' : 'student',
          }),
        }
      );

      if (res?.data?.id) {
        setHomeworks((prev) =>
          prev.map((item) => (item.id === newHwId ? res.data : item))
        );
      }
    } catch {
      // Keep optimistic entry in state
    } finally {
      setSending(false);
    }
  };

  // Handle Teacher Reply / Acknowledgment
  const handleTeacherReply = async (hwId: string) => {
    if (!teacherReplyText.trim()) return;
    setReplying(true);
    triggerHaptic(20);

    const replyComment = teacherReplyText.trim();

    // Optimistic UI update
    const updatedList = homeworks.map((item) =>
      item.id === hwId
        ? {
            ...item,
            is_seen: true,
            teacher_comment: replyComment,
          }
        : item
    );
    setHomeworks(updatedList);
    if (onHomeworksUpdated) onHomeworksUpdated(updatedList);

    setTeacherReplyText('');
    setActiveReplyHwId(null);

    try {
      const endpoint = tenantSlug
        ? `/api/v1/portal/school-homeworks/${hwId}/acknowledge?slug=${encodeURIComponent(tenantSlug)}`
        : `/api/v1/portal/school-homeworks/${hwId}/acknowledge`;

      await apiRequest(endpoint, {
        method: 'PUT',
        headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : undefined,
        body: JSON.stringify({
          teacher_id: teacherId,
          comment: replyComment,
        }),
      });
    } catch {
      // Keep optimistic
    } finally {
      setReplying(false);
    }
  };

  // Format time (e.g., 09:30 ص)
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-slate-100 dark:bg-slate-950 relative select-none overflow-hidden">
      {/* ─── 1. WhatsApp Style Header ─── */}
      <div className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                onBack();
              }}
              className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 transition active:scale-90 cursor-pointer"
              title="رجوع للقائمة الرئيسية"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-sm">
              {studentName.charAt(0)}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
          </div>

          <div className="text-right">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
              {studentName}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {studentGradeSection || 'محادثة الواجبات اليومية والملاحظات'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
            {homeworks.length} واجبات
          </span>
        </div>
      </div>

      {/* ─── 2. WhatsApp Wallpaper & Chat Stream Area ─── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-100/80 dark:bg-slate-950 relative">
        {/* Date separator */}
        <div className="flex justify-center my-1 sticky top-0 z-10">
          <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 backdrop-blur-md shadow-2xs border border-slate-200/50 dark:border-slate-700/50">
            سجل اليوم والواجبات المرسلة
          </span>
        </div>

        {/* Empty state if no homeworks yet */}
        {homeworks.length === 0 && !loading && (
          <div className="my-8 text-center px-4 py-8 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-dashed border-slate-300 dark:border-slate-800 space-y-2.5 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              لا توجد واجبات مرفوعة حتى الآن
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              {viewerRole === 'teacher'
                ? 'لم يرسل الطالب واجبه اليوم بعد. يمكنك مراسلته أو كتابة ملاحظة تظهر في حسابه.'
                : 'قم بتصوير دفتر الواجب أو كتابة رقم الصفحة وإرسالها للمدرس لتدقيقها.'}
            </p>
          </div>
        )}

        {/* Chat message bubbles */}
        {homeworks.map((hw) => {
          const photos = parseImages(hw.images);
          const isSender =
            viewerRole === 'teacher' ? false : hw.submitted_by === viewerRole || viewerRole === 'student';

          return (
            <div
              key={hw.id}
              className={`flex flex-col space-y-2 ${
                isSender ? 'items-end' : 'items-start'
              }`}
            >
              {/* Main Homework Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3 shadow-xs transition ${
                  isSender
                    ? 'bg-primary text-white rounded-br-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-bl-xs border border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Subject Header */}
                <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-white/15 dark:border-slate-800">
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                      isSender
                        ? 'bg-white/20 text-white'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {hw.subject_name}
                  </span>
                  <span
                    className={`text-[10px] flex items-center gap-1 font-mono ${
                      isSender ? 'text-white/80' : 'text-slate-400'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {formatTime(hw.created_at)}
                  </span>
                </div>

                {/* Title */}
                <h5 className="font-bold text-xs sm:text-sm leading-snug mb-1">
                  {hw.title}
                </h5>

                {/* Description Text */}
                {hw.description && (
                  <p
                    className={`text-xs whitespace-pre-line leading-relaxed mb-2 ${
                      isSender
                        ? 'text-white/95'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {hw.description}
                  </p>
                )}

                {/* Voice Note Simulation in bubble */}
                {hw.title?.includes('تسجيل صوتي') && (
                  <div
                    className={`p-2 rounded-xl mb-2 flex items-center gap-2.5 ${
                      isSender
                        ? 'bg-black/15 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => togglePlayAudio(hw.id)}
                      className="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center shrink-0 shadow-xs cursor-pointer active:scale-95"
                    >
                      {playingAudioId === hw.id ? (
                        <Pause className="w-4 h-4 fill-primary" />
                      ) : (
                        <Play className="w-4 h-4 fill-primary ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-1 h-3">
                        {[40, 70, 30, 90, 60, 45, 80, 50, 65, 35].map((h, i) => (
                          <div
                            key={i}
                            style={{ height: `${h}%` }}
                            className={`w-1 rounded-full transition-all duration-300 ${
                              playingAudioId === hw.id
                                ? 'bg-emerald-400 animate-pulse'
                                : isSender
                                ? 'bg-white/40'
                                : 'bg-slate-400'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] font-mono opacity-80">
                        <span>{playingAudioId === hw.id ? '0:02' : '0:00'}</span>
                        <span>0:08</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photos Grid */}
                {photos.length > 0 && (
                  <div className="space-y-1 mb-2">
                    <div
                      className={`grid gap-1.5 ${
                        photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                      }`}
                    >
                      {photos.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setPreviewPhotoUrl(url);
                            setPhotoRotation(0);
                            setPhotoZoom(1);
                          }}
                          className="relative aspect-4/3 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 group cursor-pointer"
                        >
                          <img
                            src={url}
                            alt={`دفتر صفحة ${idx + 1}`}
                            className="w-full h-full object-cover transition duration-200 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="p-1 rounded-lg bg-black/60 text-white text-[10px] flex items-center gap-1">
                              <ZoomIn className="w-3 h-3" /> تكبير
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <span
                      className={`text-[10px] block font-medium ${
                        isSender ? 'text-white/80' : 'text-slate-400'
                      }`}
                    >
                      اضغط على صورة الدفتر لمعاينتها أو تدويرها
                    </span>
                  </div>
                )}

                {/* Footer with delivery checkmark */}
                <div className="flex items-center justify-end gap-1 text-[10px] mt-1">
                  <span
                    className={
                      isSender ? 'text-white/80 font-mono' : 'text-slate-400 font-mono'
                    }
                  >
                    {formatTime(hw.created_at)}
                  </span>
                  {isSender && (
                    hw.is_seen ? (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-300 inline" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-white/70 inline" />
                    )
                  )}
                </div>
              </div>

              {/* Teacher Reply / Comment in the same thread */}
              {hw.teacher_comment && (
                <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 rounded-bl-xs shadow-xs space-y-1.5 self-start">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-800/60 pb-1">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      توجيه المدرس: {teacherName}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-bold">
                      <CheckCheck className="w-3.5 h-3.5" /> تم التدقيق
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed whitespace-pre-line">
                    {hw.teacher_comment}
                  </p>
                </div>
              )}

              {/* If Teacher is viewing, provide quick reply button */}
              {viewerRole === 'teacher' && !hw.teacher_comment && (
                <div className="self-start">
                  {activeReplyHwId === hw.id ? (
                    <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-2 w-72 max-w-[85vw]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          كتابة توجيه لطالب
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveReplyHwId(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={teacherReplyText}
                        onChange={(e) => setTeacherReplyText(e.target.value)}
                        placeholder="أحسنت، الخطوة رقم 3 بحاجة لمراجعة..."
                        className="w-full text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 resize-none focus:outline-hidden focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTeacherReply(hw.id)}
                          disabled={replying || !teacherReplyText.trim()}
                          className="flex-1 py-1.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>إرسال التوجيه</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setActiveReplyHwId(hw.id);
                        setTeacherReplyText('أحسنت بارك الله بك، تم الاطلاع على حل الواجب بدقة ✓');
                      }}
                      className="px-3 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>تدقيق والرد على الواجب</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── 3. WhatsApp Input Bar ─── */}
      <div className="p-2 sm:p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-2 z-20">
        {/* Attached previews strip */}
        {attachedImages.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 px-1">
            {attachedImages.map((imgUrl, i) => (
              <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-primary/30">
                <img src={imgUrl} alt="مرفق" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachedImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px]"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <span className="text-xs text-primary font-bold">
              {attachedImages.length} صور مرفوعة للدفتر
            </span>
          </div>
        )}

        {/* Subject picker dropdown chip */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setShowSubjectPicker(!showSubjectPicker);
            }}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <BookOpen className="w-3 h-3 text-primary" />
            <span>مادة الواجب: {selectedSubject}</span>
          </button>

          {isRecording && (
            <span className="text-xs font-mono font-bold text-red-500 animate-pulse flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              جاري التسجيل: {recordDuration} ثانية
            </span>
          )}
        </div>

        {/* Subject Selector Sheet/List */}
        {showSubjectPicker && (
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5 animate-in fade-in duration-150">
            <span className="text-[11px] font-bold text-slate-500">اختر مادة الواجب:</span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SUBJECTS.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    setSelectedSubject(sub);
                    setShowSubjectPicker(false);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedSubject === sub
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The Action Bar */}
        <div className="flex items-center gap-2">
          {/* File Attachment Hidden Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
          />

          {/* Photo/Camera Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              fileInputRef.current?.click();
            }}
            disabled={uploadingImage}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer"
            title="إرفاق صور الدفتر"
          >
            <Camera className="w-5 h-5" />
          </button>

          {/* Text Input Field */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="اكتب ملاحظة الواجب أو رقم الصفحة..."
              className="w-full h-11 px-3.5 py-2 rounded-full bg-slate-100 dark:bg-slate-800 border-none text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Voice Record Button */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer shadow-xs ${
              isRecording
                ? 'bg-red-500 text-white animate-bounce'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
            title="تسجيل صوتي"
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={sending || (!inputText.trim() && attachedImages.length === 0)}
            className="w-11 h-11 rounded-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer shadow-md disabled:opacity-40"
            title="إرسال"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ─── 4. Fullscreen Lightbox for Notebook Photo Inspection ─── */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
          <div className="p-4 flex items-center justify-between text-white border-b border-white/10 shrink-0">
            <span className="text-sm font-bold">معاينة وتدقيق صفحة الدفتر</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPhotoRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-xs cursor-pointer"
                title="تدوير الصورة"
              >
                <RotateCw className="w-4 h-4" />
                <span>تدوير</span>
              </button>
              <button
                type="button"
                onClick={() => setPhotoZoom((z) => Math.min(z + 0.3, 3))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPhotoZoom((z) => Math.max(z - 0.3, 0.7))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img
              src={previewPhotoUrl}
              alt="معاينة كاملة"
              style={{
                transform: `rotate(${photoRotation}deg) scale(${photoZoom})`,
                transition: 'transform 0.2s ease-out',
              }}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
