import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest, AppAPIError } from '../../api/client';
import {
  AdoptedCurriculum,
  Subject,
  AcademicStructureData,
} from '../../types';
import { ErrorAlert, DataGrid, DataGridColumn } from '../common';
import {
  Card,
  Button,
  Badge,
  Input,
  Label,
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';

import {
  BookOpen,
  BookMarked,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Clock,
  Layers,
  X,
  Search,
  UserCheck,
  AlertTriangle,
  GraduationCap,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
} from 'lucide-react';
import { AcademicFilterBar } from './AcademicFilterBar';
import { useAcademicFilter } from '../../context/AcademicFilterContext';
import { useConfirm, useToast } from '../../context/NotificationContext';

interface CurriculaManagementProps {
  onUpdated?: () => void;
}

export const CurriculaManagement: React.FC<CurriculaManagementProps> = ({ onUpdated }) => {
  const confirm = useConfirm();
  const toast = useToast();
  const { filters, refreshStructure: refreshAcademicScope } = useAcademicFilter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [adoptedCurricula, setAdoptedCurricula] = useState<AdoptedCurriculum[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);

  // Main navigation tab: 'curricula' | 'subjects'
  const [mainTab, setMainTab] = useState<'curricula' | 'subjects'>('curricula');

  // Operational filters
  const [teacherAssignmentFilter, setTeacherAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subjectTrackFilter, setSubjectTrackFilter] = useState<'all' | 'scientific' | 'literary' | 'core' | 'basic' | 'languages'>('all');
  
  // Pagination State for Curricula Data Grid
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Dialogs
  const [showAdoptCurriculum, setShowAdoptCurriculum] = useState(false);
  const [adoptForm, setAdoptForm] = useState({
    studyGradeId: '',
    subjectId: '',
    customSubjectName: '',
    weeklySessionsCount: 4,
  });
  const [submittingAdopt, setSubmittingAdopt] = useState(false);

  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    description: '',
  });
  const [submittingSubject, setSubmittingSubject] = useState(false);

  // Auto-dismiss notice
  useEffect(() => {
    if (successNotice) {
      const timer = setTimeout(() => setSuccessNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successNotice]);

  // Fetch all structure data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: AcademicStructureData }>(
        '/api/v1/tenant/admin/academic/structure'
      );
      if (res?.data) {
        setPrograms(res.data.programs || []);
        setAdoptedCurricula(res.data.adopted_curricula || []);
        setSubjects(res.data.subjects || []);
        refreshAcademicScope();
      }
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل استرجاع بيانات المناهج والمقررات' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Flattened grades for dropdowns
  const allGrades = useMemo(() => {
    const list: { id: string; name: string; programId: string; programName: string }[] = [];
    programs.forEach((p) => {
      p.grades?.forEach((g: any) => {
        list.push({
          id: g.id,
          name: g.name,
          programId: p.id,
          programName: p.name,
        });
      });
    });
    return list;
  }, [programs]);

  // Quick stats
  const totalWeeklySessions = useMemo(() => {
    return adoptedCurricula.reduce(
      (sum, c) => sum + (Number(c.weekly_sessions_count) || 0),
      0
    );
  }, [adoptedCurricula]);

  const assignedCount = useMemo(() => {
    return adoptedCurricula.filter((c) => Boolean(c.assigned_teacher_id)).length;
  }, [adoptedCurricula]);

  // Filtered adopted curricula using central academic filter
  const filteredCurricula = useMemo(() => {
    return adoptedCurricula.filter((item) => {
      // Stage filter
      if (filters.programId !== 'all') {
        const gradeInfo = allGrades.find((g) => g.id === item.study_grade_id);
        if (gradeInfo?.programId !== filters.programId) return false;
      }

      // Grade filter
      if (filters.gradeId !== 'all' && item.study_grade_id !== filters.gradeId) {
        return false;
      }

      // Teacher assignment filter
      if (teacherAssignmentFilter === 'assigned' && !item.assigned_teacher_id) {
        return false;
      }
      if (teacherAssignmentFilter === 'unassigned' && item.assigned_teacher_id) {
        return false;
      }

      // Search query (from global filter or local search)
      const queryText = filters.searchQuery || searchQuery;
      if (queryText.trim()) {
        const q = queryText.trim().toLowerCase();
        const sName = (
          item.subject_name ||
          item.curriculum_edition?.definition?.subject?.name ||
          item.curriculum_edition?.definition?.name ||
          ''
        ).toLowerCase();
        const sCode = (
          item.subject_code ||
          item.curriculum_edition?.definition?.subject?.code ||
          ''
        ).toLowerCase();
        const gName = (item.study_grade_name || item.study_grade?.name || '').toLowerCase();
        const teacherName = (item.assigned_teacher_name || '').toLowerCase();

        return (
          sName.includes(q) ||
          sCode.includes(q) ||
          gName.includes(q) ||
          teacherName.includes(q)
        );
      }

      return true;
    });
  }, [adoptedCurricula, allGrades, filters.programId, filters.gradeId, filters.searchQuery, searchQuery, teacherAssignmentFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.programId, filters.gradeId, filters.searchQuery, searchQuery, teacherAssignmentFilter, pageSize]);

  // DataGrid Column Definitions
  const curriculaColumns: DataGridColumn<AdoptedCurriculum>[] = useMemo(
    () => [
      {
        key: 'index',
        header: '#',
        width: '48px',
        align: 'center',
        render: (_item, _idx, globalIndex) => (
          <span className="font-mono text-muted-foreground font-semibold">{globalIndex}</span>
        ),
      },
      {
        key: 'subject',
        header: 'المقرر الدراسي',
        align: 'right',
        render: (item) => {
          const subjectName =
            item.subject_name ||
            item.curriculum_edition?.definition?.subject?.name ||
            item.curriculum_edition?.definition?.name ||
            'مقرر دراسي';
          const subjectCode =
            item.subject_code || item.curriculum_edition?.definition?.subject?.code;

          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="text-right">
                <div className="font-bold text-foreground">{subjectName}</div>
                {subjectCode && (
                  <span className="text-[10px] font-mono text-muted-foreground">{subjectCode}</span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: 'grade',
        header: 'الصف الدراسي',
        align: 'right',
        render: (item) => {
          const gradeName = item.study_grade_name || item.study_grade?.name || 'صف دراسي';
          return (
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{gradeName}</span>
            </div>
          );
        },
      },
      {
        key: 'program',
        header: 'المرحلة التعليمية',
        align: 'right',
        render: (item) => {
          const programName = item.educational_program_name || 'المرحلة التعليمية';
          return (
            <Badge variant="outline" className="text-[11px] font-medium border-border">
              <Layers className="w-3 h-3 ml-1 text-muted-foreground" />
              <span>{programName}</span>
            </Badge>
          );
        },
      },
      {
        key: 'sessions',
        header: 'نصاب الحصص الأسبوعية',
        align: 'center',
        render: (item) => (
          <Badge variant="secondary" className="gap-1 font-mono font-bold text-xs">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>{item.weekly_sessions_count} حصص / أسبوع</span>
          </Badge>
        ),
      },
      {
        key: 'teacher',
        header: 'المدرس المكلف',
        align: 'center',
        render: (item) =>
          item.assigned_teacher_id ? (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-200 gap-1 text-xs">
              <UserCheck className="w-3 h-3 text-emerald-600" />
              <span>{item.assigned_teacher_name || 'مُسند لمدرس'}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="border-dashed text-amber-700 bg-amber-50/50 gap-1 text-[11px]">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>غير مسند بعد</span>
            </Badge>
          ),
      },
      {
        key: 'actions',
        header: 'إجراءات',
        align: 'center',
        width: '80px',
        render: (item) => {
          const subjectName =
            item.subject_name ||
            item.curriculum_edition?.definition?.subject?.name ||
            item.curriculum_edition?.definition?.name ||
            'المقرر';
          return (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteCurriculum(item.id, subjectName)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg mx-auto"
              title="إلغاء اعتماد المقرر"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          );
        },
      },
    ],
    []
  );

  // Subject track helper
  const getSubjectTrack = (code: string) => {
    switch (code) {
      case 'PHYS':
      case 'CHEM':
      case 'BIO':
        return { label: 'علمي', type: 'scientific', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'HIST':
      case 'GEOG':
      case 'ECON':
      case 'PHIL':
        return { label: 'أدبي', type: 'literary', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'SCI':
      case 'SOCIAL':
        return { label: 'أساسي (ابتدائي/متوسط)', type: 'basic', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'FREN':
        return { label: 'لغات', type: 'languages', color: 'bg-pink-50 text-pink-700 border-pink-200' };
      default:
        return { label: 'مشترك عام', type: 'core', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  };

  // Filtered subjects
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          s.name.toLowerCase().includes(q) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (s.description && s.description.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // 2. Track Filter
      if (subjectTrackFilter !== 'all') {
        const track = getSubjectTrack(s.code);
        if (track.type !== subjectTrackFilter) return false;
      }

      return true;
    });
  }, [subjects, searchQuery, subjectTrackFilter]);

  // Submit Adopt Curriculum
  const handleAdoptCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adoptForm.studyGradeId) return;
    if (!adoptForm.subjectId && !adoptForm.customSubjectName.trim()) return;

    setSubmittingAdopt(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/academic/curricula/adopt', {
        method: 'POST',
        body: JSON.stringify({
          study_grade_id: adoptForm.studyGradeId,
          subject_id: adoptForm.subjectId || undefined,
          custom_subject_name: adoptForm.customSubjectName.trim() || undefined,
          weekly_sessions_count: Number(adoptForm.weeklySessionsCount) || 4,
        }),
      });

      setShowAdoptCurriculum(false);
      setAdoptForm({
        studyGradeId: '',
        subjectId: '',
        customSubjectName: '',
        weeklySessionsCount: 4,
      });
      setSuccessNotice('تم اعتماد المقرر الدراسي للصف بنجاح');
      await fetchData();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل اعتماد المقرر الدراسي' });
      }
    } finally {
      setSubmittingAdopt(false);
    }
  };

  // Submit Add Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) return;

    setSubmittingSubject(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/academic/subjects', {
        method: 'POST',
        body: JSON.stringify({
          code: subjectForm.code.trim() || undefined,
          name: subjectForm.name.trim(),
          description: subjectForm.description.trim() || undefined,
        }),
      });

      setShowAddSubject(false);
      setSubjectForm({ code: '', name: '', description: '' });
      setSuccessNotice('تم إضافة المادة الدراسية إلى البنك بنجاح');
      await fetchData();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل إضافة المادة الدراسية' });
      }
    } finally {
      setSubmittingSubject(false);
    }
  };

  // Delete Adopted Curriculum
  const handleDeleteCurriculum = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'إلغاء اعتماد مقرر دراسي',
      message: `هل أنت متأكد من إلغاء اعتماد مقرر "${name}" لهذا الصف؟ سيتم إزالته من الخطط الدراسية وإلغاء إسناد المدرس.`,
      confirmText: 'نعم، إلغاء الاعتماد',
      cancelText: 'تراجع',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await apiRequest(`/api/v1/tenant/admin/academic/curricula/adopt/${id}`, {
        method: 'DELETE',
      });
      toast.success(`تم إلغاء اعتماد مقرر "${name}" بنجاح`);
      await fetchData();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        toast.error(err.message, 'فشل إلغاء الاعتماد');
      } else {
        toast.error('فشل إلغاء اعتماد المقرر الدراسي');
      }
    }
  };

  // Delete Subject from Bank
  const handleDeleteSubject = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'حذف مادة من بنك المواد',
      message: `هل أنت متأكد من حذف مادة "${name}" نهائياً من بنك المواد الأكاديمية؟`,
      confirmText: 'نعم، حذف المادة',
      cancelText: 'تراجع',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await apiRequest(`/api/v1/tenant/admin/academic/subjects/${id}`, {
        method: 'DELETE',
      });
      toast.success(`تم حذف مادة "${name}" من بنك المواد بنجاح`);
      await fetchData();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        toast.error(err.message, 'فشل الحذف');
      } else {
        toast.error('فشل حذف المادة الدراسية');
      }
    }
  };

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

      {/* 1. Header with HUD Stats & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">
              إدارة المناهج والخطط الدراسية
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              توزيع المقررات على الصفوف، تحديد أنصبة الحصص الأسبوعية، وإدارة بنك المواد
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-9 text-xs font-bold gap-1.5 text-muted-foreground hover:text-foreground"
            title="تحديث البيانات"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </Button>

          {mainTab === 'curricula' ? (
            <Button
              onClick={() => setShowAdoptCurriculum(true)}
              disabled={allGrades.length === 0}
              size="sm"
              className="h-9 text-xs font-bold gap-1.5 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4" />
              <span>اعتماد مقرر دراسي لصف</span>
            </Button>
          ) : (
            <Button
              onClick={() => setShowAddSubject(true)}
              size="sm"
              className="h-9 text-xs font-bold gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مادة للبنك</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Top Metric Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="shadow-xs p-3.5 border border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground font-semibold">المقررات المعتمدة</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BookMarked className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">{adoptedCurricula.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">مقرر دراسي مسند للصفوف</div>
        </Card>

        <Card className="shadow-xs p-3.5 border border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground font-semibold">الحصص الأسبوعية</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{totalWeeklySessions}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">حصة تدريسية أسبوعياً</div>
        </Card>

        <Card className="shadow-xs p-3.5 border border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground font-semibold">الإسناد التدريسي</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {assignedCount}{' '}
            <span className="text-xs font-normal text-muted-foreground">/ {adoptedCurricula.length}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">مقرر مكلف به مدرسون</div>
        </Card>

        <Card className="shadow-xs p-3.5 border border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground font-semibold">بنك المواد المعياري</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{subjects.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">مادة أكاديمية مسجلة بالبنك</div>
        </Card>
      </div>

      {/* 3. Main View Switcher: Curricula vs Subjects Bank */}
      <Tabs
        value={mainTab}
        onValueChange={(val) => setMainTab(val as 'curricula' | 'subjects')}
        className="w-full"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="curricula" className="text-xs font-bold gap-2">
              <BookMarked className="w-3.5 h-3.5" />
              <span>المقررات المعتمدة للصفوف ({adoptedCurricula.length})</span>
            </TabsTrigger>
            <TabsTrigger value="subjects" className="text-xs font-bold gap-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>بنك المواد الأكاديمية ({subjects.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ===================== TAB 1: ADOPTED GRADE CURRICULA ===================== */}
        <TabsContent value="curricula" className="mt-4 space-y-4">
          {/* Universal Academic Filter Bar - Styled with Shadcn UI */}
          <AcademicFilterBar
            showProgram={true}
            showGrade={true}
            showSearch={true}
            searchPlaceholder="بحث بالمقرر، الرمز، المدرس..."
            extraActions={
              <select
                value={teacherAssignmentFilter}
                onChange={(e) => setTeacherAssignmentFilter(e.target.value as any)}
                className="h-9 rounded-lg border border-input bg-background text-foreground px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
              >
                <option value="all">كل حالات الإسناد التدريسي</option>
                <option value="assigned">مسند لمدرس فقط</option>
                <option value="unassigned">غير مسند بعد</option>
              </select>
            }
          />

          {/* CURRICULA DATA GRID */}
          <DataGrid<AdoptedCurriculum>
            data={filteredCurricula}
            columns={curriculaColumns}
            keyExtractor={(item) => item.id}
            loading={loading}
            loadingMessage="جاري استرجاع بيانات المناهج والمقررات..."
            emptyTitle={
              filters.searchQuery || searchQuery
                ? 'لا توجد مقررات دراسية مطابقة لبحثك'
                : 'لا توجد مقررات دراسية مسندة لهذا الاختيار'
            }
            emptyDescription="قم باعتماد المقررات وتحديد نصاب الحصص الأسبوعية لكل صف دراسي لإسنادها للمدرسين وجدولة الحصص."
            emptyAction={
              allGrades.length > 0 ? (
                <Button
                  onClick={() => setShowAdoptCurriculum(true)}
                  size="sm"
                  className="text-xs font-bold gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>اعتماد مقرر دراسي الآن</span>
                </Button>
              ) : undefined
            }
            title="سجل المناهج والمقررات المعتمدة"
            badgeText={`${filteredCurricula.length} مقرر دراسي`}
            headerSubtitle="مرتبة حسب الصفوف والمراحل الدراسية لعام 2026/2027"
            pagination={true}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </TabsContent>

        {/* ===================== TAB 2: MASTER SUBJECTS BANK ===================== */}
        <TabsContent value="subjects" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-2xl border border-border bg-card">
            <div>
              <h2 className="text-sm font-bold text-foreground">بنك المواد والمقررات الأكاديمية المعيارية</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                دليل المواد العلمية التي يمكن اعتمادها في أي صف دراسي وتخصيص نصاب حصصها
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-44 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في بنك المواد..."
                  className="h-8 pr-8 text-xs bg-muted/20"
                />
              </div>

              <Button
                onClick={() => setShowAddSubject(true)}
                size="sm"
                className="h-8 text-xs font-bold gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مادة جديدة</span>
              </Button>
            </div>
          </div>

          {/* Track Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold text-muted-foreground ml-2 shrink-0">المسار الدراسي:</span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'scientific', label: 'الفرع العلمي (فيزياء، كيمياء، أحياء)' },
              { id: 'literary', label: 'الفرع الأدبي (تاريخ، جغرافيا، اقتصاد، فلسفة)' },
              { id: 'core', label: 'المشترك العام (عربي، إنكليزي، إسلامية، رياضيات)' },
              { id: 'basic', label: 'الأساسي (ابتدائي ومتوسط)' },
              { id: 'languages', label: 'اللغات' },
            ].map((tab) => {
              const isSelected = subjectTrackFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSubjectTrackFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                      : 'bg-card border-border text-foreground hover:border-primary/40'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredSubjects.map((sub) => {
              const track = getSubjectTrack(sub.code);
              // Count how many grades adopted this subject
              const adoptionCount = adoptedCurricula.filter((c) => {
                const sName = c.subject_name || c.curriculum_edition?.definition?.subject?.name || '';
                return sName === sub.name || c.subject_code === sub.code;
              }).length;

              return (
                <div
                  key={sub.id}
                  className="rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-xs transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-foreground">{sub.name}</h3>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${track.color}`}>
                            {track.label}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                          {sub.code || 'NO-CODE'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      معتمدة في {adoptionCount} صف
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                    {sub.description || 'مادة دراسية قياسية معتمدة في المناهج الأكاديمية.'}
                  </p>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleDeleteSubject(sub.id, sub.name)}
                      className="text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 p-1 rounded-md transition-colors"
                      title="حذف المادة من البنك"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdoptForm((prev) => ({
                          ...prev,
                          subjectId: sub.id,
                          customSubjectName: '',
                        }));
                        setShowAdoptCurriculum(true);
                      }}
                      className="h-7 px-2.5 text-xs font-bold gap-1 text-emerald-700 border-emerald-600/30 hover:bg-emerald-50"
                    >
                      <Plus className="w-3 h-3" />
                      <span>اعتماد لصف</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG: ADOPT CURRICULUM */}
      <Dialog open={showAdoptCurriculum} onOpenChange={setShowAdoptCurriculum}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-emerald-600" />
              <span>اعتماد مقرر دراسي لصف</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              ربط المادة الدراسية بالصف وتحديد عدد الحصص الأسبوعية المقررة
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdoptCurriculum} className="space-y-4 py-2">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">الصف الدراسي المستهدف *</Label>
              <select
                required
                value={adoptForm.studyGradeId}
                onChange={(e) => setAdoptForm({ ...adoptForm, studyGradeId: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- اختر الصف الدراسي --</option>
                {allGrades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} — ({g.programName})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">المادة الدراسية من البنك</Label>
              <select
                value={adoptForm.subjectId}
                onChange={(e) =>
                  setAdoptForm({
                    ...adoptForm,
                    subjectId: e.target.value,
                    customSubjectName: e.target.value ? '' : adoptForm.customSubjectName,
                  })
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- اختر مادة من البنك --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {!adoptForm.subjectId && (
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">أو اكتب اسم مادة مخصص</Label>
                <Input
                  value={adoptForm.customSubjectName}
                  onChange={(e) => setAdoptForm({ ...adoptForm, customSubjectName: e.target.value })}
                  placeholder="مثال: لغة فرنسية إثرائية"
                  className="text-xs h-9"
                />
              </div>
            )}

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 leading-relaxed text-right space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>اعتماد شمولي على مستوى الصف</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                سيتم اعتماد هذه المادة تلقائياً لجميع شُعب هذا الصف (الحالية والمستقبلية) لتسهيل إسناد المدرسين ورصد الحضور والدرجات.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdoptCurriculum(false)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingAdopt}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submittingAdopt ? 'جاري الحفظ...' : 'اعتماد المقرر'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ADD SUBJECT TO BANK */}
      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span>إضافة مادة دراسية جديدة للبنك</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              تسجيل مادة جديدة لتصبح متاحة للاعتماد في أي صف ومرحلة
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubject} className="space-y-4 py-2">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اسم المادة الدراسية *</Label>
              <Input
                required
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                placeholder="مثال: الرياضيات، الكيمياء، اللغة الإنجليزية"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">الرمز الأكاديمي (اختياري)</Label>
              <Input
                value={subjectForm.code}
                onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                placeholder="مثال: MATH-01, BIO-02"
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">وصف المادة (اختياري)</Label>
              <Input
                value={subjectForm.description}
                onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                placeholder="ملاحظات حول المنهج أو تفاصيل المقرر..."
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddSubject(false)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingSubject}
                className="text-xs font-bold"
              >
                {submittingSubject ? 'جاري الحفظ...' : 'حفظ المادة في البنك'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};
