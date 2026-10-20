import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../api/client';
import { StudentSchoolHomework } from '../../types';
import { ErrorAlert, EmptyState, DataGrid, DataGridColumn, AppModal } from '../common';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
  Avatar,
  AvatarFallback,
} from '@/components/ui';
import { HomeworkChatStream } from '../portal/HomeworkChatStream';
import {
  BookOpen,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Eye,
  X,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  Image as ImageIcon,
  Maximize2,
  Users,
} from 'lucide-react';

interface HomeworksManagementProps {
  tenantSlug?: string;
}

export const HomeworksManagement: React.FC<HomeworksManagementProps> = ({ tenantSlug }) => {
  const [homeworks, setHomeworks] = useState<StudentSchoolHomework[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'seen' | 'unseen'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [activeViewTab, setActiveViewTab] = useState<'grid' | 'cards' | 'chat'>('chat');
  const [selectedStudentForChat, setSelectedStudentForChat] = useState<{
    id: string;
    name: string;
    gradeSection: string;
  } | null>(null);

  // Inspection & Guidance Modal State
  const [selectedHw, setSelectedHw] = useState<StudentSchoolHomework | null>(null);
  const [guidanceComment, setGuidanceComment] = useState<string>('');
  const [submittingGuidance, setSubmittingGuidance] = useState<boolean>(false);

  // Photo Preview Modal State
  const [photoViewerOpen, setPhotoViewerOpen] = useState<boolean>(false);
  const [activePhotoList, setActivePhotoList] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  // Helper: parse photos JSON safely
  const parseImages = (raw: string): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // Fetch Homeworks from Server
  const fetchHomeworks = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = tenantSlug
        ? `/api/v1/tenant/admin/school-homeworks?slug=${encodeURIComponent(tenantSlug)}`
        : '/api/v1/tenant/admin/school-homeworks';
      const res = await apiRequest<{ success: boolean; data: StudentSchoolHomework[] }>(endpoint);
      if (res?.data && Array.isArray(res.data)) {
        setHomeworks(res.data);
      } else {
        setHomeworks([]);
      }
    } catch (err: any) {
      setError({ message: err?.message || 'فشل استرجاع سجل الواجبات المدرسية' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeworks();
  }, [tenantSlug]);

  // Handle Mark Seen & Save Guidance Comment
  const handleSaveGuidance = async (hwId: string, comment?: string) => {
    setSubmittingGuidance(true);
    try {
      const endpoint = tenantSlug
        ? `/api/v1/tenant/admin/school-homeworks/${hwId}/acknowledge?slug=${encodeURIComponent(tenantSlug)}`
        : `/api/v1/tenant/admin/school-homeworks/${hwId}/acknowledge`;

      const res = await apiRequest<{ success: boolean; data: StudentSchoolHomework }>(endpoint, {
        method: 'PUT',
        body: JSON.stringify({
          comment: comment !== undefined && comment.trim() !== '' ? comment.trim() : undefined,
        }),
      });

      if (res?.success && res.data) {
        setHomeworks((prev) => prev.map((item) => (item.id === hwId ? res.data : item)));
        setSelectedHw(res.data);
        setSuccessNotice('تم تسجيل الاطلاع وتحديث توجيه الواجب بنجاح');
        setTimeout(() => setSuccessNotice(null), 3000);
      }
    } catch (err: any) {
      alert('فشل حفظ التوجيه: ' + (err?.message || 'خطأ غير متوقع'));
    } finally {
      setSubmittingGuidance(false);
    }
  };

  // Distinct Subjects
  const distinctSubjects = useMemo(() => {
    const set = new Set<string>();
    homeworks.forEach((h) => {
      if (h.subject_name) set.add(h.subject_name);
    });
    return Array.from(set);
  }, [homeworks]);

  // Filtered List
  const filteredList = useMemo(() => {
    return homeworks.filter((hw) => {
      if (statusFilter === 'seen' && !hw.is_seen) return false;
      if (statusFilter === 'unseen' && hw.is_seen) return false;
      if (subjectFilter !== 'all' && hw.subject_name !== subjectFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const studentName = hw.student_profile?.person
          ? `${hw.student_profile.person.first_name} ${hw.student_profile.person.last_name}`.toLowerCase()
          : '';
        const title = (hw.title || '').toLowerCase();
        const desc = (hw.description || '').toLowerCase();
        const subj = (hw.subject_name || '').toLowerCase();
        const stuNumber = (hw.student_profile?.student_number || '').toLowerCase();

        return (
          studentName.includes(q) ||
          title.includes(q) ||
          desc.includes(q) ||
          subj.includes(q) ||
          stuNumber.includes(q)
        );
      }
      return true;
    });
  }, [homeworks, statusFilter, subjectFilter, searchQuery]);

  // Distinct unique students for chat stream view
  const uniqueStudents = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        number: string;
        grade: string;
        section: string;
        count: number;
        unseen: number;
      }
    >();
    homeworks.forEach((h) => {
      const p = h.student_profile?.person;
      const sId = h.student_profile_id;
      const name = p
        ? `${p.first_name} ${p.father_name || ''} ${p.last_name}`
        : h.student_profile?.full_name || 'طالب مسجل';
      const num = h.student_profile?.student_number || '';
      const grade = h.study_grade?.name || '';
      const section = h.class_section?.name || '';

      const existing = map.get(sId);
      if (!existing) {
        map.set(sId, {
          id: sId,
          name,
          number: num,
          grade,
          section,
          count: 1,
          unseen: !h.is_seen ? 1 : 0,
        });
      } else {
        existing.count += 1;
        if (!h.is_seen) existing.unseen += 1;
      }
    });
    return Array.from(map.values());
  }, [homeworks]);

  // Set default selected student for chat
  useEffect(() => {
    if (!selectedStudentForChat && uniqueStudents.length > 0) {
      const first = uniqueStudents[0];
      setSelectedStudentForChat({
        id: first.id,
        name: first.name,
        gradeSection: `${first.grade} • ${first.section}`,
      });
    }
  }, [uniqueStudents, selectedStudentForChat]);

  // Statistics
  const stats = useMemo(() => {
    const total = homeworks.length;
    const seen = homeworks.filter((h) => h.is_seen).length;
    const unseen = total - seen;
    const withImages = homeworks.filter((h) => parseImages(h.images).length > 0).length;
    return { total, seen, unseen, withImages };
  }, [homeworks]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'all' || subjectFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSubjectFilter('all');
  };

  // Open Photos Viewer
  const handleOpenPhotos = (photos: string[], index = 0) => {
    setActivePhotoList(photos);
    setActivePhotoIndex(index);
    setPhotoViewerOpen(true);
  };

  // Open Inspection Dialog
  const handleOpenInspection = (hw: StudentSchoolHomework) => {
    setSelectedHw(hw);
    setGuidanceComment(hw.teacher_comment || '');
  };

  // Define Columns for DataGrid
  const homeworkColumns: DataGridColumn<StudentSchoolHomework>[] = useMemo(
    () => [
      {
        key: 'student',
        header: 'الطالب',
        align: 'right',
        render: (hw) => {
          const person = hw.student_profile?.person;
          const fullName = person
            ? `${person.first_name} ${person.father_name || ''} ${person.last_name}`
            : 'طالب مسجل';
          const initial = person?.first_name ? person.first_name.charAt(0) : 'ط';

          return (
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8 rounded-lg ring-1 ring-border shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="text-right">
                <span className="block text-foreground font-bold text-xs">{fullName}</span>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                  <span className="font-mono text-foreground/80">
                    {hw.student_profile?.student_number || '—'}
                  </span>
                  {hw.study_grade?.name && (
                    <>
                      <span>•</span>
                      <span>{hw.study_grade.name}</span>
                    </>
                  )}
                  {hw.class_section?.name && (
                    <>
                      <span>•</span>
                      <span>شعبة {hw.class_section.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: 'subject',
        header: 'المادة المدرسية',
        align: 'right',
        render: (hw) => (
          <Badge
            variant="outline"
            className="font-bold text-[11px] gap-1 bg-background border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300"
          >
            <BookOpen className="w-3 h-3 text-purple-600" />
            {hw.subject_name}
          </Badge>
        ),
      },
      {
        key: 'title',
        header: 'عنوان الواجب والتمرين',
        align: 'right',
        render: (hw) => (
          <div className="text-right max-w-[220px]">
            <span className="block text-xs font-bold text-foreground truncate" title={hw.title}>
              {hw.title}
            </span>
            {hw.description && (
              <span className="block text-[10px] text-muted-foreground truncate" title={hw.description}>
                {hw.description}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'photos',
        header: 'دفتر الطالب',
        align: 'right',
        render: (hw) => {
          const photos = parseImages(hw.images);
          if (photos.length === 0) {
            return <span className="text-[11px] text-muted-foreground">—</span>;
          }
          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenPhotos(photos, 0)}
                className="relative w-7 h-7 rounded-lg overflow-hidden border border-border group shrink-0 bg-secondary/50"
                title="معاينة أول صفحة"
              >
                <img
                  src={photos[0]}
                  alt="دفتر"
                  className="w-full h-full object-cover group-hover:scale-110 transition"
                  loading="lazy"
                />
              </button>
              <Badge
                variant="secondary"
                onClick={() => handleOpenPhotos(photos, 0)}
                className="cursor-pointer text-[10px] font-bold gap-1 hover:bg-secondary"
              >
                <ImageIcon className="w-3 h-3 text-primary" />
                <span>{photos.length} {photos.length === 1 ? 'صفحة' : 'صفحات'}</span>
              </Badge>
            </div>
          );
        },
      },
      {
        key: 'submittedBy',
        header: 'المُرسِل',
        align: 'right',
        render: (hw) => (
          <Badge variant="outline" className="text-[10px] font-semibold">
            {hw.submitted_by === 'guardian' ? 'ولي الأمر' : 'الطالب'}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: 'حالة المتابعة',
        align: 'right',
        render: (hw) => {
          if (hw.is_seen) {
            return (
              <div className="flex flex-col items-start gap-0.5">
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-700 bg-emerald-50/60 text-[11px] font-bold gap-1.5 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  تم الاطلاع ✓✓
                </Badge>
                {hw.teacher_profile?.person && (
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {hw.teacher_profile.person.first_name} {hw.teacher_profile.person.last_name}
                  </span>
                )}
              </div>
            );
          }
          return (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-700 bg-amber-50/60 text-[11px] font-bold gap-1.5 py-0.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              بانتظار المدرس
            </Badge>
          );
        },
      },
      {
        key: 'createdAt',
        header: 'تاريخ الرفع',
        align: 'right',
        render: (hw) => (
          <div className="text-right text-[11px] font-mono text-muted-foreground">
            <div>{new Date(hw.created_at).toLocaleDateString('ar-IQ')}</div>
            <div className="text-[9px] text-muted-foreground/80">
              {new Date(hw.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'الإجراءات',
        align: 'center',
        width: '130px',
        render: (hw) => {
          const person = hw.student_profile?.person;
          const sName = person
            ? `${person.first_name} ${person.father_name || ''} ${person.last_name}`
            : hw.student_profile?.full_name || 'طالب مسجل';

          return (
            <div className="flex items-center justify-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedStudentForChat({
                    id: hw.student_profile_id,
                    name: sName,
                    gradeSection: `${hw.study_grade?.name || ''} • ${hw.class_section?.name || ''}`,
                  });
                  setActiveViewTab('chat');
                }}
                className="h-8 px-2 text-xs font-bold text-primary hover:bg-primary/10 gap-1"
                title="فتح محادثة الواجب"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>المحادثة</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenInspection(hw)}
                className="h-8 px-2.5 text-xs font-bold text-foreground hover:bg-secondary gap-1"
                title="معاينة الواجب وتوجيه الطالب"
              >
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span>تفاصيل</span>
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-5" dir="rtl">
      {/* Alert Messages */}
      {error && (
        <ErrorAlert
          message={error.message}
          requestId={error.requestId}
          onDismiss={() => setError(null)}
        />
      )}

      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Header (رأس الصفحة متوافق مع معايير المنصة) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">
                واجبات ودفاتر المدرسة (تقوية)
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                متابعة دفاتر وواجبات الطلاب المرفوعة من مدارسهم الحكومية وتوجيهات مدرسي المعهد
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHomeworks}
            disabled={loading}
            className="h-9 text-xs font-bold gap-1.5 text-muted-foreground hover:text-foreground"
            title="تحديث السجل"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
        </div>
      </div>

      {/* 2. Compact Stats Strip (شريط إحصائيات 4 كروت قياسية) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">إجمالي الواجبات</span>
            <span className="text-xl font-black text-foreground mt-0.5 block">{stats.total}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">بانتظار اطلاع المدرس</span>
            <span className="text-xl font-black text-amber-600 mt-0.5 block">{stats.unseen}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">تم الاطلاع والتوجيه</span>
            <span className="text-xl font-black text-emerald-600 mt-0.5 block">{stats.seen}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">مرفوعة بصور الدفتر</span>
            <span className="text-xl font-black text-purple-600 mt-0.5 block">{stats.withImages}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <ImageIcon className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Toolbar (شريط التصفية والبحث الموحد) */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم الطالب، الرقم التعريفي، عنوان الواجب، المادة..."
              className="pr-9 pl-8 text-xs h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">كل الحالات</option>
              <option value="unseen">بانتظار اطلاع المدرس ({stats.unseen})</option>
              <option value="seen">تم الاطلاع ✓✓ ({stats.seen})</option>
            </select>

            {/* Subject Filter */}
            {distinctSubjects.length > 0 && (
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[170px]"
              >
                <option value="all">كل المواد المدرسية</option>
                {distinctSubjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            )}

            {/* View Switcher Tabs */}
            <div className="flex items-center border border-border rounded-lg p-0.5 bg-secondary/50">
              <button
                type="button"
                onClick={() => setActiveViewTab('chat')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition flex items-center gap-1 ${
                  activeViewTab === 'chat'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>محادثات الواجبات (واتساب)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab('grid')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                  activeViewTab === 'grid'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                الجدول
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab('cards')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                  activeViewTab === 'cards'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                البطاقات
              </button>
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 text-xs font-bold text-destructive hover:bg-destructive/10 gap-1 px-2.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>مسح</span>
              </Button>
            )}
          </div>
        </div>

        {/* Counter Pill */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
          <span>
            إجمالي النتائج: <strong className="text-foreground">{filteredList.length}</strong> واجب
            {hasActiveFilters && ` (تمت التصفية من أصل ${homeworks.length})`}
          </span>
          <span className="font-medium text-[10px]">
            {stats.unseen > 0 ? `⚠️ يوجد ${stats.unseen} واجب بانتظار المراجعة والتوجيه` : '✓ جميع الواجبات تم الاطلاع عليها'}
          </span>
        </div>
      </div>

      {/* 4. Main View: DataGrid Table or Cards Feed */}
      {activeViewTab === 'grid' ? (
        <DataGrid<StudentSchoolHomework>
          data={filteredList}
          columns={homeworkColumns}
          keyExtractor={(hw) => hw.id}
          loading={loading && homeworks.length === 0}
          loadingMessage="جاري تحميل سجل الواجبات والتحضير اليومي..."
          title="سجل دفاتر وواجبات الطلاب"
          badgeText={`${filteredList.length} واجب`}
          headerSubtitle={hasActiveFilters ? `(تمت التصفية من أصل ${homeworks.length})` : undefined}
          pageSize={10}
          emptyTitle="لا توجد واجبات مطابقة"
          emptyDescription="لم يتم العثور على أي واجبات مدرسية تطابق معايير التصفية الحالية."
        />
      ) : activeViewTab === 'cards' ? (
        /* Visual Cards Feed */
        <div className="space-y-3">
          {loading && homeworks.length === 0 ? (
            <div className="p-12 text-center bg-card rounded-2xl border border-border">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-bold">جاري تحميل بطاقات الواجبات...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <EmptyState
              title="لا توجد واجبات مطابقة"
              description="لم يتم العثور على أي واجبات مدرسية تطابق معايير التصفية الحالية."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredList.map((hw) => {
                const photos = parseImages(hw.images);
                const person = hw.student_profile?.person;
                const studentFullName = person
                  ? `${person.first_name} ${person.father_name || ''} ${person.last_name}`
                  : 'طالب مسجل';

                return (
                  <Card
                    key={hw.id}
                    className={`transition hover:shadow-md ${
                      !hw.is_seen
                        ? 'border-amber-300 dark:border-amber-800/60 ring-1 ring-amber-300/40 dark:ring-amber-900/20'
                        : 'border-border'
                    }`}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Top Row: Student + Subject + Date */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-9 h-9 rounded-xl ring-1 ring-border shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {person?.first_name ? person.first_name.charAt(0) : 'ط'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="text-xs font-black text-foreground">{studentFullName}</h4>
                            <p className="text-[10px] text-muted-foreground">
                              {hw.study_grade?.name || ''}{' '}
                              {hw.class_section?.name ? `• شعبة ${hw.class_section.name}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 text-[10px] font-bold"
                          >
                            {hw.subject_name}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {new Date(hw.created_at).toLocaleDateString('ar-IQ')}
                          </span>
                        </div>
                      </div>

                      {/* Content Box */}
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 space-y-1">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-foreground">{hw.title}</h5>
                          <span className="text-[9px] text-muted-foreground">
                            بواسطة: {hw.submitted_by === 'guardian' ? 'ولي الأمر' : 'الطالب'}
                          </span>
                        </div>
                        {hw.description && (
                          <p className="text-[11px] text-foreground font-medium whitespace-pre-line leading-relaxed">
                            {hw.description}
                          </p>
                        )}
                      </div>

                      {/* Photos Row */}
                      {photos.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold">
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3 h-3 text-primary" />
                              <span>صفحات الدفتر المرفوعة ({photos.length})</span>
                            </span>
                            <span className="text-[9px] text-primary">انقر للتكبير</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {photos.map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleOpenPhotos(photos, idx)}
                                className="relative aspect-3/4 rounded-xl overflow-hidden border border-border group bg-secondary/40 text-right"
                              >
                                <img
                                  src={url}
                                  alt={`صفحة ${idx + 1}`}
                                  className="w-full h-full object-cover transition group-hover:scale-105"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold gap-1">
                                  <Maximize2 className="w-3 h-3" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status & Guidance Note */}
                      <div className="pt-2 border-t border-border flex flex-col gap-2">
                        {hw.is_seen ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>تم الاطلاع من قبل المدرس</span>
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenInspection(hw)}
                                className="h-7 text-[10px] text-primary font-bold px-2 hover:bg-secondary"
                              >
                                {hw.teacher_comment ? 'تعديل التوجيه' : 'إضافة توجيه'}
                              </Button>
                            </div>
                            {hw.teacher_comment && (
                              <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 text-xs">
                                <span className="block text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-0.5 flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  <span>توجيه المدرس للطالب:</span>
                                </span>
                                <p className="text-foreground font-medium text-[11px] leading-relaxed">
                                  {hw.teacher_comment}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-1">
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 text-amber-700 bg-amber-50/60 text-[11px] font-bold gap-1 py-0.5"
                            >
                              <Clock className="w-3 h-3" />
                              <span>بانتظار اطلاع المدرس</span>
                            </Badge>
                            <Button
                              size="sm"
                              onClick={() => handleOpenInspection(hw)}
                              className="h-8 text-xs font-bold gap-1.5 shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>معاينة وتوجيه</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 4C. Chat Stream View (نظام محادثات الواجبات المباشر) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Right Column: Students Roster List */}
          <div className="lg:col-span-4 p-4 rounded-3xl bg-card border border-border space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground">قائمة الطلاب بالواجبات</h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                {uniqueStudents.length} طلاب
              </Badge>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {uniqueStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  لا توجد واجبات مرفوعة حالياً
                </p>
              ) : (
                uniqueStudents.map((st) => {
                  const isSelected = selectedStudentForChat?.id === st.id;

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        setSelectedStudentForChat({
                          id: st.id,
                          name: st.name,
                          gradeSection: `${st.grade} • ${st.section}`,
                        })
                      }
                      className={`w-full text-right p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                          : 'bg-secondary/30 border-border hover:bg-secondary/60 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-9 h-9 rounded-xl">
                          <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs">
                            {st.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="text-xs font-bold leading-tight">{st.name}</h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {st.grade} {st.section && `• شعبة ${st.section}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                          {st.count} واجبات
                        </span>
                        {st.unseen > 0 && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md">
                            {st.unseen} غير مدقق
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Left Column: Interactive WhatsApp Homework Chat Stream */}
          <div className="lg:col-span-8">
            {selectedStudentForChat ? (
              <HomeworkChatStream
                studentId={selectedStudentForChat.id}
                studentName={selectedStudentForChat.name}
                studentGradeSection={selectedStudentForChat.gradeSection}
                tenantSlug={tenantSlug}
                viewerRole="admin"
                teacherName="إدارة المعهد"
                initialHomeworks={homeworks.filter(
                  (h) => h.student_profile_id === selectedStudentForChat.id
                )}
                onHomeworksUpdated={(updated) => {
                  setHomeworks((prev) => {
                    const others = prev.filter(
                      (h) => h.student_profile_id !== selectedStudentForChat.id
                    );
                    return [...others, ...updated];
                  });
                }}
              />
            ) : (
              <div className="p-12 rounded-3xl bg-card border border-dashed border-border text-center space-y-3">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto" />
                <h4 className="text-sm font-bold text-foreground">اختر طالباً لمعاينة واجباته</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  حدد أي طالب من القائمة الجانبية لاستعراض سجل واجباته المرفوعة بنظام المحادثة وتدقيقها فوراً.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Inspection & Guidance AppModal (نافذة المعاينة والتوجيه القياسية) */}
      <AppModal
        open={!!selectedHw}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedHw(null);
            setGuidanceComment('');
          }
        }}
        title="معاينة الواجب المدرسي وتوجيه الطالب"
        description="استعراض تفاصيل الواجب المرفوع من المدرسة الحكومية وتسجيل التوجيه التعليمي للطالب"
        icon={<BookOpen className="w-5 h-5 text-primary" />}
        size="lg"
      >
        {selectedHw && (
          <div className="space-y-4">
            {/* Student Info Box */}
            <div className="p-3.5 rounded-xl bg-secondary/30 border border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 rounded-xl ring-1 ring-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {selectedHw.student_profile?.person?.first_name?.charAt(0) || 'ط'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-sm font-black text-foreground">
                    {selectedHw.student_profile?.person
                      ? `${selectedHw.student_profile.person.first_name} ${selectedHw.student_profile.person.father_name || ''} ${selectedHw.student_profile.person.last_name}`
                      : 'طالب مسجل'}
                  </h4>
                  <p className="text-xs text-muted-foreground font-medium">
                    {selectedHw.study_grade?.name || ''}{' '}
                    {selectedHw.class_section?.name ? `• شعبة ${selectedHw.class_section.name}` : ''}
                    <span className="mx-1">•</span>
                    <span className="font-mono">{selectedHw.student_profile?.student_number}</span>
                  </p>
                </div>
              </div>

              <div className="text-left shrink-0">
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 text-xs font-bold"
                >
                  {selectedHw.subject_name}
                </Badge>
                <span className="block text-[10px] text-muted-foreground font-mono mt-1">
                  {new Date(selectedHw.created_at).toLocaleDateString('ar-IQ')}
                </span>
              </div>
            </div>

            {/* Title & Description */}
            <div className="p-3.5 rounded-xl bg-card border border-border space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground block">
                موضوع الواجب والتمرين (من المدرسة الحكومية):
              </span>
              <h5 className="text-sm font-black text-foreground">{selectedHw.title}</h5>
              {selectedHw.description && (
                <p className="text-xs text-foreground/90 font-medium whitespace-pre-line leading-relaxed pt-1 border-t border-border/40">
                  {selectedHw.description}
                </p>
              )}
            </div>

            {/* Notebook Photos */}
            {(() => {
              const photos = parseImages(selectedHw.images);
              if (photos.length === 0) return null;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-primary" />
                      <span>صفحات الدفتر المرفوعة ({photos.length})</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      انقر على الصورة لفتحها بالحجم الكامل
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {photos.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleOpenPhotos(photos, idx)}
                        className="relative aspect-3/4 rounded-xl overflow-hidden border border-border group bg-secondary/40 text-right"
                      >
                        <img
                          src={url}
                          alt={`صفحة ${idx + 1}`}
                          className="w-full h-full object-cover transition group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                          <Maximize2 className="w-4 h-4" />
                          <span>تكبير</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Teacher Guidance / Comment Form */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  توجيه المدرس للطالب:
                </Label>
                {selectedHw.is_seen && (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 bg-emerald-50/60 text-[10px] font-bold">
                    تم تسجيل الاطلاع مسبقاً ✓✓
                  </Badge>
                )}
              </div>

              {/* Quick Suggestion Chips */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground block">
                  توجيهات سريعة جاهزة:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'سنحل هذا السؤال معاً في درس اليوم ✍️',
                    'أحضر دفترك معك للحصة القادمة 📘',
                    'ممتاز، حلك صحيح ومرتب ⭐',
                    'راجع المسألة وطبق القانون مجدداً 💡',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setGuidanceComment(chip)}
                      className="px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-[10px] font-medium text-foreground transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={3}
                value={guidanceComment}
                onChange={(e) => setGuidanceComment(e.target.value)}
                placeholder="اكتب التوجيه أو الملاحظة للطالب هنا لتظهر في تطبيقه..."
                className="w-full p-2.5 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedHw(null);
                  setGuidanceComment('');
                }}
                className="text-xs font-bold"
              >
                إغلاق
              </Button>
              <Button
                size="sm"
                disabled={submittingGuidance}
                onClick={() => handleSaveGuidance(selectedHw.id, guidanceComment)}
                className="text-xs font-bold gap-1.5 shadow-xs"
              >
                <CheckCheck className="w-4 h-4" />
                <span>{submittingGuidance ? 'جاري الحفظ...' : 'تأكيد الاطلاع وتحديث التوجيه'}</span>
              </Button>
            </div>
          </div>
        )}
      </AppModal>

      {/* 6. Fullscreen Photo Viewer AppModal */}
      <AppModal
        open={photoViewerOpen}
        onOpenChange={(open) => setPhotoViewerOpen(open)}
        title={`معاينة صفحة الدفتر (${activePhotoIndex + 1} من ${activePhotoList.length})`}
        description="صورة صفحة الدفتر المرفوعة من المدرسة الحكومية"
        icon={<ImageIcon className="w-5 h-5 text-primary" />}
        size="xl"
      >
        <div className="space-y-4">
          <div className="relative max-h-[70vh] flex items-center justify-center bg-black/90 rounded-2xl overflow-hidden p-2 border border-border">
            {activePhotoList.length > 0 && (
              <img
                src={activePhotoList[activePhotoIndex]}
                alt={`صفحة ${activePhotoIndex + 1}`}
                className="max-h-[66vh] max-w-full object-contain rounded-xl"
              />
            )}

            {/* Next / Prev Controls */}
            {activePhotoList.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev > 0 ? prev - 1 : activePhotoList.length - 1
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition"
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev < activePhotoList.length - 1 ? prev + 1 : 0
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition"
                  title="الصفحة التالية"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails strip if multiple */}
          {activePhotoList.length > 1 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
              {activePhotoList.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`w-12 h-14 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                    activePhotoIndex === idx
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPhotoViewerOpen(false)}
              className="text-xs font-bold"
            >
              إغلاق المعاينة
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
};
