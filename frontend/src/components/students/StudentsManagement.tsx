import React, { useState, useMemo, useEffect } from 'react';
import { apiRequest, AppAPIError } from '../../api/client';
import { StudentProfile, EducationalProgram, StudyGrade, ClassSection, GuardianProfileDTO } from '../../types';
import { ErrorAlert, DataGrid, DataGridColumn, AppModal } from '../common';
import { CreateStudentPage } from './CreateStudentPage';
import {
  Button,
  Input,
  Label,
  Badge,
  Avatar,
  AvatarFallback,
} from '@/components/ui';

import {
  Users,
  UserPlus,
  Search,
  X,
  RotateCcw,
  Eye,
  CheckCircle2,
  Phone,
  Copy,
  HeartHandshake,
  School,
  Link as LinkIcon,
  MapPin,
  FileText,
  ShieldCheck,
  HeartPulse,
  Image as ImageIcon,
  Pencil,
} from 'lucide-react';

interface StudentsManagementProps {
  onStudentsUpdated?: () => void;
  onNavigateToGuardians?: () => void;
}

export const StudentsManagement: React.FC<StudentsManagementProps> = ({
  onStudentsUpdated,
  onNavigateToGuardians,
}) => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [guardians, setGuardians] = useState<GuardianProfileDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Document/Photo Lightbox Preview
  const [previewDocModal, setPreviewDocModal] = useState<{ url: string; title: string } | null>(null);

  // Academic structure references for assignment
  const [programs, setPrograms] = useState<EducationalProgram[]>([]);
  const [grades, setGrades] = useState<StudyGrade[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected student for detail/relationship sheet
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);

  // Student being edited in CreateStudentPage
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);

  // View mode: 'list' (DataGrid) | 'create' (Full-page Iraqi student registration / edit)
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // Link Guardian Modal
  const [showLinkGuardianModal, setShowLinkGuardianModal] = useState(false);
  const [linkingStudent, setLinkingStudent] = useState<StudentProfile | null>(null);
  const [selectedGuardianPersonId, setSelectedGuardianPersonId] = useState<string>('');
  const [linkRelationshipType, setLinkRelationshipType] = useState<string>('father');
  const [linkingSubmitting, setLinkingSubmitting] = useState(false);
  const [linkModalSearchQuery, setLinkModalSearchQuery] = useState('');



  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Copy code utility
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setSuccessNotice(`تم نسخ كود الدخول الخاص بـ ${label}: ${text}`);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  // Fetch students
  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: StudentProfile[] }>(
        '/api/v1/tenant/admin/students'
      );
      if (res?.data) {
        setStudents(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل استرجاع سجلات الطلاب' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch guardians list for linking
  const fetchGuardians = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: GuardianProfileDTO[] }>(
        '/api/v1/tenant/admin/guardians'
      );
      if (res?.data) {
        setGuardians(res.data);
      }
    } catch {
      // Graceful fallback
    }
  };

  // Fetch academic structure for stage/grade/section assignment
  const fetchStructure = async () => {
    try {
      const res = await apiRequest<{
        success: boolean;
        data: {
          programs: EducationalProgram[];
        };
      }>('/api/v1/tenant/admin/academic/structure');
      if (res?.data?.programs) {
        setPrograms(res.data.programs);
        const allGrades: StudyGrade[] = [];
        const allSections: ClassSection[] = [];
        res.data.programs.forEach((p) => {
          if (p.grades) {
            p.grades.forEach((g) => {
              allGrades.push(g);
              if (g.sections) {
                allSections.push(...g.sections);
              }
            });
          }
        });
        setGrades(allGrades);
        setSections(allSections);
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchGuardians();
    fetchStructure();
  }, []);


  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const fullName = s.person
        ? `${s.person.first_name} ${s.person.father_name || ''} ${s.person.last_name}`
        : '';
      const num = s.student_number || '';
      const code = s.access_code || '';
      const phone = s.phone || '';

      const generalReg = s.general_register_number || '';
      const mother = s.person?.mother_name || '';
      const gov = s.person?.governorate || '';
      const neighborhood = s.person?.neighborhood || '';

      const matchSearch =
        !searchQuery ||
        fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        num.toLowerCase().includes(searchQuery.toLowerCase()) ||
        generalReg.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mother.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gov.toLowerCase().includes(searchQuery.toLowerCase()) ||
        neighborhood.toLowerCase().includes(searchQuery.toLowerCase()) ||
        code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        phone.includes(searchQuery);

      const matchGrade = gradeFilter === 'all' || s.grade_name === gradeFilter;
      const matchStage = stageFilter === 'all' || s.program_name === stageFilter;
      const matchStatus = statusFilter === 'all' || s.enrollment_status === statusFilter;

      return matchSearch && matchGrade && matchStage && matchStatus;
    });
  }, [students, searchQuery, gradeFilter, stageFilter, statusFilter]);

  // Unique lists for dropdowns
  const uniquePrograms = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.program_name) set.add(s.program_name);
    });
    return Array.from(set);
  }, [students]);

  const uniqueGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.grade_name) set.add(s.grade_name);
    });
    return Array.from(set);
  }, [students]);

  // Stats
  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter(
      (s) => s.enrollment_status === 'active' || s.enrollment_status === 'registered'
    ).length;
    const withGuardians = students.filter((s) => s.guardians_info && s.guardians_info.length > 0)
      .length;
    const withSection = students.filter((s) => s.section_name).length;
    return { total, active, withGuardians, withSection };
  }, [students]);


  // Filtered Guardians for Link Guardian Modal
  const searchMatchingLinkModal = useMemo(() => {
    if (!linkModalSearchQuery.trim()) return guardians.slice(0, 10);
    const q = linkModalSearchQuery.toLowerCase();
    return guardians.filter(
      (g) =>
        g.full_name?.toLowerCase().includes(q) ||
        g.phone?.includes(q) ||
        g.access_code?.toLowerCase().includes(q)
    );
  }, [guardians, linkModalSearchQuery]);



  // Link Guardian handler
  const handleLinkGuardianSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingStudent || !selectedGuardianPersonId) return;

    setLinkingSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/guardians/link-student', {
        method: 'POST',
        body: JSON.stringify({
          guardian_person_id: selectedGuardianPersonId,
          student_profile_id: linkingStudent.id,
          relationship_type: linkRelationshipType,
        }),
      });

      setSuccessNotice('تم ربط ولي الأمر بالطالب بنجاح');
      setShowLinkGuardianModal(false);
      setLinkingStudent(null);
      await fetchStudents();
      await fetchGuardians();
      if (onStudentsUpdated) onStudentsUpdated();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل ربط ولي الأمر بالطالب' });
      }
    } finally {
      setLinkingSubmitting(false);
    }
  };

  // DataGrid Columns Definition
  const studentColumns: DataGridColumn<StudentProfile>[] = [
    {
      key: 'student',
      header: 'اسم الطالب والرقم الدراسي',
      render: (s) => {
        const p = s.person;
        const name = p ? `${p.first_name} ${p.father_name || ''} ${p.last_name}` : 'طالب مسجل';
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-1 ring-primary/20 bg-primary/10 text-primary shrink-0 overflow-hidden">
              {s.photo_url || p?.avatar_url ? (
                <img
                  src={s.photo_url || p?.avatar_url}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <AvatarFallback className="font-bold text-xs">
                  {p?.first_name?.charAt(0) || 'ط'}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0">
              <div className="font-bold text-xs text-foreground truncate flex items-center gap-1.5">
                <span>{name}</span>
                {p?.gender === 'female' ? (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-pink-300 text-pink-700 bg-pink-50">
                    أنثى
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-blue-300 text-blue-700 bg-blue-50">
                    ذكر
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5 font-mono">
                <span>{s.student_number}</span>
                {s.general_register_number && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded border border-amber-300/40 font-sans font-medium">
                    سجل: {s.general_register_number}
                  </span>
                )}
                {s.phone && (
                  <span className="flex items-center gap-0.5 text-muted-foreground">
                    • <Phone className="w-3 h-3" /> {s.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'access_code',
      header: 'كود الدخول (تطبيق الطالب)',
      render: (s) => {
        const code = s.access_code || '---';
        const isCopied = copiedCode === code;
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-black text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 tracking-wider">
              {code}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(code, 'الطالب');
              }}
              title="نسخ كود الطالب"
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              {isCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        );
      },
    },
    {
      key: 'academic_placement',
      header: 'المرحلة والصف والشعبة',
      render: (s) => (
        <div>
          {s.grade_name ? (
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-1">
                <span>{s.grade_name}</span>
                {s.section_name && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0 h-4 font-bold">
                    {s.section_name}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">
                {s.program_name || 'التعليم العام'}
              </span>
            </div>
          ) : (
            <Badge variant="outline" className="text-[11px] text-amber-700 bg-amber-50 border-amber-300">
              غير مسكّن في شعبة
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'guardians',
      header: 'ولي الأمر المرتبط',
      render: (s) => {
        const gList = s.guardians_info || [];
        if (gList.length === 0) {
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLinkingStudent(s);
                setSelectedGuardianPersonId('');
                setShowLinkGuardianModal(true);
              }}
              className="h-7 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 gap-1 px-2"
            >
              <LinkIcon className="w-3 h-3" />
              <span>ربط بولي أمر</span>
            </Button>
          );
        }
        return (
          <div className="space-y-1">
            {gList.map((g) => (
              <div key={g.id} className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">{g.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">({g.access_code})</span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (s) => {
        const st = s.enrollment_status;
        return (
          <Badge
            variant="secondary"
            className={
              st === 'active' || st === 'registered'
                ? 'bg-emerald-100 text-emerald-800 text-[11px] font-bold'
                : st === 'withdrawn'
                ? 'bg-destructive/10 text-destructive text-[11px] font-bold'
                : 'bg-muted text-muted-foreground text-[11px]'
            }
          >
            {st === 'active' || st === 'registered' ? 'مقيد ونشط' : st === 'withdrawn' ? 'منسحب' : st}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'left',
      render: (s) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingStudent(s);
              setViewMode('create');
            }}
            className="h-8 text-xs font-bold gap-1 text-amber-700 hover:bg-amber-50 border-amber-300"
            title="تعديل بيانات وسجل الطالب"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>تعديل</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedStudent(s)}
            className="h-8 text-xs font-bold gap-1 text-primary hover:bg-primary/10 border-primary/20"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>ملف الطالب</span>
          </Button>
        </div>
      ),
    },
  ];

  if (viewMode === 'create') {
    return (
      <CreateStudentPage
        mode={editingStudent ? 'edit' : 'create'}
        studentToEdit={editingStudent}
        onBack={() => {
          setEditingStudent(null);
          setViewMode('list');
        }}
        onSuccess={() => {
          const wasEdit = Boolean(editingStudent);
          setEditingStudent(null);
          setViewMode('list');
          setSuccessNotice(
            wasEdit
              ? 'تم تحديث بيانات وسجل الطالب بنجاح'
              : 'تم تسجيل الطالب وتوليد كود الدخول وتسكينه بنجاح'
          );
          fetchStudents();
          fetchGuardians();
          if (onStudentsUpdated) onStudentsUpdated();
        }}
        onNavigateToGuardians={onNavigateToGuardians}
        programs={programs}
        grades={grades}
        sections={sections}
        guardians={guardians}
        onRefreshData={() => {
          fetchStudents();
          fetchGuardians();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header (ترويسة صفحة الطلاب المخصصة) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">
              إدارة شؤون الطلاب
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              الأساس الأكاديمي: تسجيل الطلاب، التسكين بالشعب، وأكواد الدخول لتطبيق الطالب
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToGuardians && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToGuardians}
              className="h-9 text-xs font-bold gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <HeartHandshake className="w-4 h-4" />
              <span>إدارة أولياء الأمور ({guardians.length})</span>
            </Button>
          )}

          <Button
            onClick={() => {
              setEditingStudent(null);
              setViewMode('create');
            }}
            size="sm"
            className="h-9 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>تسجيل طالب جديد</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStudents();
              fetchGuardians();
            }}
            disabled={loading}
            className="h-9 text-xs font-bold gap-1.5 text-muted-foreground hover:text-foreground"
            title="تحديث البيانات"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </Button>
        </div>
      </div>

      {error && (
        <ErrorAlert
          message={error.message}
          requestId={error.requestId}
          onDismiss={() => setError(null)}
        />
      )}

      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 flex items-center justify-between gap-3 text-xs font-semibold shadow-xs">
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

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">إجمالي الطلاب</span>
            <span className="text-xl font-black text-foreground mt-0.5 block">{stats.total}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">مقيدون ونشطون</span>
            <span className="text-xl font-black text-emerald-600 mt-0.5 block">{stats.active}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">مسكّنون في شُعب</span>
            <span className="text-xl font-black text-purple-600 mt-0.5 block">{stats.withSection}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <School className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">مربوطون بأولياء أمور</span>
            <span className="text-xl font-black text-blue-600 mt-0.5 block">{stats.withGuardians}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <HeartHandshake className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث بالاسم، الرقم الدراسي، أو كود الطالب..."
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

          <div className="flex flex-wrap items-center gap-2">
            {uniquePrograms.length > 0 && (
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">كل المراحل</option>
                {uniquePrograms.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            {uniqueGrades.length > 0 && (
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">كل الصفوف</option>
                {uniqueGrades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط / مقيد</option>
              <option value="withdrawn">منسحب</option>
            </select>

            {(searchQuery || stageFilter !== 'all' || gradeFilter !== 'all' || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStageFilter('all');
                  setGradeFilter('all');
                  setStatusFilter('all');
                }}
                className="h-9 text-xs font-bold text-destructive hover:bg-destructive/10 gap-1 px-2.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>مسح</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
          <span>
            إجمالي النتائج: <strong className="text-foreground">{filteredStudents.length}</strong> طالب
          </span>
          <span className="font-semibold text-primary">بيانات معهدك الحصري</span>
        </div>
      </div>

      {/* 4. Unified DataGrid for Students */}
      <DataGrid<StudentProfile>
        data={filteredStudents}
        columns={studentColumns}
        keyExtractor={(student) => student.id}
        loading={loading && students.length === 0}
        loadingMessage="جاري تحميل سجلات الطلاب..."
        title="سجل طلاب المعهد"
        badgeText={`${filteredStudents.length} طالب`}
        emptyTitle="لم يتم العثور على طلاب"
        emptyDescription="لم يتم تسجيل طلاب يطابقون خيارات البحث الحالية بالمعهد"
      />

      {/* 5. Student Details Modal */}
      <AppModal
        open={Boolean(selectedStudent)}
        onOpenChange={(open) => !open && setSelectedStudent(null)}
        size="xl"
        icon={<School className="w-5 h-5" />}
        title={
          selectedStudent
            ? `${selectedStudent.person?.first_name} ${selectedStudent.person?.father_name || ''} ${selectedStudent.person?.last_name}`
            : 'تفاصيل ملف الطالب'
        }
        description={
          selectedStudent ? `الرقم الدراسي: ${selectedStudent.student_number}` : undefined
        }
        badge={
          selectedStudent ? (
            <Badge
              variant="secondary"
              className={
                selectedStudent.enrollment_status === 'active' ||
                selectedStudent.enrollment_status === 'registered'
                  ? 'bg-emerald-100 text-emerald-800 text-xs font-bold'
                  : 'bg-muted text-muted-foreground text-xs font-bold'
              }
            >
              {selectedStudent.enrollment_status === 'active' ||
              selectedStudent.enrollment_status === 'registered'
                ? 'مقيد ونشط'
                : selectedStudent.enrollment_status}
            </Badge>
          ) : undefined
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedStudent(null)}
              className="text-xs font-bold"
            >
              إغلاق
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const s = selectedStudent;
                setSelectedStudent(null);
                setEditingStudent(s);
                setViewMode('create');
              }}
              className="text-xs font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>تعديل بيانات الطالب</span>
            </Button>
          </div>
        }
      >
        {selectedStudent && (
          <div className="space-y-4 py-2 text-xs">
            {/* Student Photo & Identity Overview */}
            <div className="p-3.5 rounded-xl border border-border bg-gradient-to-r from-card via-card to-primary/[0.03] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 rounded-2xl ring-2 ring-primary/20 bg-primary/10 text-primary shrink-0 overflow-hidden shadow-xs">
                  {selectedStudent.photo_url || selectedStudent.person?.avatar_url ? (
                    <img
                      src={selectedStudent.photo_url || selectedStudent.person?.avatar_url}
                      alt="صورة الطالب"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() =>
                        setPreviewDocModal({
                          url: (selectedStudent.photo_url || selectedStudent.person?.avatar_url)!,
                          title: 'الصورة الشخصية للطالب',
                        })
                      }
                    />
                  ) : (
                    <AvatarFallback className="font-bold text-base">
                      {selectedStudent.person?.first_name?.charAt(0) || 'ط'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <div className="font-bold text-sm text-foreground flex items-center gap-2">
                    <span>
                      {selectedStudent.person?.first_name} {selectedStudent.person?.father_name || ''} {selectedStudent.person?.last_name}
                    </span>
                    {selectedStudent.person?.gender === 'female' ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-pink-300 text-pink-700 bg-pink-50">
                        أنثى
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-300 text-blue-700 bg-blue-50">
                        ذكر
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 font-mono">
                    <span>{selectedStudent.student_number}</span>
                    <span>•</span>
                    <span className="font-sans">{selectedStudent.grade_name || 'غير مسكن'}</span>
                    {selectedStudent.section_name && (
                      <span className="font-sans text-purple-700 font-bold">({selectedStudent.section_name})</span>
                    )}
                  </div>
                </div>
              </div>
              {(selectedStudent.photo_url || selectedStudent.person?.avatar_url) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreviewDocModal({
                      url: (selectedStudent.photo_url || selectedStudent.person?.avatar_url)!,
                      title: 'الصورة الشخصية للطالب',
                    })
                  }
                  className="h-7 text-xs gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>معاينة الصورة</span>
                </Button>
              )}
            </div>

            {/* Quick Access Bar: Student Number, General Paper Register & Access Code */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground block">الرقم الدراسي المعتمد:</span>
                  <span className="font-mono font-bold text-foreground text-xs">{selectedStudent.student_number}</span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">كود النظام</Badge>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 block font-semibold">رقم السجل العام (الورقي):</span>
                  <span className="font-mono font-black text-amber-900 dark:text-amber-200 text-xs">
                    {selectedStudent.general_register_number || 'غير مدون'}
                  </span>
                </div>
                <FileText className="w-4 h-4 text-amber-600 shrink-0" />
              </div>

              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-primary block font-semibold">كود تطبيق الطالب:</span>
                  <span className="font-mono font-black text-primary text-xs tracking-wider">
                    {selectedStudent.access_code || '---'}
                  </span>
                </div>
                {selectedStudent.access_code && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedStudent.access_code!, 'الطالب')}
                    className="h-7 px-2 text-[11px] font-bold gap-1 text-primary hover:bg-primary/10"
                  >
                    <Copy className="w-3 h-3" />
                    <span>نسخ</span>
                  </Button>
                )}
              </div>
            </div>

            {/* 1. النسب والبيانات الشخصية العراقية */}
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
              <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <Users className="w-4 h-4 text-primary" />
                النسب والبيانات الشخصية
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">اسم الأم:</span>
                  <span className="font-bold text-foreground">
                    {selectedStudent.person?.mother_name || 'غير محدد'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">والد الأم (جد الأم):</span>
                  <span className="font-bold text-foreground">
                    {selectedStudent.person?.mother_father_name || 'غير محدد'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">تاريخ ومحل الولادة:</span>
                  <span className="font-medium text-foreground">
                    {selectedStudent.person?.date_of_birth || '--'} ({selectedStudent.person?.place_of_birth || 'غير محدد'})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">فصيلة الدم:</span>
                  <Badge variant="outline" className="font-mono text-xs border-red-300 text-red-700 bg-red-50/50">
                    {selectedStudent.person?.blood_type || 'غير محدد'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 2. بطاقة السكن والعنوان في العراق */}
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
              <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <MapPin className="w-4 h-4 text-primary" />
                بطاقة السكن وعنوان الإقامة (العراق)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                <div>
                  <span className="text-muted-foreground block text-[10px]">المحافظة:</span>
                  <span className="font-bold text-foreground">{selectedStudent.person?.governorate || 'بغداد'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">القضاء / المدينة:</span>
                  <span className="font-bold text-foreground">{selectedStudent.person?.city_district || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">الحي / المنطقة:</span>
                  <span className="font-bold text-foreground">{selectedStudent.person?.neighborhood || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">الزقاق:</span>
                  <span className="font-mono text-foreground">{selectedStudent.person?.street_alley || '--'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">الدار:</span>
                  <span className="font-mono text-foreground">{selectedStudent.person?.house_number || '--'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">أقرب نقطة دالة:</span>
                  <span className="text-foreground truncate block">{selectedStudent.person?.nearest_landmark || '--'}</span>
                </div>
              </div>
            </div>

            {/* 3. المستمسكات الرسمية والتعليم السابق */}
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
              <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-primary" />
                المستمسكات الثبوتية وسجل النقل
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">نوع المستمسك:</span>
                  <span className="font-semibold text-foreground">
                    {selectedStudent.identity_doc_type === 'national_id' ? 'بطاقة وطنية موحدة' : 'هوية أحوال مدنية'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">رقم الهوية / البطاقة:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedStudent.person?.national_id_number || 'غير مدون'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">السجل والصحيفة المدنية:</span>
                  <span className="font-mono text-foreground">
                    {selectedStudent.civil_volume ? `سجل ${selectedStudent.civil_volume}` : '--'} / {selectedStudent.civil_page ? `صحيفة ${selectedStudent.civil_page}` : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">المدرسة السابقة ووثيقة التخرج:</span>
                  <span className="text-foreground">
                    {selectedStudent.previous_school || '---'} {selectedStudent.graduation_doc_number ? `(وثيقة: ${selectedStudent.graduation_doc_number})` : ''}
                  </span>
                </div>
              </div>

              {/* Uploaded Identity Documents (هوية الأحوال / البطاقة الوطنية وجهين للطالب ولولي الأمر) */}
              <div className="pt-3 border-t border-border/70 space-y-2">
                <span className="text-[11px] font-bold text-foreground block">
                  المستمسكات الثبوتية المرفوعة (البطاقة الوطنية / هوية الأحوال):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* 1. Student ID Front */}
                  <div className="p-2 rounded-lg border border-border bg-secondary/10 space-y-1.5 text-center">
                    <span className="text-[10px] font-bold text-foreground block truncate">هوية الطالب (أمامي)</span>
                    {selectedStudent.id_card_front_url ? (
                      <div
                        onClick={() =>
                          setPreviewDocModal({
                            url: selectedStudent.id_card_front_url!,
                            title: 'هوية الطالب - الوجه الأمامي',
                          })
                        }
                        className="group relative h-20 rounded-md overflow-hidden border border-border cursor-pointer hover:border-primary transition-all shadow-2xs"
                      >
                        <img
                          src={selectedStudent.id_card_front_url}
                          alt="هوية الطالب وجه أمامي"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] gap-1 font-bold">
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 rounded-md border border-dashed border-border/80 flex items-center justify-center text-[10px] text-muted-foreground">
                        غير مرفوع
                      </div>
                    )}
                  </div>

                  {/* 2. Student ID Back */}
                  <div className="p-2 rounded-lg border border-border bg-secondary/10 space-y-1.5 text-center">
                    <span className="text-[10px] font-bold text-foreground block truncate">هوية الطالب (خلفي)</span>
                    {selectedStudent.id_card_back_url ? (
                      <div
                        onClick={() =>
                          setPreviewDocModal({
                            url: selectedStudent.id_card_back_url!,
                            title: 'هوية الطالب - الوجه الخلفي',
                          })
                        }
                        className="group relative h-20 rounded-md overflow-hidden border border-border cursor-pointer hover:border-primary transition-all shadow-2xs"
                      >
                        <img
                          src={selectedStudent.id_card_back_url}
                          alt="هوية الطالب وجه خلفي"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] gap-1 font-bold">
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 rounded-md border border-dashed border-border/80 flex items-center justify-center text-[10px] text-muted-foreground">
                        غير مرفوع
                      </div>
                    )}
                  </div>

                  {/* 3. Guardian ID Front */}
                  <div className="p-2 rounded-lg border border-border bg-secondary/10 space-y-1.5 text-center">
                    <span className="text-[10px] font-bold text-foreground block truncate">هوية الولي (أمامي)</span>
                    {selectedStudent.guardian_id_front_url ? (
                      <div
                        onClick={() =>
                          setPreviewDocModal({
                            url: selectedStudent.guardian_id_front_url!,
                            title: 'هوية ولي الأمر - الوجه الأمامي',
                          })
                        }
                        className="group relative h-20 rounded-md overflow-hidden border border-border cursor-pointer hover:border-emerald-600 transition-all shadow-2xs"
                      >
                        <img
                          src={selectedStudent.guardian_id_front_url}
                          alt="هوية ولي الأمر وجه أمامي"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] gap-1 font-bold">
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 rounded-md border border-dashed border-border/80 flex items-center justify-center text-[10px] text-muted-foreground">
                        غير مرفوع
                      </div>
                    )}
                  </div>

                  {/* 4. Guardian ID Back */}
                  <div className="p-2 rounded-lg border border-border bg-secondary/10 space-y-1.5 text-center">
                    <span className="text-[10px] font-bold text-foreground block truncate">هوية الولي (خلفي)</span>
                    {selectedStudent.guardian_id_back_url ? (
                      <div
                        onClick={() =>
                          setPreviewDocModal({
                            url: selectedStudent.guardian_id_back_url!,
                            title: 'هوية ولي الأمر - الوجه الخلفي',
                          })
                        }
                        className="group relative h-20 rounded-md overflow-hidden border border-border cursor-pointer hover:border-emerald-600 transition-all shadow-2xs"
                      >
                        <img
                          src={selectedStudent.guardian_id_back_url}
                          alt="هوية ولي الأمر وجه خلفي"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] gap-1 font-bold">
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 rounded-md border border-dashed border-border/80 flex items-center justify-center text-[10px] text-muted-foreground">
                        غير مرفوع
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Placement & Academic Info */}
            <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-2">
              <span className="font-bold text-foreground block">التسكين الأكاديمي الحالي</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">المرحلة التعليمية:</span>
                  <span className="font-bold text-foreground">{selectedStudent.program_name || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">الصف الدراسي:</span>
                  <span className="font-bold text-foreground">{selectedStudent.grade_name || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">الشعبة الدراسية:</span>
                  <span className="font-bold text-purple-700">{selectedStudent.section_name || 'غير محدد'}</span>
                </div>
              </div>
            </div>

            {/* 5. Health & Emergency */}
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
              <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <HeartPulse className="w-4 h-4 text-rose-600" />
                الحالة الصحية ومعلومات الطوارئ
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">الحالة الصحية:</span>
                  <span className="font-bold text-foreground">{selectedStudent.health_status || 'سليم معافى'}</span>
                  {selectedStudent.medical_notes && (
                    <span className="text-[11px] text-muted-foreground block mt-0.5">{selectedStudent.medical_notes}</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">جهة اتصال الطوارئ:</span>
                  <span className="font-bold text-foreground">{selectedStudent.emergency_contact_name || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">هاتف الطوارئ:</span>
                  <span className="font-mono text-foreground">{selectedStudent.emergency_contact_phone || 'غير محدد'}</span>
                </div>
              </div>
            </div>

            {/* 6. Guardians Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground block">أولياء الأمور المرتبطون</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLinkingStudent(selectedStudent);
                    setSelectedGuardianPersonId('');
                    setShowLinkGuardianModal(true);
                  }}
                  className="h-7 text-xs font-bold gap-1 text-primary hover:bg-primary/10"
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>ربط بولي أمر جديد</span>
                </Button>
              </div>

              {selectedStudent.guardians_info && selectedStudent.guardians_info.length > 0 ? (
                <div className="space-y-2">
                  {selectedStudent.guardians_info.map((g) => (
                    <div
                      key={g.id}
                      className="p-3 rounded-xl border border-border bg-card flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-foreground">{g.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {g.relationship_type === 'father'
                              ? 'الأب'
                              : g.relationship_type === 'mother'
                              ? 'الأم'
                              : 'ولي أمر'}
                          </Badge>
                        </div>
                        {g.phone && (
                          <span className="text-muted-foreground font-mono text-[11px] block mt-0.5">
                            الهاتف: {g.phone}
                          </span>
                        )}
                      </div>
                      <div className="text-left font-mono">
                        <span className="text-[10px] text-muted-foreground block">كود تطبيق الولي:</span>
                        <span className="font-bold text-emerald-700 text-xs">{g.access_code}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">لم يتم ربط ولي أمر بهذا الطالب بعد.</p>
              )}
            </div>
          </div>
        )}
      </AppModal>


      {/* 7. Link Guardian Dialog */}
      <AppModal
        open={showLinkGuardianModal}
        onOpenChange={setShowLinkGuardianModal}
        size="md"
        icon={<LinkIcon className="w-5 h-5" />}
        title="ربط ولي أمر بالطالب"
        description={
          linkingStudent
            ? `ربط الطالب: ${linkingStudent.person?.first_name} ${linkingStudent.person?.last_name} بولي أمر معتمد`
            : undefined
        }
        onSubmit={handleLinkGuardianSubmit}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowLinkGuardianModal(false)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={linkingSubmitting || !selectedGuardianPersonId}
              className="text-xs font-bold"
            >
              {linkingSubmitting ? 'جاري الربط...' : 'تأكيد الربط'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
            <div className="space-y-2 text-right">
              <Label className="text-xs font-semibold">ابحث واختر ولي الأمر *</Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  value={linkModalSearchQuery}
                  onChange={(e) => setLinkModalSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، رقم الهاتف، أو كود GRD..."
                  className="pr-8 pl-8 text-xs h-8"
                />
                {linkModalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLinkModalSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1 border border-border rounded-lg p-1.5 bg-background">
                {searchMatchingLinkModal.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    لا يوجد ولي أمر يطابق بحثك
                  </div>
                ) : (
                  searchMatchingLinkModal.map((g) => {
                    const isSelected = selectedGuardianPersonId === g.person_id;
                    return (
                      <div
                        key={g.person_id}
                        onClick={() => setSelectedGuardianPersonId(g.person_id)}
                        className={`p-2 rounded-md border flex items-center justify-between cursor-pointer text-xs transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary font-bold text-primary'
                            : 'border-transparent hover:bg-secondary/40 text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold text-xs shrink-0">
                            <AvatarFallback>{g.first_name?.[0] || 'و'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="block font-bold">{g.full_name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {g.phone || 'بدون هاتف'}
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {g.access_code}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">صلة القرابة</Label>
              <select
                value={linkRelationshipType}
                onChange={(e) => setLinkRelationshipType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="father">الأب</option>
                <option value="mother">الأم</option>
                <option value="brother">الأخ</option>
                <option value="uncle">العم / الخال</option>
                <option value="guardian">وصي قانوني</option>
              </select>
            </div>

        </div>
      </AppModal>

      {/* Lightbox Modal for Document/Photo Full Preview */}
      {previewDocModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewDocModal(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-card rounded-2xl overflow-hidden shadow-2xl border border-border p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                {previewDocModal.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl flex items-center justify-center bg-black/5 dark:bg-black/40 p-2">
              <img
                src={previewDocModal.url}
                alt={previewDocModal.title}
                className="max-h-[65vh] w-auto rounded-lg object-contain shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
