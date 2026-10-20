import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest, AppAPIError } from '../../api/client';
import {
  EducationalProgram,
  AcademicStructureData,
} from '../../types';
import { ErrorAlert, DataGrid, DataGridColumn, AppModal } from '../common';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';

import {
  Layers,
  GraduationCap,
  School,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  X,
  FolderPlus,
  Users,
  CalendarCheck,
  Award,
  Search,
  LayoutGrid,
  ListFilter,
  UserCheck,
  DoorOpen,
  ArrowUpRight,
} from 'lucide-react';
import { useConfirm, useToast } from '../../context/NotificationContext';

interface AcademicStructureManagementProps {
  onUpdated?: () => void;
}

export const AcademicStructureManagement: React.FC<AcademicStructureManagementProps> = ({
  onUpdated,
}) => {
  const confirm = useConfirm();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [programs, setPrograms] = useState<EducationalProgram[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string>('');
  const [selectedGradeId, setSelectedGradeId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dialogs state
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [programForm, setProgramForm] = useState({
    code: '',
    name: '',
    programType: 'k12',
    description: '',
  });
  const [submittingProgram, setSubmittingProgram] = useState(false);

  const [showAddGrade, setShowAddGrade] = useState(false);
  const [gradeForm, setGradeForm] = useState({
    educationalProgramId: '',
    name: '',
    gradeLevel: 1,
    defaultSectionName: 'شعبة أ',
  });
  const [submittingGrade, setSubmittingGrade] = useState(false);

  const [showAddSection, setShowAddSection] = useState(false);
  const [sectionNamingType, setSectionNamingType] = useState<'preset' | 'custom'>('preset');
  const [sectionForm, setSectionForm] = useState({
    studyGradeId: '',
    gradeName: '',
    name: 'شعبة أ',
    customName: '',
    capacity: 30,
    roomNumber: '',
  });
  const [submittingSection, setSubmittingSection] = useState(false);
  const [initializingDefaults, setInitializingDefaults] = useState(false);

  // Section Workspace Modal State (طلاب، حضور، درجات)
  const [selectedSectionHub, setSelectedSectionHub] = useState<{
    sectionId: string;
    sectionName: string;
    gradeName: string;
    programName: string;
    capacity: number;
    roomNumber?: string;
    activeTab: 'students' | 'attendance' | 'grades';
  } | null>(null);

  // Auto-dismiss notice
  useEffect(() => {
    if (successNotice) {
      const timer = setTimeout(() => setSuccessNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successNotice]);

  // Fetch all structure data
  const fetchStructure = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: AcademicStructureData }>(
        '/api/v1/tenant/admin/academic/structure'
      );
      if (res?.data) {
        const fetchedPrograms = res.data.programs || [];
        setPrograms(fetchedPrograms);

        if (fetchedPrograms.length > 0) {
          setActiveProgramId((prev) => {
            if (prev && fetchedPrograms.some((p) => p.id === prev)) {
              return prev;
            }
            return fetchedPrograms[0].id;
          });
        } else {
          setActiveProgramId('');
        }
      }
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل استرجاع بيانات المراحل والصفوف' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStructure();
  }, []);

  // Reset selected grade filter when switching stage
  useEffect(() => {
    setSelectedGradeId('all');
  }, [activeProgramId]);

  // Quick stats computation
  const stats = useMemo(() => {
    const totalPrograms = programs.length;
    let totalGrades = 0;
    let totalSections = 0;
    let totalCapacity = 0;

    programs.forEach((p) => {
      totalGrades += p.grades?.length || 0;
      p.grades?.forEach((g) => {
        totalSections += g.sections?.length || 0;
        g.sections?.forEach((s) => {
          totalCapacity += Number(s.capacity) || 30;
        });
      });
    });

    return {
      totalPrograms,
      totalGrades,
      totalSections,
      totalCapacity,
    };
  }, [programs]);

  // Active selected program
  const activeProgram = useMemo(() => {
    return programs.find((p) => p.id === activeProgramId) || programs[0] || null;
  }, [programs, activeProgramId]);

  // Active Program Stats
  const activeProgramStats = useMemo(() => {
    if (!activeProgram) return { gradesCount: 0, sectionsCount: 0, capacity: 0 };
    const gradesCount = activeProgram.grades?.length || 0;
    let sectionsCount = 0;
    let capacity = 0;
    activeProgram.grades?.forEach((g) => {
      sectionsCount += g.sections?.length || 0;
      g.sections?.forEach((s) => {
        capacity += Number(s.capacity) || 30;
      });
    });
    return { gradesCount, sectionsCount, capacity };
  }, [activeProgram]);

  // Filtered grades for active program
  const visibleGrades = useMemo(() => {
    if (!activeProgram?.grades) return [];
    let list = activeProgram.grades;

    if (selectedGradeId !== 'all') {
      list = list.filter((g) => g.id === selectedGradeId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((g) => {
        const matchGradeName = g.name.toLowerCase().includes(q);
        const matchSection = g.sections?.some(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.room_number && s.room_number.toLowerCase().includes(q))
        );
        return matchGradeName || matchSection;
      });
    }

    return list;
  }, [activeProgram, selectedGradeId, searchQuery]);

  // Flattened sections for active program (for table view)
  const flattenedSections = useMemo(() => {
    if (!activeProgram?.grades) return [];
    const list: {
      id: string;
      name: string;
      capacity: number;
      roomNumber?: string;
      gradeId: string;
      gradeName: string;
      gradeLevel: number;
    }[] = [];

    visibleGrades.forEach((g) => {
      g.sections?.forEach((s) => {
        list.push({
          id: s.id,
          name: s.name,
          capacity: Number(s.capacity) || 30,
          roomNumber: s.room_number,
          gradeId: g.id,
          gradeName: g.name,
          gradeLevel: g.grade_level,
        });
      });
    });

    return list;
  }, [visibleGrades, activeProgram]);

  // Pagination State for Sections DataGrid
  const [sectionsPage, setSectionsPage] = useState<number>(1);
  const [sectionsPageSize, setSectionsPageSize] = useState<number>(10);

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setSectionsPage(1);
  }, [activeProgramId, selectedGradeId, searchQuery, sectionsPageSize]);

  // Section DataGrid Column Definitions
  const sectionsColumns: DataGridColumn<(typeof flattenedSections)[0]>[] = useMemo(
    () => [
      {
        key: 'index',
        header: '#',
        width: '48px',
        align: 'center',
        render: (_row, _idx, globalIndex) => (
          <span className="font-mono text-muted-foreground font-semibold">{globalIndex}</span>
        ),
      },
      {
        key: 'grade',
        header: 'الصف الدراسي',
        align: 'right',
        render: (sec) => (
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-secondary text-foreground flex items-center justify-center font-bold text-[11px] shrink-0">
              {sec.gradeLevel}
            </span>
            <span className="text-xs font-bold text-foreground">{sec.gradeName}</span>
          </div>
        ),
      },
      {
        key: 'section',
        header: 'الشعبة والقاعة',
        align: 'right',
        render: (sec) => (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              <School className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">{sec.name}</div>
              {sec.roomNumber && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <DoorOpen className="w-3 h-3" />
                  <span>{sec.roomNumber}</span>
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'capacity',
        header: 'السعة المقعدية',
        align: 'center',
        render: (sec) => (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary text-foreground">
            <Users className="w-3 h-3 text-muted-foreground" />
            <span>{sec.capacity} مقعد</span>
          </span>
        ),
      },
      {
        key: 'quickActions',
        header: 'الخدمات السريعة (طلاب • حضور • درجات)',
        align: 'center',
        render: (sec) => (
          <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border/50">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setSelectedSectionHub({
                  sectionId: sec.id,
                  sectionName: sec.name,
                  gradeName: sec.gradeName,
                  programName: activeProgram?.name || '',
                  capacity: sec.capacity,
                  roomNumber: sec.roomNumber,
                  activeTab: 'students',
                })
              }
              className="h-7 px-2 text-[11px] font-bold gap-1 text-primary hover:bg-primary/10"
              title="عرض الطلاب المقيدين"
            >
              <UserCheck className="w-3 h-3" />
              <span>الطلاب</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setSelectedSectionHub({
                  sectionId: sec.id,
                  sectionName: sec.name,
                  gradeName: sec.gradeName,
                  programName: activeProgram?.name || '',
                  capacity: sec.capacity,
                  roomNumber: sec.roomNumber,
                  activeTab: 'attendance',
                })
              }
              className="h-7 px-2 text-[11px] font-bold gap-1 text-emerald-600 hover:bg-emerald-50"
              title="سجل التحضير والغياب"
            >
              <CalendarCheck className="w-3 h-3" />
              <span>الغياب</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setSelectedSectionHub({
                  sectionId: sec.id,
                  sectionName: sec.name,
                  gradeName: sec.gradeName,
                  programName: activeProgram?.name || '',
                  capacity: sec.capacity,
                  roomNumber: sec.roomNumber,
                  activeTab: 'grades',
                })
              }
              className="h-7 px-2 text-[11px] font-bold gap-1 text-amber-600 hover:bg-amber-50"
              title="رصد الدرجات والسلوك"
            >
              <Award className="w-3 h-3" />
              <span>الدرجات</span>
            </Button>
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'إجراءات',
        align: 'center',
        width: '60px',
        render: (sec) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteSection(sec.id)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 mx-auto"
            title="حذف الشعبة"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        ),
      },
    ],
    [activeProgram]
  );

  // Handlers
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programForm.name.trim()) return;

    setSubmittingProgram(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: EducationalProgram }>(
        '/api/v1/tenant/admin/academic/programs',
        {
          method: 'POST',
          body: JSON.stringify({
            code: programForm.code.trim() || undefined,
            name: programForm.name.trim(),
            program_type: programForm.programType,
            description: programForm.description.trim() || undefined,
          }),
        }
      );

      setShowAddProgram(false);
      setProgramForm({ code: '', name: '', programType: 'k12', description: '' });
      setSuccessNotice('تم إضافة المرحلة الجديدة بنجاح');
      await fetchStructure();
      if (res?.data?.id) {
        setActiveProgramId(res.data.id);
      }
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل إضافة المرحلة أو القسم' });
      }
    } finally {
      setSubmittingProgram(false);
    }
  };

  const handleCreateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeForm.name.trim() || !gradeForm.educationalProgramId) return;

    setSubmittingGrade(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/academic/grades', {
        method: 'POST',
        body: JSON.stringify({
          educational_program_id: gradeForm.educationalProgramId,
          name: gradeForm.name.trim(),
          grade_level: Number(gradeForm.gradeLevel) || 1,
          default_section_name: gradeForm.defaultSectionName.trim() || 'شعبة أ',
        }),
      });

      setShowAddGrade(false);
      setGradeForm({
        educationalProgramId: '',
        name: '',
        gradeLevel: 1,
        defaultSectionName: 'شعبة أ',
      });
      setSuccessNotice('تم إضافة الصف الدراسي والشعبة بنجاح');
      await fetchStructure();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل إضافة الصف الدراسي' });
      }
    } finally {
      setSubmittingGrade(false);
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName =
      sectionNamingType === 'preset'
        ? sectionForm.name.trim()
        : sectionForm.customName.trim();

    if (!finalName || !sectionForm.studyGradeId) return;

    setSubmittingSection(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/academic/sections', {
        method: 'POST',
        body: JSON.stringify({
          study_grade_id: sectionForm.studyGradeId,
          name: finalName,
          capacity: Number(sectionForm.capacity) || 30,
          room_number: sectionForm.roomNumber.trim() || undefined,
        }),
      });

      setShowAddSection(false);
      setSectionForm({
        studyGradeId: '',
        gradeName: '',
        name: 'شعبة أ',
        customName: '',
        capacity: 30,
        roomNumber: '',
      });
      setSectionNamingType('preset');
      setSuccessNotice('تم إضافة الشعبة الصفية بنجاح');
      await fetchStructure();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل إضافة الشعبة' });
      }
    } finally {
      setSubmittingSection(false);
    }
  };

  const handleInitializeDefaultStructure = async () => {
    setInitializingDefaults(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/academic/presets/iraqi-standard', {
        method: 'POST',
      });
      setSuccessNotice('تم تهيئة المراحل والصفوف والشُعب بنجاح');
      await fetchStructure();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل تهيئة الهيكل القياسي' });
      }
    } finally {
      setInitializingDefaults(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    const ok = await confirm({
      title: 'حذف الشعبة الدراسية',
      message: 'هل أنت متأكد من حذف هذه الشعبة؟ سيتم إزالة قيد الطلاب وتوزيعهم.',
      confirmText: 'نعم، حذف الشعبة',
      cancelText: 'تراجع',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await apiRequest(`/api/v1/tenant/admin/academic/sections/${sectionId}`, {
        method: 'DELETE',
      });
      toast.success('تم حذف الشعبة بنجاح');
      if (selectedSectionHub?.sectionId === sectionId) {
        setSelectedSectionHub(null);
      }
      await fetchStructure();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        toast.error(err.message, 'فشل حذف الشعبة');
      } else {
        toast.error('فشل حذف الشعبة');
      }
    }
  };

  const handleDeleteGrade = async (gradeId: string, gradeName: string) => {
    const ok = await confirm({
      title: 'حذف الصف الدراسي',
      message: `تحذير: هل أنت متأكد من حذف الصف "${gradeName}"؟ سيتم حذف جميع الشعب والمناهج المرتبطة به.`,
      confirmText: 'نعم، حذف الصف',
      cancelText: 'تراجع',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await apiRequest(`/api/v1/tenant/admin/academic/grades/${gradeId}`, {
        method: 'DELETE',
      });
      toast.success(`تم حذف الصف "${gradeName}" بنجاح`);
      await fetchStructure();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        toast.error(err.message, 'فشل حذف الصف');
      } else {
        toast.error('فشل حذف الصف الدراسي');
      }
    }
  };

  const handleDeleteProgram = async (programId: string, programName: string) => {
    const ok = await confirm({
      title: 'حذف المرحلة التعليمية',
      message: `تحذير هام: هل أنت متأكد من حذف مرحلة "${programName}"؟ سيتم حذف كامل الصفوف والشعب والمناهج التابعة لها.`,
      confirmText: 'نعم، حذف المرحلة',
      cancelText: 'تراجع',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await apiRequest(`/api/v1/tenant/admin/academic/programs/${programId}`, {
        method: 'DELETE',
      });
      toast.success(`تم حذف مرحلة "${programName}" بنجاح`);
      await fetchStructure();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        toast.error(err.message, 'فشل حذف المرحلة');
      } else {
        toast.error('فشل حذف المرحلة التعليمية');
      }
    }
  };

  const openAddSectionModal = (gradeId: string, gradeName: string, existingCount: number) => {
    const letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];
    const nextLetter = letters[existingCount] || `شعبة ${existingCount + 1}`;
    const defaultPreset = existingCount < letters.length ? `شعبة ${nextLetter}` : `شعبة ${existingCount + 1}`;

    setSectionNamingType('preset');
    setSectionForm({
      studyGradeId: gradeId,
      gradeName: gradeName,
      name: defaultPreset,
      customName: '',
      capacity: 30,
      roomNumber: '',
    });
    setShowAddSection(true);
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

      {/* 1. Header with HUD Stats & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">
              إدارة الهيكل التعليمي والشُعب
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              مساحة العمل الميدانية للمراحل والصفوف وغرف الشُعب وقاعاتها
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <Button
            variant="outline"
            size="sm"
            onClick={fetchStructure}
            disabled={loading}
            className="h-9 text-xs font-bold gap-1.5 text-muted-foreground hover:text-foreground"
            title="تحديث البيانات"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </Button>

          <Button
            onClick={() => setShowAddProgram(true)}
            size="sm"
            className="h-9 text-xs font-bold gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مرحلة جديدة</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Level Navigation: STAGES TABS */}
      {loading ? (
        <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
          <p className="text-xs font-semibold text-muted-foreground">جاري استرجاع بيانات الهيكل والشُعب...</p>
        </div>
      ) : programs.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border bg-card text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <School className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-foreground">لم يتم إضافة مراحل أو صفوف دراسية بعد</h3>
            <p className="text-xs text-muted-foreground">
              يمكنك تهيئة الهيكل العراقي القياسي (الابتدائي، المتوسط، الإعدادي العلمي والأدبي) بنقرة واحدة، أو إنشاء مراحل وأقسام مخصصة يدوياً.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              onClick={handleInitializeDefaultStructure}
              disabled={initializingDefaults}
              className="text-xs font-bold gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              <Sparkles className="w-4 h-4" />
              <span>{initializingDefaults ? 'جاري التهيئة...' : 'التهيئة القياسية التلقائية'}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAddProgram(true)}
              className="text-xs font-bold gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مرحلة مخصصة</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* STAGE SELECTION BAR */}
          <div className="p-1.5 rounded-2xl bg-muted/50 border border-border flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              {programs.map((program) => {
                const isSelected = program.id === (activeProgram?.id || '');
                const gradesCount = program.grades?.length || 0;
                let sectionsCount = 0;
                program.grades?.forEach((g) => (sectionsCount += g.sections?.length || 0));

                return (
                  <button
                    key={program.id}
                    onClick={() => setActiveProgramId(program.id)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-background text-foreground shadow-xs border border-border/80'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                  >
                    <Layers className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span>{program.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'bg-muted/80 text-muted-foreground'
                      }`}
                    >
                      {gradesCount} صفوف • {sectionsCount} شعب
                    </span>
                  </button>
                );
              })}
            </div>

            <Button
              onClick={() => setShowAddProgram(true)}
              size="sm"
              variant="ghost"
              className="h-9 px-3 text-xs font-bold gap-1 text-primary hover:bg-primary/10 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مرحلة</span>
            </Button>
          </div>

          {/* ACTIVE STAGE CONTROL HUB */}
          {activeProgram && (
            <div className="space-y-4">
              {/* STAGE SUB-BAR: Grade Selector & Operational Controls */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
                {/* Grades Pills Navigator */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none flex-1">
                  <button
                    onClick={() => setSelectedGradeId('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      selectedGradeId === 'all'
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'bg-secondary/60 text-secondary-foreground hover:bg-secondary'
                    }`}
                  >
                    عرض كل الصفوف ({activeProgram.grades?.length || 0})
                  </button>

                  {activeProgram.grades?.map((grade) => {
                    const isSelected = selectedGradeId === grade.id;
                    const count = grade.sections?.length || 0;
                    return (
                      <button
                        key={grade.id}
                        onClick={() => setSelectedGradeId(grade.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                            : 'bg-background border-border text-foreground hover:border-primary/50'
                        }`}
                      >
                        <span>{grade.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setGradeForm({
                        educationalProgramId: activeProgram.id,
                        name: '',
                        gradeLevel: (activeProgram.grades?.length || 0) + 1,
                        defaultSectionName: 'شعبة أ',
                      });
                      setShowAddGrade(true);
                    }}
                    className="h-8 px-2.5 text-xs font-bold gap-1 border-dashed border-primary/40 text-primary hover:bg-primary/5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صف</span>
                  </Button>
                </div>

                {/* Search & Layout View Switcher */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative w-44 sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="بحث عن صف أو شعبة..."
                      className="h-8 pr-8 text-xs bg-muted/20"
                    />
                  </div>

                  <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40">
                    <button
                      onClick={() => setViewMode('cards')}
                      className={`p-1.5 rounded-md text-xs transition-all ${
                        viewMode === 'cards'
                          ? 'bg-background text-foreground shadow-2xs font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="عرض بطاقات الشُعب الخدمية"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-md text-xs transition-all ${
                        viewMode === 'table'
                          ? 'bg-background text-foreground shadow-2xs font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="عرض جدول الحصر الشامل"
                    >
                      <ListFilter className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. OPERATIONAL WORKSPACE: GRADES & SECTIONS */}
              {visibleGrades.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {searchQuery
                        ? 'لا توجد نتائج مطابقة لبحثك'
                        : 'لا توجد صفوف دراسية مسجلة في هذا العرض'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      أضف الصفوف الدراسية وشُعبها لتفعيل الحضور والغياب ورصد الدرجات
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setGradeForm({
                        educationalProgramId: activeProgram.id,
                        name: '',
                        gradeLevel: (activeProgram.grades?.length || 0) + 1,
                        defaultSectionName: 'شعبة أ',
                      });
                      setShowAddGrade(true);
                    }}
                    className="text-xs font-bold gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صف دراسي جديد</span>
                  </Button>
                </div>
              ) : viewMode === 'table' ? (
                /* TABLE VIEW: REUSABLE DATA GRID */
                <DataGrid<(typeof flattenedSections)[0]>
                  data={flattenedSections}
                  columns={sectionsColumns}
                  keyExtractor={(sec) => sec.id}
                  title={`قائمة شُعب ${activeProgram.name}`}
                  badgeText={`${flattenedSections.length} شُعبة`}
                  headerSubtitle="توزيع القاعات، السعة الطلابية، وروابط الخدمات السريعة"
                  pagination={true}
                  currentPage={sectionsPage}
                  pageSize={sectionsPageSize}
                  onPageChange={setSectionsPage}
                  onPageSizeChange={setSectionsPageSize}
                  emptyTitle="لا توجد شُعب مسجلة في هذا الاختيار"
                  emptyDescription="قم بإضافة أول شعبة دراسية لهذا الصف لبدء تسجيل الطلاب وجدولة الحصص."
                  emptyAction={
                    <Button
                      size="sm"
                      onClick={() => {
                        const firstGrade = visibleGrades[0];
                        if (firstGrade) {
                          openAddSectionModal(firstGrade.id, firstGrade.name, 0);
                        } else {
                          setShowAddGrade(true);
                        }
                      }}
                      className="text-xs font-bold gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة شعبة الآن</span>
                    </Button>
                  }
                />
              ) : (
                /* CARDS VIEW: ACTIONABLE SECTION WORKSPACE CARDS */
                <div className="space-y-6">
                  {visibleGrades.map((grade) => {
                    const sections = grade.sections || [];
                    const totalGradeCap = sections.reduce(
                      (acc, s) => acc + (Number(s.capacity) || 30),
                      0
                    );

                    return (
                      <div key={grade.id} className="space-y-3">
                        {/* Grade Separator Bar */}
                        <div className="flex items-center justify-between border-b border-border/80 pb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-2xs">
                              {grade.grade_level}
                            </div>
                            <div>
                              <h2 className="text-sm font-bold text-foreground inline-block">
                                {grade.name}
                              </h2>
                              <span className="text-[11px] text-muted-foreground mr-2 font-mono">
                                ({sections.length} شُعب • سعة {totalGradeCap} طالب)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAddSectionModal(grade.id, grade.name, sections.length)}
                              className="h-7 px-2.5 text-xs font-bold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إضافة شعبة</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteGrade(grade.id, grade.name)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              title="حذف الصف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Sections Operational Units */}
                        {sections.length === 0 ? (
                          <div className="p-6 text-center rounded-xl border border-dashed border-border bg-muted/10">
                            <p className="text-xs text-muted-foreground mb-2">
                              لا توجد شُعب مسجلة في {grade.name} حتى الآن
                            </p>
                            <Button
                              size="sm"
                              onClick={() => openAddSectionModal(grade.id, grade.name, 0)}
                              className="h-7 text-xs font-bold gap-1 shadow-2xs"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إنشاء أول شعبة للصف</span>
                            </Button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                            {sections.map((sec) => (
                              <div
                                key={sec.id}
                                className="group rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                              >
                                {/* Section Header */}
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        <School className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-bold text-foreground">
                                          {sec.name}
                                        </h3>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                          {grade.name}
                                        </span>
                                      </div>
                                    </div>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteSection(sec.id)}
                                      className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                                      title="حذف الشعبة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>

                                  {/* Info Badges */}
                                  <div className="flex items-center gap-2 mt-3 text-xs">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-[11px] font-semibold">
                                      <Users className="w-3 h-3 text-muted-foreground" />
                                      <span>سعة {sec.capacity || 30} طالب</span>
                                    </span>

                                    {sec.room_number ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-[11px] font-medium">
                                        <DoorOpen className="w-3 h-3 text-muted-foreground" />
                                        <span>{sec.room_number}</span>
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground italic">
                                        بدون قاعة محددة
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Operational Action Hub (الطلاب • الحضور • الدرجات) */}
                                <div className="pt-3 border-t border-border/60">
                                  <div className="text-[10px] font-bold text-muted-foreground mb-1.5 flex items-center justify-between">
                                    <span>الخدمات الميدانية للشعبة:</span>
                                    <span className="text-primary font-medium flex items-center gap-0.5 cursor-pointer">
                                      مركز التحكم <ArrowUpRight className="w-2.5 h-2.5" />
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-3 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedSectionHub({
                                          sectionId: sec.id,
                                          sectionName: sec.name,
                                          gradeName: grade.name,
                                          programName: activeProgram.name,
                                          capacity: Number(sec.capacity) || 30,
                                          roomNumber: sec.room_number,
                                          activeTab: 'students',
                                        })
                                      }
                                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-primary/5 hover:bg-primary/15 text-primary text-[11px] font-bold transition-colors"
                                    >
                                      <UserCheck className="w-3.5 h-3.5 mb-1" />
                                      <span>الطلاب</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedSectionHub({
                                          sectionId: sec.id,
                                          sectionName: sec.name,
                                          gradeName: grade.name,
                                          programName: activeProgram.name,
                                          capacity: Number(sec.capacity) || 30,
                                          roomNumber: sec.room_number,
                                          activeTab: 'attendance',
                                        })
                                      }
                                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition-colors"
                                    >
                                      <CalendarCheck className="w-3.5 h-3.5 mb-1 text-emerald-600" />
                                      <span>الغياب</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedSectionHub({
                                          sectionId: sec.id,
                                          sectionName: sec.name,
                                          gradeName: grade.name,
                                          programName: activeProgram.name,
                                          capacity: Number(sec.capacity) || 30,
                                          roomNumber: sec.room_number,
                                          activeTab: 'grades',
                                        })
                                      }
                                      className="flex flex-col items-center justify-center p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold transition-colors"
                                    >
                                      <Award className="w-3.5 h-3.5 mb-1 text-amber-600" />
                                      <span>الدرجات</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION WORKSPACE COMMAND HUB MODAL (نافذة مركز تحكم الشعبة التنفيذية) */}
      <AppModal
        open={Boolean(selectedSectionHub)}
        onOpenChange={(open) => {
          if (!open) setSelectedSectionHub(null);
        }}
        size="2xl"
        icon={<School className="w-5 h-5" />}
        title={
          selectedSectionHub ? (
            <div className="flex items-center gap-2">
              <span>{selectedSectionHub.sectionName}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                {selectedSectionHub.gradeName}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                • {selectedSectionHub.programName}
              </span>
            </div>
          ) : (
            'مركز تحكم الشعبة'
          )
        }
        description={
          selectedSectionHub ? (
            <span className="flex items-center gap-3">
              <span>السعة القصوى: {selectedSectionHub.capacity} طالب</span>
              {selectedSectionHub.roomNumber && <span>• القاعة: {selectedSectionHub.roomNumber}</span>}
            </span>
          ) : undefined
        }
        footer={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedSectionHub(null)}
            className="text-xs font-bold"
          >
            إغلاق النافذة
          </Button>
        }
      >
        {selectedSectionHub && (
          <div className="space-y-3">

              {/* Internal Workspace Tabs */}
              <Tabs
                defaultValue={selectedSectionHub.activeTab}
                className="w-full mt-3"
              >
                <TabsList className="bg-muted/60 p-1 rounded-xl w-full justify-start">
                  <TabsTrigger value="students" className="text-xs font-bold gap-1.5 flex-1 sm:flex-none">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>قائمة الطلاب المقيدين</span>
                  </TabsTrigger>
                  <TabsTrigger value="attendance" className="text-xs font-bold gap-1.5 flex-1 sm:flex-none">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>سجل الحضور والغياب</span>
                  </TabsTrigger>
                  <TabsTrigger value="grades" className="text-xs font-bold gap-1.5 flex-1 sm:flex-none">
                    <Award className="w-3.5 h-3.5" />
                    <span>دفتر الدرجات والسلوك</span>
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: STUDENTS ROSTER */}
                <TabsContent value="students" className="mt-4 space-y-4">
                  <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        إدارة طلاب {selectedSectionHub.sectionName}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        مساحة الربط المباشر مع سجل الطلاب؛ تتيح إضافة الطلاب لهذه الشعبة وتوزيعهم وعرض بطاقاتهم الشخصية والأكاديمية.
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <Button size="sm" className="text-xs font-bold gap-1 shadow-xs">
                        <Plus className="w-3.5 h-3.5" />
                        <span>تسجيل أو نقل طالب للشعبة</span>
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: ATTENDANCE */}
                <TabsContent value="attendance" className="mt-4 space-y-4">
                  <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                      <CalendarCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        نظام التحضير اليومي والغياب
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        تسجيل حضور وغياب طلاب {selectedSectionHub.sectionName} يومياً أو لكل حصة دراسية مع إشعارات أولياء الأمور التلقائية.
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <Button size="sm" className="text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>فتح سجل حضور اليوم</span>
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 3: GRADES & BEHAVIOR */}
                <TabsContent value="grades" className="mt-4 space-y-4">
                  <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        دفتر الدرجات والتقييم والانضباط السلوكي
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        رصد درجات الامتحانات الشهرية والفصلية لطلاب الشعبة، وتسجيل الملاحظات السلوكية والبطاقات التقديرية.
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <Button size="sm" className="text-xs font-bold gap-1 bg-amber-600 hover:bg-amber-700 text-white shadow-xs">
                        <Award className="w-3.5 h-3.5" />
                        <span>رصد الدرجات للشعبة</span>
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

          </div>
        )}
      </AppModal>

      {/* DIALOG: ADD PROGRAM / STAGE */}
      <AppModal
        open={showAddProgram}
        onOpenChange={setShowAddProgram}
        size="lg"
        icon={<FolderPlus className="w-5 h-5 text-primary" />}
        title="إضافة مرحلة تعليمية أو قسم جديد"
        description="تحديد بيانات المرحلة (ابتدائي، متوسط، إعدادي، أو قسم دورات مخصص)"
        onSubmit={handleCreateProgram}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddProgram(false)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submittingProgram}
              className="text-xs font-bold"
            >
              {submittingProgram ? 'جاري الإضافة...' : 'إضافة المرحلة'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اسم المرحلة أو القسم *</Label>
              <Input
                required
                value={programForm.name}
                onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                placeholder="مثال: المرحلة الإعدادية - الفرع العلمي أو دورات التقوية"
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الرمز التعريفي (اختياري)</Label>
                <Input
                  value={programForm.code}
                  onChange={(e) => setProgramForm({ ...programForm, code: e.target.value.toUpperCase() })}
                  placeholder="مثال: PREP-SCI"
                  className="text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نوع البرنامج الأكاديمي</Label>
                <select
                  value={programForm.programType}
                  onChange={(e) => setProgramForm({ ...programForm, programType: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="k12">تعليم مدرسي عام (K-12)</option>
                  <option value="courses">دورات تدريبية وتقوية</option>
                  <option value="university">جامعي / معهد عالي</option>
                  <option value="custom">مخصص / نشاط حر</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">وصف مختصر (اختياري)</Label>
              <Input
                value={programForm.description}
                onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                placeholder="ملاحظات حول هذه المرحلة أو الفئة العمرية..."
                className="text-xs h-9"
              />
            </div>

        </div>
      </AppModal>

      {/* DIALOG: ADD GRADE */}
      <AppModal
        open={showAddGrade}
        onOpenChange={setShowAddGrade}
        size="lg"
        icon={<GraduationCap className="w-5 h-5 text-primary" />}
        title="إضافة صف دراسي جديد"
        description="ربط الصف بالمرحلة التعليمية وتحديد مستواه والشعبة الابتدائية"
        onSubmit={handleCreateGrade}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddGrade(false)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submittingGrade}
              className="text-xs font-bold"
            >
              {submittingGrade ? 'جاري الإضافة...' : 'حفظ الصف والشعبة'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">المرحلة أو القسم التابع له *</Label>
              <select
                required
                value={gradeForm.educationalProgramId}
                onChange={(e) => setGradeForm({ ...gradeForm, educationalProgramId: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- اختر المرحلة التعليمية --</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.code ? `(${p.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3 text-right">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">اسم الصف أو المستوى *</Label>
                <Input
                  required
                  value={gradeForm.name}
                  onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                  placeholder="مثال: الصف السادس العلمي"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">المستوى (1-12)</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={gradeForm.gradeLevel}
                  onChange={(e) => setGradeForm({ ...gradeForm, gradeLevel: parseInt(e.target.value) || 1 })}
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2 text-right">
              <Label className="text-xs font-semibold">اسم الشعبة الأولى التلقائية</Label>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {['شعبة أ', 'شعبة ب', 'شعبة ج', 'قاعة 1'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGradeForm({ ...gradeForm, defaultSectionName: preset })}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                      gradeForm.defaultSectionName === preset
                        ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                        : 'bg-muted/40 hover:bg-muted text-foreground border-border'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <Input
                value={gradeForm.defaultSectionName}
                onChange={(e) => setGradeForm({ ...gradeForm, defaultSectionName: e.target.value })}
                placeholder="أو اكتب اسماً مخصصاً للشعبة الأولى..."
                className="text-xs h-9"
              />
            </div>

        </div>
      </AppModal>

      {/* DIALOG: ADD SECTION */}
      <AppModal
        open={showAddSection}
        onOpenChange={setShowAddSection}
        size="md"
        icon={<School className="w-5 h-5 text-primary" />}
        title="إضافة شُعبة أو قاعة دراسية جديدة"
        description={`إضافة شعبة تابعة لصف ${sectionForm.gradeName} مع تحديد سعتها الاستيعابية`}
        onSubmit={handleCreateSection}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddSection(false)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                submittingSection ||
                (sectionNamingType === 'preset' ? !sectionForm.name.trim() : !sectionForm.customName.trim())
              }
              className="text-xs font-bold"
            >
              {submittingSection ? 'جاري الحفظ...' : 'حفظ الشعبة'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
            <div className="space-y-2 text-right">
              <Label className="text-xs font-semibold">تسمية الشعبة *</Label>
              <div className="flex items-center gap-2 pb-1">
                <Button
                  type="button"
                  size="sm"
                  variant={sectionNamingType === 'preset' ? 'default' : 'outline'}
                  onClick={() => setSectionNamingType('preset')}
                  className="text-xs h-7 px-3 font-semibold"
                >
                  حروف قياسية (أ، ب، ج...)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sectionNamingType === 'custom' ? 'default' : 'outline'}
                  onClick={() => setSectionNamingType('custom')}
                  className="text-xs h-7 px-3 font-semibold"
                >
                  اسم أو قاعة مخصصة
                </Button>
              </div>

              {sectionNamingType === 'preset' ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {['شعبة أ', 'شعبة ب', 'شعبة ج', 'شعبة د', 'شعبة هـ', 'شعبة و'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSectionForm({ ...sectionForm, name: p })}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                          sectionForm.name === p
                            ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                            : 'bg-muted/40 hover:bg-muted text-foreground border-border'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={sectionForm.name}
                    onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              ) : (
                <Input
                  value={sectionForm.customName}
                  onChange={(e) => setSectionForm({ ...sectionForm, customName: e.target.value })}
                  placeholder="مثال: القاعة الكبرى، مختبر الحاسوب 1..."
                  className="text-xs h-9"
                  required={sectionNamingType === 'custom'}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">السعة الاستيعابية (طلاب)</Label>
                <Input
                  type="number"
                  min="5"
                  max="200"
                  value={sectionForm.capacity}
                  onChange={(e) =>
                    setSectionForm({ ...sectionForm, capacity: parseInt(e.target.value) || 30 })
                  }
                  className="text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رقم أو مكان القاعة</Label>
                <Input
                  value={sectionForm.roomNumber}
                  onChange={(e) => setSectionForm({ ...sectionForm, roomNumber: e.target.value })}
                  placeholder="مثال: قاعة 102، الطابق 1"
                  className="text-xs h-9"
                />
              </div>
            </div>

        </div>
      </AppModal>

    </div>
  );
};
