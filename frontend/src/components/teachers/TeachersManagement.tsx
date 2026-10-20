import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest, AppAPIError } from '../../api/client';
import {
  TeacherProfile,
  StaffProfile,
  TeacherAssignment,
  AdoptedCurriculum,
  EducationalProgram,
  AcademicStructureData,
} from '../../types';
import { ErrorAlert, EmptyState, DataGrid, DataGridColumn, AppModal } from '../common';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
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
  Avatar,
  AvatarFallback,
} from '@/components/ui';

import {
  GraduationCap,
  UserPlus,
  Search,
  X,
  RotateCcw,
  Eye,
  Edit3,
  CheckCircle2,
  Clock,
  Briefcase,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  UserCheck,
  UserX,
  Phone,
  Mail,
  ShieldCheck,
  Plus,
  Trash2,
  ArrowRight,
  DollarSign,
  Copy,
  KeyRound,
} from 'lucide-react';

interface TeachersManagementProps {
  initialTeachers?: TeacherProfile[];
  staffList?: StaffProfile[];
  onTeachersUpdated?: () => void;
}

export const TeachersManagement: React.FC<TeachersManagementProps> = ({
  initialTeachers = [],
  staffList = [],
  onTeachersUpdated,
}) => {
  const [teachers, setTeachers] = useState<TeacherProfile[]>(initialTeachers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'inactive'>('all');
  const [employmentFilter, setEmploymentFilter] = useState<'all' | 'per_session' | 'full_time' | 'part_time' | 'contractor'>('all');
  const [specializationFilter, setSpecializationFilter] = useState<string>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // URL Search Params sync for Full Page Teacher Profile
  const [searchParams, setSearchParams] = useSearchParams();
  const teacherIdParam = searchParams.get('teacherId');

  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Curricula & Assignment Dialog state
  const [curricula, setCurricula] = useState<AdoptedCurriculum[]>([]);
  const [academicPrograms, setAcademicPrograms] = useState<EducationalProgram[]>([]);
  const [loadingCurricula, setLoadingCurricula] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState({
    selectedProgramId: 'all',
    selectedGradeId: 'all',
    adoptedCurriculumId: '',
    classSectionId: '',
    isLeadTeacher: true,
    startDate: new Date().toISOString().split('T')[0],
  });
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [terminatingAssignId, setTerminatingAssignId] = useState<string | null>(null);

  // Add Teacher Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: '',
    fatherName: '',
    lastName: '',
    gender: 'male',
    staffNumber: '',
    specialization: '',
    employmentType: 'per_session',
    hourlyRate: '',
    monthlySalary: '',
    phone: '',
    email: '',
    staffId: '',
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Teacher Dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    firstName: '',
    fatherName: '',
    lastName: '',
    gender: 'male',
    specialization: '',
    employmentType: 'per_session',
    hourlyRate: '',
    monthlySalary: '',
    phone: '',
    email: '',
    status: 'active',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Fetch / Refresh teachers from server
  const fetchTeachers = async (notifyParent = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: TeacherProfile[] }>('/api/v1/tenant/admin/hr/teachers');
      if (res?.data) {
        setTeachers(res.data);
        if (notifyParent && onTeachersUpdated) {
          onTeachersUpdated();
        }
      }
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل استرجاع قائمة الكادر التدريسي' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTeachers(initialTeachers || []);
  }, [initialTeachers]);

  // Load curricula and academic structure on mount
  useEffect(() => {
    fetchCurricula();
  }, []);

  // Flash message timer
  useEffect(() => {
    if (successNotice) {
      const timer = setTimeout(() => setSuccessNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successNotice]);

  // Extract unique specializations for filter dropdown
  const uniqueSpecializations = useMemo(() => {
    const specs = new Set<string>();
    teachers.forEach((t) => {
      if (t.specialization && t.specialization.trim()) {
        specs.add(t.specialization.trim());
      }
    });
    return Array.from(specs).sort();
  }, [teachers]);

  // Helper to find grade and program info from academicPrograms if missing on curriculum
  const getCurriculumGradeInfo = (c: AdoptedCurriculum) => {
    let gradeName = c.study_grade?.name;
    let progName = c.study_grade?.educational_program?.name;
    const gradeId = c.study_grade_id || c.study_grade?.id;

    if ((!gradeName || !progName) && gradeId) {
      for (const p of academicPrograms) {
        const foundGrade = p.grades?.find((g) => g.id === gradeId);
        if (foundGrade) {
          if (!gradeName) gradeName = foundGrade.name;
          if (!progName) progName = p.name;
          break;
        }
      }
    }
    return {
      gradeName: gradeName || 'صف عام',
      progName: progName || 'مرحلة عامة',
    };
  };

  // Extract unique educational programs (stages: ابتدائي، متوسط، إعدادي) from academic structure & curricula
  const availablePrograms = useMemo(() => {
    const map = new Map<string, string>();
    academicPrograms.forEach((p) => {
      if (p.id) {
        map.set(p.id, p.name);
      }
    });
    curricula.forEach((c) => {
      const prog = c.study_grade?.educational_program;
      if (prog && prog.id) {
        map.set(prog.id, prog.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [academicPrograms, curricula]);

  // Extract grades matching selected program in assign modal
  const availableGrades = useMemo(() => {
    const map = new Map<string, { id: string; name: string; programId?: string }>();
    academicPrograms.forEach((p) => {
      if (assignForm.selectedProgramId === 'all' || p.id === assignForm.selectedProgramId) {
        p.grades?.forEach((g) => {
          if (g.id) {
            map.set(g.id, { id: g.id, name: g.name, programId: p.id });
          }
        });
      }
    });
    curricula.forEach((c) => {
      const g = c.study_grade;
      if (g && g.id) {
        const progId = g.educational_program?.id || g.educational_program_id;
        if (assignForm.selectedProgramId === 'all' || progId === assignForm.selectedProgramId) {
          if (!map.has(g.id)) {
            map.set(g.id, { id: g.id, name: g.name, programId: progId });
          }
        }
      }
    });
    return Array.from(map.values());
  }, [academicPrograms, curricula, assignForm.selectedProgramId]);

  // Filtered curricula for modal selection based on selected stage and grade
  const filteredCurriculaForAssign = useMemo(() => {
    return curricula.filter((c) => {
      const gradeId = c.study_grade_id || c.study_grade?.id;
      let progId = c.study_grade?.educational_program?.id || c.study_grade?.educational_program_id;

      if (!progId && gradeId) {
        for (const p of academicPrograms) {
          if (p.grades?.some((g) => g.id === gradeId)) {
            progId = p.id;
            break;
          }
        }
      }

      if (assignForm.selectedProgramId !== 'all') {
        if (progId && progId !== assignForm.selectedProgramId) return false;
      }
      if (assignForm.selectedGradeId !== 'all') {
        if (gradeId && gradeId !== assignForm.selectedGradeId) return false;
      }
      return true;
    });
  }, [curricula, academicPrograms, assignForm.selectedProgramId, assignForm.selectedGradeId]);

  // Helper to extract phone and email from Person communication channels
  const getTeacherPhone = (teacher?: TeacherProfile | null) => {
    if (!teacher || !teacher.person) return '';
    if (teacher.person.phone) return teacher.person.phone;
    const ch = teacher.person.communication_channels?.find((c) => c.channel_type === 'phone');
    return ch?.channel_value || '';
  };

  const getTeacherEmail = (teacher?: TeacherProfile | null) => {
    if (!teacher || !teacher.person) return '';
    if (teacher.person.email) return teacher.person.email;
    const ch = teacher.person.communication_channels?.find((c) => c.channel_type === 'email');
    return ch?.channel_value || '';
  };

  // Compute stats strip
  const stats = useMemo(() => {
    const total = teachers.length;
    const active = teachers.filter((t) => t.status === 'active').length;
    const suspended = teachers.filter((t) => t.status === 'suspended').length;
    const inactive = teachers.filter((t) => t.status === 'inactive').length;
    const perSession = teachers.filter((t) => t.employment_type === 'per_session').length;
    const fullTime = teachers.filter((t) => t.employment_type === 'full_time').length;

    return {
      total,
      active,
      nonActive: suspended + inactive,
      perSession,
      fullTime,
    };
  }, [teachers]);

  // Filter & Search Logic
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const fullName = t.person
          ? `${t.person.first_name} ${t.person.father_name || ''} ${t.person.last_name}`.toLowerCase()
          : '';
        const staffNum = (t.staff_number || '').toLowerCase();
        const spec = (t.specialization || '').toLowerCase();

        const matches = fullName.includes(query) || staffNum.includes(query) || spec.includes(query);
        if (!matches) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (t.status !== statusFilter) return false;
      }

      // 3. Employment Filter
      if (employmentFilter !== 'all') {
        if (t.employment_type !== employmentFilter) return false;
      }

      // 4. Specialization Filter
      if (specializationFilter !== 'all') {
        if (t.specialization !== specializationFilter) return false;
      }

      return true;
    });
  }, [teachers, searchQuery, statusFilter, employmentFilter, specializationFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / pageSize));

  // Teachers DataGrid Column Definitions
  const teachersColumns: DataGridColumn<TeacherProfile>[] = useMemo(
    () => [
      {
        key: 'teacher',
        header: 'المدرس',
        align: 'right',
        render: (teacher) => {
          const person = teacher.person;
          const fullName = person
            ? `${person.first_name} ${person.father_name || ''} ${person.last_name}`
            : 'مدرس معتمد';
          const initial = person?.first_name ? person.first_name.charAt(0) : 'م';

          return (
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8 rounded-lg ring-1 ring-border shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="text-right">
                <span className="block text-foreground font-bold">{fullName}</span>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                  <span>{person?.gender === 'female' ? 'أنثى' : 'ذكر'}</span>
                  {getTeacherPhone(teacher) && (
                    <>
                      <span>•</span>
                      <span className="font-mono dir-ltr text-foreground/80">{getTeacherPhone(teacher)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: 'staffNumber',
        header: 'الرقم الوظيفي',
        align: 'right',
        render: (teacher) => (
          <span className="font-mono text-xs font-bold text-foreground px-2 py-1 rounded bg-secondary/60 border border-border">
            {teacher.staff_number}
          </span>
        ),
      },
      {
        key: 'accessCode',
        header: 'كود الدخول (التطبيق)',
        align: 'right',
        render: (teacher) => (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded tracking-wider">
              {teacher.access_code || '—'}
            </span>
            {teacher.access_code && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(teacher.access_code || '');
                  setSuccessNotice(`تم نسخ كود المدرس: ${teacher.access_code}`);
                }}
                className="text-slate-400 hover:text-purple-600 p-1 rounded hover:bg-purple-50 transition"
                title="نسخ كود الدخول لتطبيق المدرسين"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
      {
        key: 'specialization',
        header: 'التخصص الأكاديمي',
        align: 'right',
        render: (teacher) =>
          teacher.specialization ? (
            <Badge variant="outline" className="font-medium text-[11px] gap-1 bg-background">
              <BookOpen className="w-3 h-3 text-primary" />
              {teacher.specialization}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-[11px]">—</span>
          ),
      },
      {
        key: 'employmentType',
        header: 'نوع الارتباط',
        align: 'right',
        render: (teacher) => getEmploymentBadge(teacher.employment_type),
      },
      {
        key: 'status',
        header: 'الحالة',
        align: 'right',
        render: (teacher) => getStatusBadge(teacher.status),
      },
      {
        key: 'actions',
        header: 'الإجراءات',
        align: 'center',
        width: '130px',
        render: (teacher) => (
          <div className="flex items-center justify-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenDetail(teacher)}
              className="h-8 px-2.5 text-xs font-bold text-foreground hover:bg-secondary gap-1"
              title="عرض الملف المهني الكامل"
            >
              <Eye className="w-3.5 h-3.5 text-primary" />
              <span>الملف</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(teacher)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
              title="تعديل البيانات"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleStatus(teacher)}
              className={`h-8 w-8 p-0 ${
                teacher.status === 'active'
                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
              }`}
              title={teacher.status === 'active' ? 'تعليق حساب المدرس' : 'تفعيل حساب المدرس'}
            >
              {teacher.status === 'active' ? (
                <UserX className="w-3.5 h-3.5" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, employmentFilter, specializationFilter, pageSize]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    employmentFilter !== 'all' ||
    specializationFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setEmploymentFilter('all');
    setSpecializationFilter('all');
  };

  // Open Teacher Detail Full Page
  const handleOpenDetail = (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'workforce');
      next.set('teacherId', teacher.id);
      return next;
    });
  };

  // Back to teachers list
  const handleBackToList = () => {
    setSelectedTeacher(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('teacherId');
      return next;
    });
  };

  // Sync teacherId from URL on reload / history navigation
  useEffect(() => {
    if (!teacherIdParam) {
      if (selectedTeacher) {
        setSelectedTeacher(null);
        setTeacherAssignments([]);
      }
      return;
    }

    const localMatch = teachers.find((t) => t.id === teacherIdParam);
    if (localMatch && (!selectedTeacher || selectedTeacher.id !== teacherIdParam)) {
      setSelectedTeacher(localMatch);
    }

    const loadTeacherData = async () => {
      setLoadingAssignments(true);
      try {
        const res = await apiRequest<{ success: boolean; data: TeacherProfile; assignments?: TeacherAssignment[] }>(
          `/api/v1/tenant/admin/hr/teachers/${teacherIdParam}`
        );
        if (res?.data) {
          setSelectedTeacher(res.data);
        }
        if (res?.assignments) {
          setTeacherAssignments(res.assignments);
        }
      } catch {
        // Fallback gracefully
      } finally {
        setLoadingAssignments(false);
      }
    };

    loadTeacherData();
  }, [teacherIdParam, teachers]);

  // Open Edit Teacher Modal
  const handleOpenEdit = (teacher: TeacherProfile) => {
    setEditForm({
      id: teacher.id,
      firstName: teacher.person?.first_name || '',
      fatherName: teacher.person?.father_name || '',
      lastName: teacher.person?.last_name || '',
      gender: teacher.person?.gender || 'male',
      specialization: teacher.specialization || '',
      employmentType: teacher.employment_type || 'per_session',
      hourlyRate: teacher.hourly_rate ? String(teacher.hourly_rate) : '',
      monthlySalary: teacher.monthly_salary ? String(teacher.monthly_salary) : '',
      phone: getTeacherPhone(teacher),
      email: getTeacherEmail(teacher),
      status: teacher.status || 'active',
    });
    setShowEditDialog(true);
  };

  // Submit Add Teacher
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.staffNumber.trim()) {
      setError({ message: 'يرجى إدخال الحقول الإلزامية المطلوبة (الاسم الأول، الكنية، والرقم الوظيفي)' });
      return;
    }

    setSubmittingAdd(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/hr/teachers', {
        method: 'POST',
        body: JSON.stringify({
          first_name: addForm.firstName.trim(),
          father_name: addForm.fatherName.trim() || undefined,
          last_name: addForm.lastName.trim(),
          gender: addForm.gender,
          staff_number: addForm.staffNumber.trim(),
          specialization: addForm.specialization.trim() || undefined,
          employment_type: addForm.employmentType,
          hourly_rate: addForm.hourlyRate ? parseFloat(addForm.hourlyRate) : undefined,
          monthly_salary: addForm.monthlySalary ? parseFloat(addForm.monthlySalary) : undefined,
          phone: addForm.phone.trim() || undefined,
          email: addForm.email.trim() || undefined,
          staff_id: addForm.staffId || undefined,
        }),
      });

      setShowAddDialog(false);
      setAddForm({
        firstName: '',
        fatherName: '',
        lastName: '',
        gender: 'male',
        staffNumber: '',
        specialization: '',
        employmentType: 'per_session',
        hourlyRate: '',
        monthlySalary: '',
        phone: '',
        email: '',
        staffId: '',
      });
      setSuccessNotice('تم إضافة المدرس بنجاح إلى هيئة التدريس');
      await fetchTeachers(true);
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'تعذر إضافة المدرس، تأكد من عدم تكرار الرقم الوظيفي' });
      }
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Submit Edit Teacher
  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setError({ message: 'الاسم الأول واللقب مطلوبان' });
      return;
    }

    setSubmittingEdit(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: TeacherProfile }>(
        `/api/v1/tenant/admin/hr/teachers/${editForm.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            first_name: editForm.firstName.trim(),
            father_name: editForm.fatherName.trim() || undefined,
            last_name: editForm.lastName.trim(),
            gender: editForm.gender,
            specialization: editForm.specialization.trim() || undefined,
            employment_type: editForm.employmentType,
            hourly_rate: editForm.hourlyRate ? parseFloat(editForm.hourlyRate) : undefined,
            monthly_salary: editForm.monthlySalary ? parseFloat(editForm.monthlySalary) : undefined,
            phone: editForm.phone.trim() || undefined,
            email: editForm.email.trim() || undefined,
            status: editForm.status,
          }),
        }
      );

      setShowEditDialog(false);
      if (selectedTeacher && selectedTeacher.id === editForm.id && res?.data) {
        setSelectedTeacher(res.data);
      }
      setSuccessNotice('تم تحديث بيانات المدرس بنجاح');
      await fetchTeachers(true);
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل حفظ وتحديث بيانات المدرس' });
      }
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Quick Status Toggle (Active / Inactive)
  const handleToggleStatus = async (teacher: TeacherProfile) => {
    const targetStatus = teacher.status === 'active' ? 'suspended' : 'active';
    setError(null);
    try {
      await apiRequest(`/api/v1/tenant/admin/hr/teachers/${teacher.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus }),
      });

      // Update state locally
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacher.id ? { ...t, status: targetStatus } : t))
      );
      if (selectedTeacher && selectedTeacher.id === teacher.id) {
        setSelectedTeacher({ ...selectedTeacher, status: targetStatus });
      }
      setSuccessNotice(
        targetStatus === 'active'
          ? `تم تفعيل حساب المدرس (${teacher.staff_number})`
          : `تم تعليق حساب المدرس (${teacher.staff_number})`
      );
      if (onTeachersUpdated) {
        onTeachersUpdated();
      }
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      }
    }
  };

  // Fetch available adopted curricula and academic structure for assignments
  const fetchCurricula = async () => {
    setLoadingCurricula(true);
    try {
      const [structRes, currRes] = await Promise.allSettled([
        apiRequest<{ success: boolean; data: AcademicStructureData }>(
          '/api/v1/tenant/admin/academic/structure'
        ),
        apiRequest<{ success: boolean; data: AdoptedCurriculum[] }>(
          '/api/v1/tenant/admin/hr/curricula'
        ),
      ]);

      if (structRes.status === 'fulfilled' && structRes.value?.data) {
        if (structRes.value.data.programs) {
          setAcademicPrograms(structRes.value.data.programs);
        }
        if (structRes.value.data.adopted_curricula && structRes.value.data.adopted_curricula.length > 0) {
          setCurricula(structRes.value.data.adopted_curricula);
        }
      }

      if (currRes.status === 'fulfilled' && currRes.value?.data && currRes.value.data.length > 0) {
        setCurricula(currRes.value.data);
      }
    } catch {
      // Graceful fallback if listing fails
    } finally {
      setLoadingCurricula(false);
    }
  };

  // Open Assign Curriculum Dialog
  const handleOpenAssign = async () => {
    setAssignForm({
      selectedProgramId: 'all',
      selectedGradeId: 'all',
      adoptedCurriculumId: '',
      classSectionId: '',
      isLeadTeacher: true,
      startDate: new Date().toISOString().split('T')[0],
    });
    setShowAssignDialog(true);
    fetchCurricula();
  };

  // Submit Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || !assignForm.adoptedCurriculumId) {
      setError({ message: 'يرجى اختيار المقرر الدراسي المراد إسناده للمدرس' });
      return;
    }

    setSubmittingAssign(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: TeacherAssignment }>(
        `/api/v1/tenant/admin/hr/teachers/${selectedTeacher.id}/assignments`,
        {
          method: 'POST',
          body: JSON.stringify({
            adopted_curriculum_id: assignForm.adoptedCurriculumId,
            class_section_id: assignForm.classSectionId || undefined,
            is_lead_teacher: assignForm.isLeadTeacher,
            start_date: new Date(assignForm.startDate).toISOString(),
          }),
        }
      );

      if (res?.data) {
        const createdAssignment = { ...res.data };
        if (!createdAssignment.adopted_curriculum) {
          const matchCurr = curricula.find((c) => c.id === assignForm.adoptedCurriculumId);
          if (matchCurr) {
            createdAssignment.adopted_curriculum = matchCurr;
          }
        }
        setTeacherAssignments((prev) => [createdAssignment, ...prev]);
      }
      setShowAssignDialog(false);
      setSuccessNotice('تم إسناد المقرر الدراسي للمدرس بنجاح');
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'تعذر إسناد المقرر الدراسي للمدرس' });
      }
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Terminate Assignment
  const handleTerminateAssignment = async (assignmentId: string) => {
    setTerminatingAssignId(assignmentId);
    setError(null);
    try {
      await apiRequest(`/api/v1/tenant/admin/hr/teachers/assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      setTeacherAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, status: 'terminated' } : a))
      );
      setSuccessNotice('تم إنهاء التكليف التدريسي للمقرر');
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل إنهاء التكليف التدريسي' });
      }
    } finally {
      setTerminatingAssignId(null);
    }
  };

  // Helper to format curriculum title with full academic context (Subject + Grade + Stage)
  const getCurriculumDisplayName = (assignment: TeacherAssignment) => {
    const ac = assignment.adopted_curriculum;
    if (!ac) return 'مقرر دراسي معتمد';
    const subName =
      ac.subject_name ||
      ac.curriculum_edition?.definition?.subject?.name ||
      ac.curriculum_edition?.definition?.name ||
      ac.course_name ||
      'مقرر دراسي';
    const gradeName = ac.study_grade?.name;
    const progName = ac.study_grade?.educational_program?.name;
    const sectionName = assignment.class_section?.name;

    let res = subName;
    if (gradeName) {
      res += ` ⟵ ${gradeName}`;
      if (progName) res += ` (${progName})`;
    }
    if (sectionName) {
      res += ` • شعبة (${sectionName})`;
    }
    return res;
  };

  const getEmploymentBadge = (type: string) => {
    switch (type) {
      case 'per_session':
        return (
          <Badge variant="secondary" className="bg-amber-50 text-amber-800 border-amber-200/60 font-semibold text-[11px]">
            أجر بالحصة
          </Badge>
        );
      case 'full_time':
        return (
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-200/60 font-semibold text-[11px]">
            دوام كامل
          </Badge>
        );
      case 'part_time':
        return (
          <Badge variant="secondary" className="bg-blue-50 text-blue-800 border-blue-200/60 font-semibold text-[11px]">
            دوام جزئي
          </Badge>
        );
      case 'contractor':
        return (
          <Badge variant="secondary" className="bg-purple-50 text-purple-800 border-purple-200/60 font-semibold text-[11px]">
            مستقل / عقد
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[11px]">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 bg-emerald-50/60 text-[11px] font-bold gap-1.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          نشط
        </Badge>
      );
    }
    if (status === 'suspended') {
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-700 bg-amber-50/60 text-[11px] font-bold gap-1.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
          معلق
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-slate-300 text-slate-500 bg-slate-50 text-[11px] font-bold gap-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
        غير نشط
      </Badge>
    );
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

      {teacherIdParam ? (
        loadingAssignments && !selectedTeacher ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToList}
                className="h-9 px-3 text-xs font-bold gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة لكادر التدريسي</span>
              </Button>
            </div>
            <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs font-semibold text-muted-foreground">جاري استرجاع تفاصيل الملف المهني للمدرس...</p>
            </div>
          </div>
        ) : !selectedTeacher ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToList}
                className="h-9 px-3 text-xs font-bold gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة لكادر التدريسي</span>
              </Button>
            </div>
            <div className="p-12 text-center bg-card rounded-2xl border border-border space-y-3">
              <p className="text-sm font-bold text-destructive">لم يتم العثور على ملف المدرس المطلوب أو قد تم حذفه</p>
              <Button onClick={handleBackToList} size="sm" className="text-xs font-bold">
                الرجوع لقائمة المدرسين
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* 1. Top Navigation & Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToList}
                  className="h-9 px-3 text-xs font-bold gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة لكادر التدريسي</span>
                </Button>
                <div className="h-5 w-px bg-border hidden sm:block" />
                <span className="text-xs font-bold text-muted-foreground hidden sm:inline">
                  الملف المهني الأكاديمي
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEdit(selectedTeacher)}
                  className="h-9 text-xs font-bold gap-1.5 border-border hover:bg-secondary"
                >
                  <Edit3 className="w-3.5 h-3.5 text-primary" />
                  <span>تعديل الملف</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleStatus(selectedTeacher)}
                  className={`h-9 text-xs font-bold gap-1.5 ${
                    selectedTeacher.status === 'active'
                      ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200'
                      : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                  }`}
                >
                  {selectedTeacher.status === 'active' ? (
                    <>
                      <UserX className="w-3.5 h-3.5" />
                      <span>تعليق الحساب</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>تفعيل الحساب</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 2. Hero Header Profile Card */}
            <Card className="shadow-xs border border-border overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/50" />
              <CardContent className="p-6 -mt-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <Avatar className="w-20 h-20 rounded-2xl ring-4 ring-background shadow-md border border-border">
                      <AvatarFallback className="rounded-2xl text-xl font-black bg-primary/10 text-primary">
                        {selectedTeacher.person
                          ? `${selectedTeacher.person.first_name?.[0] || ''}${selectedTeacher.person.last_name?.[0] || ''}`
                          : 'م'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-black text-foreground">
                          {selectedTeacher.person
                            ? `${selectedTeacher.person.first_name} ${selectedTeacher.person.father_name || ''} ${selectedTeacher.person.last_name}`
                            : 'مدرس غير محدد'}
                        </h1>
                        {getStatusBadge(selectedTeacher.status)}
                        <Badge variant="outline" className="text-[11px] font-bold font-mono bg-muted/50 border-border">
                          {selectedTeacher.staff_number}
                        </Badge>
                        {selectedTeacher.access_code && (
                          <div className="flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded text-[11px] font-bold font-mono">
                            <KeyRound className="w-3 h-3 text-purple-500" />
                            <span>{selectedTeacher.access_code}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedTeacher.access_code || '');
                                setSuccessNotice(`تم نسخ كود الدخول: ${selectedTeacher.access_code}`);
                              }}
                              className="text-purple-400 hover:text-purple-700 p-0.5"
                              title="نسخ كود الدخول"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-medium">
                        {selectedTeacher.specialization && (
                          <span className="flex items-center gap-1.5 text-foreground font-bold">
                            <BookOpen className="w-3.5 h-3.5 text-primary" />
                            {selectedTeacher.specialization}
                          </span>
                        )}
                        <span>•</span>
                        <span>{selectedTeacher.person?.gender === 'female' ? 'أنثى' : 'ذكر'}</span>

                        {getTeacherPhone(selectedTeacher) && (
                          <>
                            <span>•</span>
                            <a
                              href={`tel:${getTeacherPhone(selectedTeacher)}`}
                              className="flex items-center gap-1 font-mono dir-ltr text-foreground hover:text-primary transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              {getTeacherPhone(selectedTeacher)}
                            </a>
                          </>
                        )}

                        {getTeacherEmail(selectedTeacher) && (
                          <>
                            <span>•</span>
                            <a
                              href={`mailto:${getTeacherEmail(selectedTeacher)}`}
                              className="flex items-center gap-1 font-mono text-foreground hover:text-primary transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                              {getTeacherEmail(selectedTeacher)}
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center">
                    {getEmploymentBadge(selectedTeacher.employment_type)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Four Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-xs p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-semibold">نوع الارتباط التعاقدي</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-base font-black text-foreground">
                  {selectedTeacher.employment_type === 'per_session' && 'أجر بالحصة'}
                  {selectedTeacher.employment_type === 'full_time' && 'دوام كامل'}
                  {selectedTeacher.employment_type === 'part_time' && 'دوام جزئي'}
                  {selectedTeacher.employment_type === 'contractor' && 'مستقل / عقد'}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {selectedTeacher.employment_type === 'per_session' ? 'محاسبة بحسب حضور الحصص' : 'راتب شهري ثابت'}
                </div>
              </Card>

              <Card className="shadow-xs p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-semibold">الاستحقاق المالي</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-lg font-black text-emerald-600">
                  {selectedTeacher.employment_type === 'per_session' ? (
                    <>
                      {Math.round(Number(selectedTeacher.hourly_rate) || 0).toLocaleString('ar-IQ')}{' '}
                      <span className="text-xs font-normal">د.ع / حصة</span>
                    </>
                  ) : (
                    <>
                      {Math.round(Number(selectedTeacher.monthly_salary) || 0).toLocaleString('ar-IQ')}{' '}
                      <span className="text-xs font-normal">د.ع شهرياً</span>
                    </>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  دينار عراقي بدون كسور أو فلسات
                </div>
              </Card>

              <Card className="shadow-xs p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-semibold">المقررات المسندة</span>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-foreground">
                  {teacherAssignments.filter((a) => a.status === 'active').length}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  مقررات دراسية مكلف بها حالياً
                </div>
              </Card>

              <Card className="shadow-xs p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-semibold">الربط المؤسسي</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-sm font-black text-foreground truncate">
                  {selectedTeacher.staff_profile ? 'مرتبط بسجل الموظفين' : 'ملف تدريسي مستقل'}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                  كود: {selectedTeacher.staff_number}
                </div>
              </Card>
            </div>

            {/* 4. Full-Width Tabs Details */}
            <Card className="shadow-xs border border-border overflow-hidden">
              <Tabs defaultValue="curricula" className="w-full">
                <div className="border-b border-border px-6 pt-4 bg-muted/20">
                  <TabsList className="bg-muted/60 p-1 rounded-xl">
                    <TabsTrigger value="curricula" className="text-xs font-bold gap-2">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>المقررات والتكليفات التدريسية ({teacherAssignments.filter((a) => a.status === 'active').length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="personal" className="text-xs font-bold gap-2">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>البيانات الشخصية والأكاديمية</span>
                    </TabsTrigger>
                    <TabsTrigger value="contract" className="text-xs font-bold gap-2">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>العقد والاستحقاق المالي</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab 1: Curricula & Assignments */}
                <TabsContent value="curricula" className="p-6 m-0 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">المقررات الدراسية المسندة للمدرس</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        المناهج والتكليفات الأكاديمية المكلف بها المدرس في المعهد
                      </p>
                    </div>
                    <Button
                      onClick={handleOpenAssign}
                      size="sm"
                      className="text-xs font-bold gap-1.5 h-9"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إسناد مقرر دراسي جديد</span>
                    </Button>
                  </div>

                  {loadingAssignments ? (
                    <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <span className="text-xs text-muted-foreground">جاري استرجاع قائمة المقررات المسندة...</span>
                    </div>
                  ) : teacherAssignments.length === 0 ? (
                    <div className="p-8 rounded-xl border border-dashed border-border bg-muted/10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">لا توجد مقررات مسندة لهذا المدرس حالياً</h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                          يمكنك تكليف المدرس بالمناهج والمقررات المعتمدة لدى المعهد للبدء في تنظيم جداول الحصص والتقييمات
                        </p>
                      </div>
                      <Button
                        onClick={handleOpenAssign}
                        size="sm"
                        variant="outline"
                        className="text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إسناد مقرر دراسي الآن</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-right text-xs font-bold">المقرر الدراسي / المنهج</TableHead>
                            <TableHead className="text-right text-xs font-bold">الدور الأكاديمي</TableHead>
                            <TableHead className="text-right text-xs font-bold">الحصص الأسبوعية</TableHead>
                            <TableHead className="text-right text-xs font-bold">تاريخ المباشرة</TableHead>
                            <TableHead className="text-right text-xs font-bold">الحالة</TableHead>
                            <TableHead className="text-left text-xs font-bold">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teacherAssignments.map((assignment) => (
                            <TableRow key={assignment.id} className="hover:bg-muted/20">
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <BookOpen className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-foreground block">
                                      {getCurriculumDisplayName(assignment)}
                                    </span>
                                    {assignment.adopted_curriculum?.academic_term?.name && (
                                      <span className="text-[10px] text-muted-foreground block">
                                        الفصل: {assignment.adopted_curriculum.academic_term.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {assignment.is_lead_teacher ? (
                                  <Badge variant="outline" className="text-[11px] font-bold border-primary/30 text-primary bg-primary/5">
                                    مدرس أساسي
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
                                    مدرس مشارك
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-bold font-mono">
                                  {assignment.adopted_curriculum?.weekly_sessions_count ? `${assignment.adopted_curriculum.weekly_sessions_count} حصص` : '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-mono text-muted-foreground">
                                  {assignment.start_date ? new Date(assignment.start_date).toLocaleDateString('ar-IQ') : '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                {assignment.status === 'active' ? (
                                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 bg-emerald-50/60 text-[10px] font-bold">
                                    نشط
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-slate-300 text-slate-500 bg-slate-50 text-[10px] font-bold">
                                    منتهي
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-left">
                                {assignment.status === 'active' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={terminatingAssignId === assignment.id}
                                    onClick={() => handleTerminateAssignment(assignment.id)}
                                    className="h-8 px-2.5 text-xs font-bold text-destructive hover:bg-destructive/10 gap-1"
                                    title="إنهاء التكليف الدراسي"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>{terminatingAssignId === assignment.id ? 'جاري الإنهاء...' : 'إنهاء'}</span>
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Tab 2: Personal & Academic Info */}
                <TabsContent value="personal" className="p-6 m-0 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">البيانات الشخصية والأكاديمية للمدرس</h3>
                    <p className="text-xs text-muted-foreground">
                      المعلومات الأساسية الموثقة في سجلات المعهد ووزارة التربية/التعليم
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[11px] text-muted-foreground block mb-1">الاسم الرباعي الكامل:</span>
                      <span className="text-xs font-bold text-foreground">
                        {selectedTeacher.person
                          ? `${selectedTeacher.person.first_name} ${selectedTeacher.person.father_name || ''} ${selectedTeacher.person.last_name}`
                          : '—'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[11px] text-muted-foreground block mb-1">الرقم الوظيفي (Staff Code):</span>
                      <span className="text-xs font-bold font-mono text-foreground">
                        {selectedTeacher.staff_number}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[11px] text-muted-foreground block mb-1">التخصص الأكاديمي:</span>
                      <span className="text-xs font-bold text-foreground">
                        {selectedTeacher.specialization || 'غير محدد'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[11px] text-muted-foreground block mb-1">الجنس:</span>
                      <span className="text-xs font-bold text-foreground">
                        {selectedTeacher.person?.gender === 'female' ? 'أنثى' : 'ذكر'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[11px] text-muted-foreground block mb-1">رقم الهاتف:</span>
                      <span className="text-xs font-bold font-mono dir-ltr text-foreground inline-block">
                        {getTeacherPhone(selectedTeacher) || 'غير مسجل'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[11px] text-muted-foreground block mb-1">البريد الإلكتروني:</span>
                      <span className="text-xs font-bold font-mono text-foreground">
                        {getTeacherEmail(selectedTeacher) || 'غير مسجل'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[11px] text-muted-foreground block mb-1">تاريخ الانضمام للكادر:</span>
                      <span className="text-xs font-bold font-mono text-foreground">
                        {selectedTeacher.created_at ? new Date(selectedTeacher.created_at).toLocaleDateString('ar-IQ') : '—'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[11px] text-muted-foreground block mb-1">حالة الحساب الأكاديمي:</span>
                      <div className="mt-0.5">{getStatusBadge(selectedTeacher.status)}</div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: Contract & Financials */}
                <TabsContent value="contract" className="p-6 m-0 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-1">العقد والبيانات المالية</h3>
                    <p className="text-xs text-muted-foreground">
                      شروط التعاقد ونظام الاستحقاق المالي المعتمد بالدينار العراقي (IQD)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                      <span className="text-xs font-bold text-foreground block">نوع العقد والتوظيف</span>
                      <div className="flex items-center gap-2">
                        {getEmploymentBadge(selectedTeacher.employment_type)}
                        <span className="text-xs text-muted-foreground">
                          {selectedTeacher.employment_type === 'per_session' && 'يتم احتساب الأجر بناءً على الحصص الفعلية المنفذة'}
                          {selectedTeacher.employment_type === 'full_time' && 'تعاقد بدوام كامل مع مرتب شهري ثابت'}
                          {selectedTeacher.employment_type === 'part_time' && 'تعاقد بدوام جزئي مع مرتب شهري محدد'}
                          {selectedTeacher.employment_type === 'contractor' && 'تعاقد خارجي مستقل'}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                      <span className="text-xs font-bold text-foreground block">القيمة المالية للاستحقاق</span>
                      <div className="text-xl font-black text-emerald-600">
                        {selectedTeacher.employment_type === 'per_session' ? (
                          <>
                            {Math.round(Number(selectedTeacher.hourly_rate) || 0).toLocaleString('ar-IQ')}{' '}
                            <span className="text-xs font-bold text-foreground">دينار عراقي لكل حصة دراسية</span>
                          </>
                        ) : (
                          <>
                            {Math.round(Number(selectedTeacher.monthly_salary) || 0).toLocaleString('ar-IQ')}{' '}
                            <span className="text-xs font-bold text-foreground">دينار عراقي راتب شهري</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        يتم توليد مستحقات الحصص تلقائياً عند اعتماد جداول الحضور في قسم الحسابات والمالية.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )
      ) : (
        <>
          {/* 1. Header (رأس الصفحة) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">الكادر التدريسي</h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                إدارة ملفات المدرسين والتخصصات الأكاديمية والارتباط التعاقدي
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchTeachers(); }}
            disabled={loading}
            className="h-9 text-xs font-bold gap-1.5 text-muted-foreground hover:text-foreground"
            title="تحديث القائمة"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>

          <Button
            onClick={() => setShowAddDialog(true)}
            size="sm"
            className="h-9 text-xs font-bold gap-1.5 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مدرس جديد</span>
          </Button>
        </div>
      </div>

      {/* 2. Compact Stats Strip (شريط إحصائيات مدمج) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">إجمالي المدرسين</span>
            <span className="text-xl font-black text-foreground mt-0.5 block">{stats.total}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <GraduationCap className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">على رأس العمل</span>
            <span className="text-xl font-black text-emerald-600 mt-0.5 block">{stats.active}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">أجر بالحصة (Per Session)</span>
            <span className="text-xl font-black text-amber-600 mt-0.5 block">{stats.perSession}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-semibold block">دوام كامل (Full-time)</span>
            <span className="text-xl font-black text-blue-600 mt-0.5 block">{stats.fullTime}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Briefcase className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Toolbar (شريط أدوات البحث والتصفية) */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث بالاسم، الرقم الوظيفي، أو التخصص..."
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
              <option value="all">كل الحالات الوظيفية</option>
              <option value="active">نشط فقط</option>
              <option value="suspended">معلق</option>
              <option value="inactive">غير نشط</option>
            </select>

            {/* Employment Type Filter */}
            <select
              value={employmentFilter}
              onChange={(e) => setEmploymentFilter(e.target.value as any)}
              className="h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">كل نماذج التعاقد</option>
              <option value="per_session">أجر بالحصة</option>
              <option value="full_time">دوام كامل</option>
              <option value="part_time">دوام جزئي</option>
              <option value="contractor">مستقل / عقد</option>
            </select>

            {/* Specialization Filter */}
            {uniqueSpecializations.length > 0 && (
              <select
                value={specializationFilter}
                onChange={(e) => setSpecializationFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[160px]"
              >
                <option value="all">كل التخصصات</option>
                {uniqueSpecializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            )}

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
            إجمالي النتائج: <strong className="text-foreground">{filteredTeachers.length}</strong> مدرس
            {hasActiveFilters && ` (تمت التصفية من أصل ${teachers.length})`}
          </span>
          <span className="font-mono">الصفحة {currentPage} من {totalPages}</span>
        </div>
      </div>

      {/* 4. Teaching Staff DataGrid (جدول الكادر التدريسي الموحد) */}
      <DataGrid<TeacherProfile>
        data={filteredTeachers}
        columns={teachersColumns}
        keyExtractor={(teacher) => teacher.id}
        loading={loading && teachers.length === 0}
        loadingMessage="جاري تحميل سجلات هيئة التدريس..."
        title="سجل هيئة التدريس"
        badgeText={`${filteredTeachers.length} مدرس`}
        headerSubtitle={hasActiveFilters ? `(تمت التصفية من أصل ${teachers.length})` : undefined}
        headerRight={
          hasActiveFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-7 text-xs font-bold text-destructive hover:bg-destructive/10 gap-1 px-2.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>مسح الفلاتر</span>
            </Button>
          ) : undefined
        }
        pagination={true}
        currentPage={currentPage}
        pageSize={pageSize}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        emptyTitle={hasActiveFilters ? 'لا توجد نتائج تطابق خيارات التصفية' : 'لا يوجد مدرسين مسجلين حتى الآن'}
        emptyDescription={
          hasActiveFilters
            ? 'جرب البحث بكلمات مختلفة أو تفريغ الفلاتر النشطة'
            : 'ابدأ بإضافة أول مدرس لإنشاء هيئة التدريس وإسناد الحصص الدراسية'
        }
        emptyAction={
          hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs font-bold">
              مسح جميع الفلاتر
            </Button>
          ) : (
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="text-xs font-bold gap-1 shadow-xs">
              <Plus className="w-4 h-4" />
              <span>إضافة مدرس الآن</span>
            </Button>
          )
        }
      />
        </>
      )}

      {/* 5. Add Teacher Dialog (إضافة مدرس جديد) */}
      <AppModal
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        size="lg"
        icon={<UserPlus className="w-5 h-5 text-primary" />}
        title="إضافة مدرس جديد لهيئة التدريس"
        description="تسجيل هوية المدرس وتخصيصه الأكاديمي ونوع الارتباط التعاقدي"
        onSubmit={handleCreateTeacher}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(false)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submittingAdd}
              className="text-xs font-bold gap-1.5"
            >
              {submittingAdd ? 'جاري الحفظ...' : 'تأكيد إضافة المدرس'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الاسم الأول *</Label>
                <Input
                  type="text"
                  required
                  value={addForm.firstName}
                  onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                  placeholder="مثال: أحمد"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">اسم الأب</Label>
                <Input
                  type="text"
                  value={addForm.fatherName}
                  onChange={(e) => setAddForm({ ...addForm, fatherName: e.target.value })}
                  placeholder="مثال: كريم"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">اللقب / الشهرة *</Label>
                <Input
                  type="text"
                  required
                  value={addForm.lastName}
                  onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                  placeholder="مثال: السعدي"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الجنس *</Label>
                <select
                  value={addForm.gender}
                  onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الرقم الوظيفي *</Label>
                <Input
                  type="text"
                  required
                  value={addForm.staffNumber}
                  onChange={(e) => setAddForm({ ...addForm, staffNumber: e.target.value })}
                  placeholder="مثال: TCH-2026-001"
                  className="font-mono text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">التخصص الأكاديمي</Label>
                <Input
                  type="text"
                  value={addForm.specialization}
                  onChange={(e) => setAddForm({ ...addForm, specialization: e.target.value })}
                  placeholder="مثال: الرياضيات"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نوع التعاقد والارتباط *</Label>
                <select
                  value={addForm.employmentType}
                  onChange={(e) => setAddForm({ ...addForm, employmentType: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="per_session">أجر بالحصة (Per Session)</option>
                  <option value="full_time">دوام كامل (Full-time)</option>
                  <option value="part_time">دوام جزئي (Part-time)</option>
                  <option value="contractor">مدرس خصوصي مستقل (Contractor)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {addForm.employmentType === 'per_session' ? 'أجر الحصة (د.ع)' : 'الراتب الشهري (د.ع)'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="500"
                  value={addForm.employmentType === 'per_session' ? addForm.hourlyRate : addForm.monthlySalary}
                  onChange={(e) => {
                    if (addForm.employmentType === 'per_session') {
                      setAddForm({ ...addForm, hourlyRate: e.target.value });
                    } else {
                      setAddForm({ ...addForm, monthlySalary: e.target.value });
                    }
                  }}
                  placeholder={addForm.employmentType === 'per_session' ? '25000' : '750000'}
                  className="font-mono text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رقم الهاتف (اختياري)</Label>
                <Input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="07701234567"
                  className="font-mono text-xs h-9 dir-ltr text-right"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">البريد الإلكتروني (اختياري)</Label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="teacher@example.com"
                  className="font-mono text-xs h-9 dir-ltr text-right"
                />
              </div>
            </div>

            {staffList.length > 0 && (
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">ربط بملف موظف إداري موجود (اختياري)</Label>
                <select
                  value={addForm.staffId}
                  onChange={(e) => setAddForm({ ...addForm, staffId: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">بدون ربط (مدرس مستقل)</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.staff_number} - {s.person ? `${s.person.first_name} ${s.person.last_name}` : 'موظف'}
                    </option>
                  ))}
                </select>
              </div>
            )}

        </div>
      </AppModal>

      {/* 7. Edit Teacher Dialog (تعديل بيانات المدرس) */}
      <AppModal
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        size="lg"
        icon={<Edit3 className="w-5 h-5 text-primary" />}
        title="تعديل بيانات المدرس"
        description="تحديث المعلومات الشخصية والمهنية والحالة الوظيفية"
        onSubmit={handleUpdateTeacher}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(false)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submittingEdit}
              className="text-xs font-bold gap-1.5"
            >
              {submittingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الاسم الأول *</Label>
                <Input
                  type="text"
                  required
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">اسم الأب</Label>
                <Input
                  type="text"
                  value={editForm.fatherName}
                  onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">اللقب / الشهرة *</Label>
                <Input
                  type="text"
                  required
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الجنس *</Label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">التخصص الأكاديمي</Label>
                <Input
                  type="text"
                  value={editForm.specialization}
                  onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الحالة الوظيفية *</Label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="active">نشط (Active)</option>
                  <option value="suspended">معلق (Suspended)</option>
                  <option value="inactive">غير نشط (Inactive)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نوع التعاقد *</Label>
                <select
                  value={editForm.employmentType}
                  onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="per_session">أجر بالحصة (Per Session)</option>
                  <option value="full_time">دوام كامل (Full-time)</option>
                  <option value="part_time">دوام جزئي (Part-time)</option>
                  <option value="contractor">مستقل / عقد (Contractor)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {editForm.employmentType === 'per_session' ? 'أجر الحصة (د.ع)' : 'الراتب الشهري (د.ع)'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="500"
                  value={editForm.employmentType === 'per_session' ? editForm.hourlyRate : editForm.monthlySalary}
                  onChange={(e) => {
                    if (editForm.employmentType === 'per_session') {
                      setEditForm({ ...editForm, hourlyRate: e.target.value });
                    } else {
                      setEditForm({ ...editForm, monthlySalary: e.target.value });
                    }
                  }}
                  placeholder={editForm.employmentType === 'per_session' ? '25000' : '750000'}
                  className="font-mono text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رقم الهاتف (اختياري)</Label>
                <Input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="07701234567"
                  className="font-mono text-xs h-9 dir-ltr text-right"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">البريد الإلكتروني (اختياري)</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="teacher@example.com"
                  className="font-mono text-xs h-9 dir-ltr text-right"
                />
              </div>
            </div>

        </div>
      </AppModal>

      {/* 8. Assign Curriculum Dialog (إسناد مقرر دراسي) */}
      <AppModal
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        size="md"
        icon={<GraduationCap className="w-5 h-5 text-primary" />}
        title="إسناد مقرر دراسي للمدرس"
        description="تكليف المدرس بمقرر دراسي معتمد وتحديد دوره الأكاديمي وتاريخ المباشرة"
        onSubmit={handleCreateAssignment}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAssignDialog(false)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submittingAssign || !assignForm.adoptedCurriculumId}
              className="text-xs font-bold gap-1.5"
            >
              {submittingAssign ? 'جاري الإسناد...' : 'تأكيد إسناد المقرر'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
            {/* Step 1 & 2: Educational Stage and Grade Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">1</span>
                  <span>المرحلة التعليمية</span>
                </Label>
                <select
                  value={assignForm.selectedProgramId}
                  onChange={(e) => {
                    const newProg = e.target.value;
                    setAssignForm((prev) => ({
                      ...prev,
                      selectedProgramId: newProg,
                      selectedGradeId: 'all',
                      adoptedCurriculumId: '',
                    }));
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                >
                  <option value="all">-- كل المراحل التعليمية --</option>
                  {availablePrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">2</span>
                  <span>الصف الدراسي</span>
                </Label>
                <select
                  value={assignForm.selectedGradeId}
                  onChange={(e) => {
                    const newGrade = e.target.value;
                    setAssignForm((prev) => ({
                      ...prev,
                      selectedGradeId: newGrade,
                      adoptedCurriculumId: '',
                    }));
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                >
                  <option value="all">-- كل الصفوف الدراسية --</option>
                  {availableGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 3: Exact Subject/Curriculum selection */}
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">3</span>
                  <span>المادة والمقرر الدراسي المعتمد *</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  ({filteredCurriculaForAssign.length} مادة متوفرة)
                </span>
              </Label>
              {loadingCurricula ? (
                <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span>جاري تحميل قائمة المناهج المعتمدة...</span>
                </div>
              ) : filteredCurriculaForAssign.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 space-y-1 text-center">
                  <p className="font-bold">لا توجد مقررات دراسية معتمدة تطابق هذا الاختيار</p>
                  <p className="text-[11px] text-muted-foreground">
                    يرجى تغيير فلتر المرحلة أو الصف أعلاه، أو اعتماد مناهج جديدة من صفحة "المناهج والمقررات".
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    required
                    value={assignForm.adoptedCurriculumId}
                    onChange={(e) => setAssignForm({ ...assignForm, adoptedCurriculumId: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-bold text-foreground"
                  >
                    <option value="">-- اضغط لاختيار المادة المحددة بدقة --</option>
                    {filteredCurriculaForAssign.map((curr) => {
                      const subName = curr.curriculum_edition?.definition?.subject?.name;
                      const defName = curr.curriculum_edition?.definition?.name;
                      const subjectName = subName || defName || 'مادة دراسية';
                      const { gradeName, progName } = getCurriculumGradeInfo(curr);
                      const label = `📚 ${subjectName} ⟵ [ ${gradeName} ] ${progName ? `(${progName})` : ''}`;
                      return (
                        <option key={curr.id} value={curr.id}>
                          {label} {curr.weekly_sessions_count ? `• ${curr.weekly_sessions_count} حصص أسبوعياً` : ''}
                        </option>
                      );
                    })}
                  </select>

                  {/* Visual Selected Badge Card */}
                  {assignForm.adoptedCurriculumId && (() => {
                    const sel = filteredCurriculaForAssign.find((c) => c.id === assignForm.adoptedCurriculumId);
                    if (!sel) return null;
                    const subName = sel.curriculum_edition?.definition?.subject?.name || sel.curriculum_edition?.definition?.name || 'مادة دراسية';
                    const { gradeName, progName } = getCurriculumGradeInfo(sel);
                    return (
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-black text-foreground block text-sm">{subName}</span>
                            <span className="text-[11px] text-muted-foreground block">
                              الصف: <strong className="text-foreground">{gradeName}</strong> • المرحلة: <strong className="text-foreground">{progName}</strong>
                            </span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {sel.weekly_sessions_count || 4} حصص/أسبوع
                        </Badge>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">تاريخ بدء التكليف *</Label>
              <Input
                type="date"
                required
                value={assignForm.startDate}
                onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-2 text-right">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="lead-teacher-toggle" className="text-xs font-bold text-foreground block cursor-pointer">
                    تعيين كمدرس أساسي للمقرر
                  </Label>
                  <span className="text-[11px] text-muted-foreground block">
                    المدرس الأساسي يكون مسؤولاً عن وضع الخطة والتقييمات الفصلية
                  </span>
                </div>
                <input
                  id="lead-teacher-toggle"
                  type="checkbox"
                  checked={assignForm.isLeadTeacher}
                  onChange={(e) => setAssignForm({ ...assignForm, isLeadTeacher: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                />
              </div>
            </div>

        </div>
      </AppModal>
    </div>
  );
};
