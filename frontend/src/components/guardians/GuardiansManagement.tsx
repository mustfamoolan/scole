import React, { useState, useMemo, useEffect } from 'react';
import { apiRequest, AppAPIError } from '../../api/client';
import { GuardianProfileDTO, StudentProfile } from '../../types';
import { ErrorAlert, DataGrid, DataGridColumn, AppModal } from '../common';
import {
  Card,
  Button,
  Input,
  Label,
  Badge,
  Avatar,
  AvatarFallback,
} from '@/components/ui';

import {
  HeartHandshake,
  UserPlus,
  Search,
  X,
  RotateCcw,
  KeyRound,
  Copy,
  Phone,
  GraduationCap,
  Plus,
  CheckCircle2,
  Link as LinkIcon,
  Check,
} from 'lucide-react';

interface GuardiansManagementProps {
  onUpdated?: () => void;
}

export const GuardiansManagement: React.FC<GuardiansManagementProps> = ({ onUpdated }) => {
  const [guardians, setGuardians] = useState<GuardianProfileDTO[]>([]);
  const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Add Guardian Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [guardianForm, setGuardianForm] = useState({
    firstName: '',
    fatherName: '',
    lastName: '',
    phone: '',
    occupation: '',
    relationshipType: 'father',
    selectedStudentIds: [] as string[],
  });

  // Link Student to Existing Guardian Modal
  const [linkingGuardian, setLinkingGuardian] = useState<GuardianProfileDTO | null>(null);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkRelationType, setLinkRelationType] = useState('father');
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  // Unlink loading state
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setSuccessNotice(`تم نسخ كود الدخول الخاص بـ ${label}: ${text}`);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  // Fetch guardians
  const fetchGuardians = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: GuardianProfileDTO[] }>(
        '/api/v1/tenant/admin/guardians'
      );
      if (res?.data) {
        setGuardians(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل استرجاع سجلات أولياء الأمور' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch students for linking
  const fetchStudents = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: StudentProfile[] }>(
        '/api/v1/tenant/admin/students'
      );
      if (res?.data) {
        setAllStudents(res.data);
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchGuardians();
    fetchStudents();
  }, []);

  // Filtered guardians
  const filteredGuardians = useMemo(() => {
    if (!searchQuery.trim()) return guardians;
    const q = searchQuery.toLowerCase();
    return guardians.filter((g) => {
      const name = g.full_name?.toLowerCase() || '';
      const phone = g.phone || '';
      const code = g.access_code?.toLowerCase() || '';
      const matchesStudent = g.students?.some((s) =>
        s.student_name?.toLowerCase().includes(q) || s.student_number?.toLowerCase().includes(q)
      );
      return name.includes(q) || phone.includes(q) || code.includes(q) || matchesStudent;
    });
  }, [guardians, searchQuery]);

  // Handle Add Guardian
  const handleCreateGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianForm.firstName.trim() || !guardianForm.lastName.trim()) {
      setError({ message: 'يرجى إدخال الاسم الأول واللقب' });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/guardians', {
        method: 'POST',
        body: JSON.stringify({
          first_name: guardianForm.firstName.trim(),
          father_name: guardianForm.fatherName.trim() || undefined,
          last_name: guardianForm.lastName.trim(),
          phone: guardianForm.phone.trim() || undefined,
          occupation: guardianForm.occupation.trim() || undefined,
          student_ids: guardianForm.selectedStudentIds,
          relationship_type: guardianForm.relationshipType,
        }),
      });

      setSuccessNotice('تم إنشاء حساب ولي الأمر بنجاح وتوليد كود التطبيق');
      setShowAddModal(false);
      setGuardianForm({
        firstName: '',
        fatherName: '',
        lastName: '',
        phone: '',
        occupation: '',
        relationshipType: 'father',
        selectedStudentIds: [],
      });
      await fetchGuardians();
      onUpdated?.();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل حفظ بيانات ولي الأمر' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Link Student to existing guardian
  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingGuardian || !linkStudentId) return;

    setLinkSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/v1/tenant/admin/guardians/link-student', {
        method: 'POST',
        body: JSON.stringify({
          guardian_person_id: linkingGuardian.person_id,
          student_profile_id: linkStudentId,
          relationship_type: linkRelationType,
        }),
      });

      setSuccessNotice(`تم ربط الطالب بـ ${linkingGuardian.full_name} بنجاح`);
      setLinkingGuardian(null);
      setLinkStudentId('');
      await fetchGuardians();
      onUpdated?.();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل ربط الطالب بولي الأمر' });
      }
    } finally {
      setLinkSubmitting(false);
    }
  };

  // Handle Unlink Student
  const handleUnlink = async (relationId: string, guardianName: string, studentName: string) => {
    if (!confirm(`هل أنت متأكد من فك ارتباط الطالب (${studentName}) بولي الأمر (${guardianName})؟`)) {
      return;
    }

    setUnlinkingId(relationId);
    setError(null);
    try {
      await apiRequest(`/api/v1/tenant/admin/guardians/relations/${relationId}`, {
        method: 'DELETE',
      });
      setSuccessNotice(`تم فك ارتباط ${studentName} بنجاح`);
      await fetchGuardians();
      onUpdated?.();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({ message: 'فشل فك ارتباط الطالب' });
      }
    } finally {
      setUnlinkingId(null);
    }
  };

  // Toggle student selection during new guardian registration
  const toggleStudentSelection = (studentId: string) => {
    setGuardianForm((prev) => {
      const exists = prev.selectedStudentIds.includes(studentId);
      return {
        ...prev,
        selectedStudentIds: exists
          ? prev.selectedStudentIds.filter((id) => id !== studentId)
          : [...prev.selectedStudentIds, studentId],
      };
    });
  };

  // Relation labels helper
  const getRelationLabel = (type: string) => {
    switch (type) {
      case 'father':
        return 'أب';
      case 'mother':
        return 'أم';
      case 'brother':
        return 'أخ';
      case 'uncle':
        return 'عم/خال';
      default:
        return 'ولي أمر';
    }
  };

  // Table Columns
  const columns: DataGridColumn<GuardianProfileDTO>[] = [
    {
      key: 'guardian_info',
      header: 'ولي الأمر',
      render: (row: GuardianProfileDTO) => (
        <div className="flex items-center gap-3 py-1">
          <Avatar className="h-9 w-9 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold shrink-0">
            <AvatarFallback>{row.first_name?.[0] || 'و'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-bold text-foreground text-xs truncate">{row.full_name}</div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              {row.phone ? (
                <span className="font-mono flex items-center gap-1" dir="ltr">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  {row.phone}
                </span>
              ) : (
                <span>لا يوجد هاتف</span>
              )}
              {row.occupation && (
                <>
                  <span>•</span>
                  <span>{row.occupation}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'access_code',
      header: 'كود تطبيق ولي الأمر',
      render: (row: GuardianProfileDTO) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 shadow-2xs">
            {row.access_code || '—'}
          </span>
          {row.access_code && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-indigo-600"
              onClick={() => copyToClipboard(row.access_code, `ولي الأمر ${row.full_name}`)}
              title="نسخ كود الدخول"
            >
              {copiedCode === row.access_code ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
        </div>
      ),
    },
    {
      key: 'linked_students',
      header: 'الطلاب المرتبطون (الأبناء)',
      render: (row: GuardianProfileDTO) => {
        const students = row.students || [];
        return (
          <div className="flex flex-wrap items-center gap-1.5 py-1">
            {students.length === 0 ? (
              <span className="text-[11px] text-muted-foreground italic">لم يتم ربط طلاب بعد</span>
            ) : (
              students.map((st) => (
                <Badge
                  key={st.relation_id}
                  variant="outline"
                  className="bg-background text-foreground border-border hover:border-primary/50 text-[11px] font-medium py-1 px-2 gap-1.5 rounded-lg group shadow-2xs"
                >
                  <GraduationCap className="w-3 h-3 text-primary shrink-0" />
                  <span>{st.student_name}</span>
                  <span className="text-muted-foreground text-[10px]">
                    ({getRelationLabel(st.relationship_type)})
                  </span>
                  <button
                    onClick={() => handleUnlink(st.relation_id, row.full_name, st.student_name)}
                    disabled={unlinkingId === st.relation_id}
                    title="فك ارتباط الطالب"
                    className="opacity-40 group-hover:opacity-100 hover:text-destructive transition-opacity mr-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLinkingGuardian(row);
                setLinkStudentId('');
              }}
              className="h-6 px-2 text-[10px] font-bold gap-1 rounded-md border-dashed text-primary hover:bg-primary/5"
            >
              <Plus className="w-3 h-3" />
              ربط طالب
            </Button>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'left',
      render: (row: GuardianProfileDTO) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLinkingGuardian(row);
              setLinkStudentId('');
            }}
            className="h-7 text-xs font-bold gap-1"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            إضافة طالب
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
        <ErrorAlert
          message={error.message}
          requestId={error.requestId}
          onDismiss={() => setError(null)}
        />
      )}

      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">إدارة أولياء الأمور</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                سجلات أولياء الأمور، كود الدخول لتطبيق الهاتف، وربط الأبناء بمختلف المراحل الدراسية
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-stretch md:self-auto">
          <Button
            onClick={() => setShowAddModal(true)}
            className="font-bold text-xs gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            إنشاء ولي أمر جديد
          </Button>
        </div>
      </div>

      {/* Search & Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="shadow-xs p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">إجمالي أولياء الأمور</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{guardians.length}</div>
          <div className="text-[10px] text-muted-foreground mt-1">حسابات مسجلة بالمعهد</div>
        </Card>

        <Card className="shadow-xs p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">أولياء أمور بأبناء مرتبطين</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {guardians.filter((g) => g.students && g.students.length > 0).length}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">مرتبطون بطلاب في المعهد</div>
        </Card>

        <Card className="shadow-xs p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">أكواد الدخول النشطة</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">
            {guardians.filter((g) => g.access_code).length}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">جاهزة للاستخدام في تطبيق الولي</div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم ولي الأمر، رقم الهاتف، كود الدخول، أو اسم الطالب المرتبط..."
            className="pr-9 text-xs h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchGuardians}
          disabled={loading}
          className="h-9 px-3 text-xs font-bold gap-1"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* Main DataGrid */}
      <DataGrid
        data={filteredGuardians}
        columns={columns}
        keyExtractor={(item) => item.id}
        loading={loading}
        pageSize={15}
        emptyTitle="لم يتم العثور على سجلات أولياء أمور"
        emptyDescription={
          searchQuery
            ? 'لا توجد نتائج تطابق معايير البحث الحالية'
            : 'ابدأ بإنشاء أول حساب ولي أمر لربط أبنائه بمختلف المراحل الدراسية'
        }
        emptyAction={
          !searchQuery ? (
            <Button
              onClick={() => setShowAddModal(true)}
              size="sm"
              className="font-bold text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <UserPlus className="w-4 h-4" />
              إنشاء ولي أمر جديد
            </Button>
          ) : undefined
        }
      />

      {/* SIMPLE ADD GUARDIAN MODAL */}
      <AppModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        size="lg"
        icon={<HeartHandshake className="w-5 h-5 text-indigo-600" />}
        title="إنشاء حساب ولي أمر جديد"
        description="بيانات مبسطة وسريعة لولي الأمر مع توليد كود دخول فوري لتطبيق الهاتف، وإمكانية ربطه بعدة طلاب بمختلف المراحل"
        onSubmit={handleCreateGuardian}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(false)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting ? 'جاري الحفظ...' : 'تأكيد وحفظ ولي الأمر'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">الاسم الأول *</Label>
                <Input
                  required
                  value={guardianForm.firstName}
                  onChange={(e) => setGuardianForm({ ...guardianForm, firstName: e.target.value })}
                  placeholder="مثال: أحمد"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">اسم الأب</Label>
                <Input
                  value={guardianForm.fatherName}
                  onChange={(e) => setGuardianForm({ ...guardianForm, fatherName: e.target.value })}
                  placeholder="مثال: كاظم"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">اللقب / العائلة *</Label>
                <Input
                  required
                  value={guardianForm.lastName}
                  onChange={(e) => setGuardianForm({ ...guardianForm, lastName: e.target.value })}
                  placeholder="مثال: التميمي"
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Phone & Occupation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">رقم الهاتف للتواصل</Label>
                <Input
                  type="text"
                  dir="ltr"
                  value={guardianForm.phone}
                  onChange={(e) => setGuardianForm({ ...guardianForm, phone: e.target.value })}
                  placeholder="07701234567"
                  className="font-mono text-xs h-9"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="text-xs font-semibold">المهنة / الصفة (اختياري)</Label>
                <Input
                  value={guardianForm.occupation}
                  onChange={(e) => setGuardianForm({ ...guardianForm, occupation: e.target.value })}
                  placeholder="مثال: موظف، كاسب، مهندس..."
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Relationship Type */}
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">صلة القرابة بالطلاب المحددين</Label>
              <select
                value={guardianForm.relationshipType}
                onChange={(e) => setGuardianForm({ ...guardianForm, relationshipType: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="father">أب (الأب)</option>
                <option value="mother">أم (الأم)</option>
                <option value="brother">أخ (الأخ)</option>
                <option value="uncle">عم أو خال</option>
                <option value="other">ولي أمر آخر</option>
              </select>
            </div>

            {/* Multi-student selection across grades */}
            <div className="space-y-2 text-right pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  تحديد الأبناء المرتبطين (يمكن اختيار أكثر من طالب بمختلف المراحل)
                </Label>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
                  تم تحديد {guardianForm.selectedStudentIds.length} طالب
                </span>
              </div>

              {allStudents.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                  لا توجد سجلات طلاب مسجلة حالياً في المعهد
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2 bg-secondary/10">
                  {allStudents.map((st) => {
                    const stName = st.person
                      ? `${st.person.first_name} ${st.person.father_name || ''} ${st.person.last_name}`
                      : st.student_number;
                    const isSelected = guardianForm.selectedStudentIds.includes(st.id);

                    return (
                      <div
                        key={st.id}
                        onClick={() => toggleStudentSelection(st.id)}
                        className={`p-2 rounded-md border flex items-center justify-between cursor-pointer text-xs transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800 font-bold'
                            : 'border-border bg-card hover:bg-secondary/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-input bg-background'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-foreground">{stName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({st.student_number})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {st.grade_name && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                              {st.grade_name}
                            </Badge>
                          )}
                          {st.program_name && (
                            <span className="text-muted-foreground">{st.program_name}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

        </div>
      </AppModal>

      {/* LINK STUDENT MODAL */}
      <AppModal
        open={Boolean(linkingGuardian)}
        onOpenChange={(open) => {
          if (!open) {
            setLinkingGuardian(null);
            setLinkStudentId('');
          }
        }}
        size="md"
        icon={<LinkIcon className="w-5 h-5 text-primary" />}
        title="ربط طالب بولي الأمر"
        description={
          linkingGuardian
            ? `ربط طالب من طلاب المعهد بحساب ولي الأمر (${linkingGuardian.full_name})`
            : undefined
        }
        onSubmit={handleLinkStudent}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLinkingGuardian(null)}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={linkSubmitting || !linkStudentId}
              className="text-xs font-bold"
            >
              {linkSubmitting ? 'جاري الربط...' : 'تأكيد ربط الطالب'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">اختر الطالب من المعهد *</Label>
              <select
                required
                value={linkStudentId}
                onChange={(e) => setLinkStudentId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- حدد الطالب --</option>
                {allStudents.map((st) => {
                  const stName = st.person
                    ? `${st.person.first_name} ${st.person.father_name || ''} ${st.person.last_name}`
                    : st.student_number;
                  const alreadyLinked = linkingGuardian?.students?.some((s) => s.student_id === st.id);
                  return (
                    <option key={st.id} value={st.id} disabled={alreadyLinked}>
                      {stName} ({st.grade_name || 'بدون صف'} - {st.student_number}){' '}
                      {alreadyLinked ? '✓ مرتبط مسبقاً' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="text-xs font-semibold">صلة القرابة</Label>
              <select
                value={linkRelationType}
                onChange={(e) => setLinkRelationType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="father">أب (الأب)</option>
                <option value="mother">أم (الأم)</option>
                <option value="brother">أخ (الأخ)</option>
                <option value="uncle">عم أو خال</option>
                <option value="other">ولي أمر آخر</option>
              </select>
            </div>

        </div>
      </AppModal>
    </div>
  );
};
