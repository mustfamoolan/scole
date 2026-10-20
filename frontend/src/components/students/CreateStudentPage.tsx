import React, { useState, useMemo, useEffect } from 'react';
import { apiRequest, AppAPIError } from '../../api/client';
import { EducationalProgram, StudyGrade, ClassSection, GuardianProfileDTO, StudentProfile } from '../../types';
import { ErrorAlert } from '../common';
import {
  Button,
  Input,
  Label,
  Badge,
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui';

import {
  ArrowRight,
  UserPlus,
  Users,
  MapPin,
  FileText,
  ShieldCheck,
  School,
  HeartPulse,
  HeartHandshake,
  Search,
  Sparkles,
  Plus,
  Check,
  X,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Upload,
  Camera,
  Image as ImageIcon,
  Eye,
  Trash2,
  Pencil,
} from 'lucide-react';

const IRAQI_GOVERNORATES = [
  'بغداد',
  'البصرة',
  'نينوى (الموصل)',
  'أربيل',
  'النجف الأشرف',
  'كربلاء المقدسة',
  'بابل (الحلة)',
  'ذي قار (الناصرية)',
  'الأنبار',
  'ديالى',
  'كركوك',
  'صلاح الدين (تكريت)',
  'ميسان (العمارة)',
  'واسط (الكوت)',
  'المثنى (السماوة)',
  'القادسية (الديوانية)',
  'السليمانية',
  'دهوك',
];

const BLOOD_TYPES = ['غير محدد', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

interface CreateStudentPageProps {
  onBack: () => void;
  onSuccess: () => void;
  onNavigateToGuardians?: () => void;
  programs: EducationalProgram[];
  grades: StudyGrade[];
  sections: ClassSection[];
  guardians: GuardianProfileDTO[];
  onRefreshData?: () => void;
  mode?: 'create' | 'edit';
  studentToEdit?: StudentProfile | null;
}

export const CreateStudentPage: React.FC<CreateStudentPageProps> = ({
  onBack,
  onSuccess,
  onNavigateToGuardians,
  programs,
  grades,
  sections,
  guardians,
  onRefreshData,
  mode = 'create',
  studentToEdit,
}) => {
  const isEdit = mode === 'edit' && Boolean(studentToEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);

  // Compute initial academic placement (program, grade, section)
  const initialAcademic = useMemo(() => {
    if (!studentToEdit) return { programId: '', gradeId: '', sectionId: '' };
    let secId = studentToEdit.section_id || '';
    let grId = studentToEdit.grade_id || '';
    let prId = studentToEdit.program_id || '';

    if (!secId && studentToEdit.section_name) {
      const matchSec = sections.find((s) => s.name === studentToEdit.section_name);
      if (matchSec) secId = matchSec.id;
    }
    if (!grId && secId) {
      const matchSec = sections.find((s) => s.id === secId);
      if (matchSec) grId = matchSec.study_grade_id || matchSec.grade_id || '';
    }
    if (!grId && studentToEdit.grade_name) {
      const matchGr = grades.find((g) => g.name === studentToEdit.grade_name);
      if (matchGr) grId = matchGr.id;
    }
    if (!prId && grId) {
      const matchGr = grades.find((g) => g.id === grId);
      if (matchGr) prId = matchGr.educational_program_id || matchGr.program_id || '';
    }
    if (!prId && studentToEdit.program_name) {
      const matchPr = programs.find((p) => p.name === studentToEdit.program_name);
      if (matchPr) prId = matchPr.id;
    }

    return { programId: prId, gradeId: grId, sectionId: secId };
  }, [studentToEdit, sections, grades, programs]);

  // Form State
  const [form, setForm] = useState(() => ({
    firstName: studentToEdit?.person?.first_name || '',
    fatherName: studentToEdit?.person?.father_name || '',
    grandfatherName: studentToEdit?.person?.grandfather_name || '',
    lastName: studentToEdit?.person?.last_name || '',
    gender: studentToEdit?.person?.gender || 'male',
    dateOfBirth: studentToEdit?.person?.date_of_birth ? studentToEdit.person.date_of_birth.substring(0, 10) : '',
    placeOfBirth: studentToEdit?.person?.place_of_birth || '',
    bloodType: studentToEdit?.person?.blood_type || '',
    nationalIdNumber: studentToEdit?.person?.national_id_number || studentToEdit?.person?.national_id || '',
    phone: studentToEdit?.phone || studentToEdit?.person?.phone || (studentToEdit?.person?.communication_channels?.[0]?.channel_value) || '',
    programId: initialAcademic.programId,
    gradeId: initialAcademic.gradeId,
    sectionId: initialAcademic.sectionId,
    existingGuardianPersonId: studentToEdit?.guardians_info?.[0]?.person_id || '',
    relationshipType: studentToEdit?.guardians_info?.[0]?.relationship_type || 'father',

    // Iraqi Registry fields
    generalRegisterNumber: studentToEdit?.general_register_number || '',
    motherName: studentToEdit?.person?.mother_name || '',
    motherFatherName: studentToEdit?.person?.mother_father_name || '',
    governorate: studentToEdit?.person?.governorate || 'بغداد',
    cityDistrict: studentToEdit?.person?.city_district || '',
    neighborhood: studentToEdit?.person?.neighborhood || '',
    streetAlley: studentToEdit?.person?.street_alley || '',
    houseNumber: studentToEdit?.person?.house_number || '',
    nearestLandmark: studentToEdit?.person?.nearest_landmark || '',
    previousSchool: studentToEdit?.previous_school || '',
    graduationDocNumber: studentToEdit?.graduation_doc_number || '',
    identityDocType: studentToEdit?.identity_doc_type || 'national_id',
    civilVolume: studentToEdit?.civil_volume || '',
    civilPage: studentToEdit?.civil_page || '',
    emergencyContactName: studentToEdit?.emergency_contact_name || '',
    emergencyContactPhone: studentToEdit?.emergency_contact_phone || '',
    healthStatus: studentToEdit?.health_status || 'سليم معافى',
    medicalNotes: studentToEdit?.medical_notes || '',

    // Student photo & Identity documents (هوية الأحوال / البطاقة الوطنية وجهين)
    photoUrl: studentToEdit?.photo_url || '',
    idCardFrontUrl: studentToEdit?.id_card_front_url || '',
    idCardBackUrl: studentToEdit?.id_card_back_url || '',
    guardianIdFrontUrl: studentToEdit?.guardian_id_front_url || '',
    guardianIdBackUrl: studentToEdit?.guardian_id_back_url || '',
  }));

  // Local image previews & upload status
  const [photoPreview, setPhotoPreview] = useState<string | null>(studentToEdit?.photo_url || null);
  const [idCardFrontPreview, setIdCardFrontPreview] = useState<string | null>(studentToEdit?.id_card_front_url || null);
  const [idCardBackPreview, setIdCardBackPreview] = useState<string | null>(studentToEdit?.id_card_back_url || null);
  const [guardianIdFrontPreview, setGuardianIdFrontPreview] = useState<string | null>(studentToEdit?.guardian_id_front_url || null);
  const [guardianIdBackPreview, setGuardianIdBackPreview] = useState<string | null>(studentToEdit?.guardian_id_back_url || null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<{ url: string; title: string } | null>(null);

  // Sync form state when studentToEdit changes
  useEffect(() => {
    if (studentToEdit) {
      setForm({
        firstName: studentToEdit.person?.first_name || '',
        fatherName: studentToEdit.person?.father_name || '',
        grandfatherName: studentToEdit.person?.grandfather_name || '',
        lastName: studentToEdit.person?.last_name || '',
        gender: studentToEdit.person?.gender || 'male',
        dateOfBirth: studentToEdit.person?.date_of_birth ? studentToEdit.person.date_of_birth.substring(0, 10) : '',
        placeOfBirth: studentToEdit.person?.place_of_birth || '',
        bloodType: studentToEdit.person?.blood_type || '',
        nationalIdNumber: studentToEdit.person?.national_id_number || studentToEdit.person?.national_id || '',
        phone: studentToEdit.phone || studentToEdit.person?.phone || (studentToEdit.person?.communication_channels?.[0]?.channel_value) || '',
        programId: initialAcademic.programId,
        gradeId: initialAcademic.gradeId,
        sectionId: initialAcademic.sectionId,
        existingGuardianPersonId: studentToEdit.guardians_info?.[0]?.person_id || '',
        relationshipType: studentToEdit.guardians_info?.[0]?.relationship_type || 'father',

        generalRegisterNumber: studentToEdit.general_register_number || '',
        motherName: studentToEdit.person?.mother_name || '',
        motherFatherName: studentToEdit.person?.mother_father_name || '',
        governorate: studentToEdit.person?.governorate || 'بغداد',
        cityDistrict: studentToEdit.person?.city_district || '',
        neighborhood: studentToEdit.person?.neighborhood || '',
        streetAlley: studentToEdit.person?.street_alley || '',
        houseNumber: studentToEdit.person?.house_number || '',
        nearestLandmark: studentToEdit.person?.nearest_landmark || '',
        previousSchool: studentToEdit.previous_school || '',
        graduationDocNumber: studentToEdit.graduation_doc_number || '',
        identityDocType: studentToEdit.identity_doc_type || 'national_id',
        civilVolume: studentToEdit.civil_volume || '',
        civilPage: studentToEdit.civil_page || '',
        emergencyContactName: studentToEdit.emergency_contact_name || '',
        emergencyContactPhone: studentToEdit.emergency_contact_phone || '',
        healthStatus: studentToEdit.health_status || 'سليم معافى',
        medicalNotes: studentToEdit.medical_notes || '',

        photoUrl: studentToEdit.photo_url || '',
        idCardFrontUrl: studentToEdit.id_card_front_url || '',
        idCardBackUrl: studentToEdit.id_card_back_url || '',
        guardianIdFrontUrl: studentToEdit.guardian_id_front_url || '',
        guardianIdBackUrl: studentToEdit.guardian_id_back_url || '',
      });

      setPhotoPreview(studentToEdit.photo_url || null);
      setIdCardFrontPreview(studentToEdit.id_card_front_url || null);
      setIdCardBackPreview(studentToEdit.id_card_back_url || null);
      setGuardianIdFrontPreview(studentToEdit.guardian_id_front_url || null);
      setGuardianIdBackPreview(studentToEdit.guardian_id_back_url || null);

      if (studentToEdit.guardians_info && studentToEdit.guardians_info.length > 0) {
        setGuardianMode('search');
      }
    }
  }, [studentToEdit, initialAcademic]);

  // Document upload handler
  const handleUploadFile = async (
    file: File,
    docType: 'photo' | 'student_id_front' | 'student_id_back' | 'guardian_id_front' | 'guardian_id_back'
  ) => {
    // Immediate local preview for responsive UX
    const localUrl = URL.createObjectURL(file);
    if (docType === 'photo') setPhotoPreview(localUrl);
    if (docType === 'student_id_front') setIdCardFrontPreview(localUrl);
    if (docType === 'student_id_back') setIdCardBackPreview(localUrl);
    if (docType === 'guardian_id_front') setGuardianIdFrontPreview(localUrl);
    if (docType === 'guardian_id_back') setGuardianIdBackPreview(localUrl);

    setUploadingDoc(docType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', docType);

      const res = await apiRequest<{ success: boolean; url: string }>(
        '/api/v1/tenant/admin/students/upload-document',
        {
          method: 'POST',
          body: formData,
        }
      );

      if (res?.url) {
        if (docType === 'photo') setForm((prev) => ({ ...prev, photoUrl: res.url }));
        if (docType === 'student_id_front') setForm((prev) => ({ ...prev, idCardFrontUrl: res.url }));
        if (docType === 'student_id_back') setForm((prev) => ({ ...prev, idCardBackUrl: res.url }));
        if (docType === 'guardian_id_front') setForm((prev) => ({ ...prev, guardianIdFrontUrl: res.url }));
        if (docType === 'guardian_id_back') setForm((prev) => ({ ...prev, guardianIdBackUrl: res.url }));
      }
    } catch (uploadErr) {
      console.error('Failed to upload document:', uploadErr);
      setError({ message: 'فشل رفع المستند إلى الخادم، يرجى المحاولة مرة أخرى' });
    } finally {
      setUploadingDoc(null);
    }
  };

  // Guardian Mode
  const [guardianMode, setGuardianMode] = useState<'none' | 'search' | 'new'>('none');
  const [guardianSearchQuery, setGuardianSearchQuery] = useState('');
  const [newGuardianForm, setNewGuardianForm] = useState({
    firstName: '',
    fatherName: '',
    lastName: '',
    phone: '',
    occupation: '',
    relationshipType: 'father',
  });

  // Filtered grades and sections
  const availableGrades = useMemo(() => {
    if (!form.programId) return [];
    return grades.filter((g) => (g.educational_program_id || g.program_id) === form.programId);
  }, [form.programId, grades]);

  const availableSections = useMemo(() => {
    if (!form.gradeId) return [];
    return sections.filter((s) => (s.study_grade_id || s.grade_id) === form.gradeId);
  }, [form.gradeId, sections]);

  // Guardian search results
  const searchMatchingGuardians = useMemo(() => {
    if (!guardianSearchQuery.trim()) return guardians.slice(0, 8);
    const q = guardianSearchQuery.toLowerCase();
    return guardians.filter(
      (g) =>
        g.full_name?.toLowerCase().includes(q) ||
        g.phone?.includes(q) ||
        g.access_code?.toLowerCase().includes(q)
    );
  }, [guardians, guardianSearchQuery]);

  // Selected guardian details
  const selectedGuardian = useMemo(() => {
    if (!form.existingGuardianPersonId) return null;
    return guardians.find((g) => g.person_id === form.existingGuardianPersonId) || null;
  }, [guardians, form.existingGuardianPersonId]);

  // Calculate completeness progress
  const completeness = useMemo(() => {
    let score = 0;
    const total = 9;
    if (form.firstName.trim() && form.lastName.trim()) score += 2;
    if (form.fatherName.trim()) score += 1;
    if (form.programId && form.gradeId) score += 2;
    if (form.generalRegisterNumber.trim()) score += 1;
    if (form.motherName.trim()) score += 1;
    if (form.governorate && form.neighborhood.trim()) score += 1;
    if (guardianMode !== 'none') score += 1;
    return Math.min(100, Math.round((score / total) * 100));
  }, [form, guardianMode]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError({ message: 'الاسم الأول واللقب مطلوبان لتسجيل الطالب' });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        first_name: form.firstName.trim(),
        father_name: form.fatherName.trim() || undefined,
        grandfather_name: form.grandfatherName.trim() || undefined,
        last_name: form.lastName.trim(),
        gender: form.gender,
        date_of_birth: form.dateOfBirth ? `${form.dateOfBirth}T00:00:00Z` : undefined,
        place_of_birth: form.placeOfBirth.trim() || undefined,
        blood_type: form.bloodType && form.bloodType !== 'غير محدد' ? form.bloodType : undefined,
        national_id_number: form.nationalIdNumber.trim() || undefined,
        phone: form.phone.trim() || undefined,
        medical_notes: form.medicalNotes.trim() || undefined,
        section_id: form.sectionId || undefined,
        class_section_id: form.sectionId || undefined,
        grade_id: form.gradeId || undefined,
        study_grade_id: form.gradeId || undefined,

        // Iraqi Registry Fields
        general_register_number: form.generalRegisterNumber.trim() || undefined,
        mother_name: form.motherName.trim() || undefined,
        mother_father_name: form.motherFatherName.trim() || undefined,
        governorate: form.governorate || undefined,
        city_district: form.cityDistrict.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        street_alley: form.streetAlley.trim() || undefined,
        house_number: form.houseNumber.trim() || undefined,
        nearest_landmark: form.nearestLandmark.trim() || undefined,
        previous_school: form.previousSchool.trim() || undefined,
        graduation_doc_number: form.graduationDocNumber.trim() || undefined,
        identity_doc_type: form.identityDocType || undefined,
        civil_volume: form.civilVolume.trim() || undefined,
        civil_page: form.civilPage.trim() || undefined,
        emergency_contact_name: form.emergencyContactName.trim() || undefined,
        emergency_contact_phone: form.emergencyContactPhone.trim() || undefined,
        health_status: form.healthStatus.trim() || undefined,
        photo_url: form.photoUrl.trim() || undefined,
        id_card_front_url: form.idCardFrontUrl.trim() || undefined,
        id_card_back_url: form.idCardBackUrl.trim() || undefined,
        guardian_id_front_url: form.guardianIdFrontUrl.trim() || undefined,
        guardian_id_back_url: form.guardianIdBackUrl.trim() || undefined,
      };

      // Guardian Integration
      if (guardianMode === 'search' && form.existingGuardianPersonId) {
        payload.existing_guardian_person_id = form.existingGuardianPersonId;
        payload.existing_guardian_relationship_type = form.relationshipType || 'father';
      } else if (
        guardianMode === 'new' &&
        newGuardianForm.firstName.trim() &&
        newGuardianForm.lastName.trim()
      ) {
        payload.guardian = {
          first_name: newGuardianForm.firstName.trim(),
          father_name: newGuardianForm.fatherName.trim() || undefined,
          last_name: newGuardianForm.lastName.trim(),
          phone: newGuardianForm.phone.trim(),
          occupation: newGuardianForm.occupation.trim() || undefined,
          relationship_type: newGuardianForm.relationshipType || 'father',
        };
      }

      if (isEdit && studentToEdit) {
        await apiRequest<{ success: boolean; data: StudentProfile }>(
          `/api/v1/tenant/admin/students/${studentToEdit.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiRequest<{ success: boolean; data: StudentProfile }>(
          '/api/v1/tenant/admin/students',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );
      }

      if (onRefreshData) onRefreshData();
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof AppAPIError) {
        setError({ message: err.message, requestId: err.requestId });
      } else {
        setError({
          message: isEdit
            ? 'فشل تحديث بيانات الطالب، يرجى التحقق من صحة المدخلات'
            : 'فشل تسجيل وقبول الطالب، يرجى التحقق من صحة المدخلات',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16" dir="rtl">
      {/* 1. Page Header with Back Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1.5">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-1"
          >
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            <span>العودة إلى سجل شؤون الطلاب</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {isEdit ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                <span>
                  {isEdit
                    ? `تعديل بيانات الطالب: ${form.firstName} ${form.lastName}`
                    : 'استمارة تسجيل وقبول طالب جديد'}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5"
                >
                  {isEdit ? 'تعديل السجل' : 'السجل العام العراقي'}
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEdit
                  ? 'تحديث وتعديل بيانات السجل العام الورقي، النسب، بطاقة السكن، والتسكين الأكاديمي'
                  : 'إدخال بيانات السجل العام الورقي، النسب، بطاقة السكن، والتسكين الأكاديمي مع توليد كود الدخول'}
              </p>
            </div>
          </div>
        </div>

        {/* Top Action Bar */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={submitting}
            className="text-xs font-bold h-9"
          >
            إلغاء والعودة
          </Button>
          <Button
            type="submit"
            form="student-registration-form"
            disabled={submitting}
            className="text-xs font-bold gap-1.5 h-9 bg-primary text-primary-foreground shadow-sm"
          >
            {submitting ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>{isEdit ? 'جاري حفظ التعديلات...' : 'جاري التسجيل والقبول...'}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{isEdit ? 'حفظ التعديلات' : 'حفظ واعتماد تسجيل الطالب'}</span>
              </>
            )}
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

      {/* 2. Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Body (8 cols) */}
        <form
          id="student-registration-form"
          onSubmit={handleSubmit}
          className="lg:col-span-8 space-y-6"
        >
          {/* Section 1: البيانات الشخصية ونسب الطالب */}
          <Card className="rounded-2xl border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 bg-secondary/15 border-b border-border/80 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    1. البيانات الشخصية ونسب الطالب
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    الاسم الرباعي أو الثلاثي، اسم الأم ونسبها، والولادة
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] font-bold">الأساس الثبوتي</Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Student Personal Photo Widget */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-xl bg-primary/[0.03] border border-primary/20">
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-primary/30 bg-card overflow-hidden flex items-center justify-center shadow-xs">
                    {photoPreview || form.photoUrl ? (
                      <img
                        src={photoPreview || form.photoUrl}
                        alt="صورة الطالب"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                        <Camera className="w-6 h-6 text-primary/70 mb-1" />
                        <span className="text-[10px] font-semibold">الصورة</span>
                      </div>
                    )}
                  </div>
                  {uploadingDoc === 'photo' && (
                    <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white text-xs">
                      <RotateCcw className="w-5 h-5 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-right space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">الصورة الشخصية الرسمية للطالب</span>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      {photoPreview || form.photoUrl ? 'تم إرفاق الصورة' : 'اختياري'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    تُعتمد في بطاقة قيد الطالب وسجلات الحضور والامتحانات وتطبيق الطالب
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{photoPreview || form.photoUrl ? 'تغيير الصورة' : 'رفع صورة الطالب'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadFile(file, 'photo');
                        }}
                      />
                    </label>
                    {(photoPreview || form.photoUrl) && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPreviewModal({
                              url: photoPreview || form.photoUrl,
                              title: 'الصورة الشخصية للطالب',
                            })
                          }
                          className="h-7 text-xs gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPhotoPreview(null);
                            setForm((prev) => ({ ...prev, photoUrl: '' }));
                          }}
                          className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-right">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">الاسم الأول *</Label>
                  <Input
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="مثال: يوسف"
                    className="text-xs h-9 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">اسم الأب</Label>
                  <Input
                    value={form.fatherName}
                    onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                    placeholder="مثال: حيدر"
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">اسم الجد</Label>
                  <Input
                    value={form.grandfatherName}
                    onChange={(e) => setForm({ ...form, grandfatherName: e.target.value })}
                    placeholder="مثال: كاظم"
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">اللقب / العشيرة *</Label>
                  <Input
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="مثال: الأسدي"
                    className="text-xs h-9 font-medium"
                  />
                </div>
              </div>

              {/* Mother info & Blood type */}
              <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/80 space-y-3">
                <span className="text-xs font-bold text-foreground block">
                  نسب الأم وفصيلة الدم
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      اسم الأم <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                    </Label>
                    <Input
                      value={form.motherName}
                      onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                      placeholder="الاسم الأول للأم"
                      className="text-xs h-9 bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      اسم والد الأم (أب الأم) <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                    </Label>
                    <Input
                      value={form.motherFatherName}
                      onChange={(e) => setForm({ ...form, motherFatherName: e.target.value })}
                      placeholder="اسم جد الطالب لأمه"
                      className="text-xs h-9 bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      فصيلة الدم <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                    </Label>
                    <select
                      value={form.bloodType}
                      onChange={(e) => setForm({ ...form, bloodType: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {BLOOD_TYPES.map((bt) => (
                        <option key={bt} value={bt === 'غير محدد' ? '' : bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Gender, DOB, POB */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">الجنس *</Label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">تاريخ الميلاد</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    محل الولادة <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.placeOfBirth}
                    onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })}
                    placeholder="مثال: بغداد / الكرخ"
                    className="text-xs h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: السجل العام والمستمسكات الثبوتية بالعراق */}
          <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[0.01] shadow-xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 bg-amber-500/10 border-b border-amber-500/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-amber-950 dark:text-amber-100">
                    2. السجل العام والمستمسكات الرسمية (اختياري)
                  </CardTitle>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300 mt-0.5">
                    رقم القيد الورقي في سجلات المعهد، البطاقة الوطنية، وسجل النقل
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-800 bg-amber-50/50">
                سجل القيد الورقي
              </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1">
                    <span>رقم السجل العام (ورقي)</span>
                    <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.generalRegisterNumber}
                    onChange={(e) => setForm({ ...form, generalRegisterNumber: e.target.value })}
                    placeholder="رقم القيد في السجل الورقي"
                    className="text-xs h-9 font-mono border-amber-300/80 focus-visible:ring-amber-500 bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">نوع المستمسك الثبوتي</Label>
                  <select
                    value={form.identityDocType}
                    onChange={(e) => setForm({ ...form, identityDocType: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="national_id">بطاقة وطنية موحدة</option>
                    <option value="civil_id">هوية أحوال مدنية</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    رقم البطاقة / الهوية <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    dir="ltr"
                    value={form.nationalIdNumber}
                    onChange={(e) => setForm({ ...form, nationalIdNumber: e.target.value })}
                    placeholder="1998XXXXXXXX"
                    className="font-mono text-xs h-9 bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-right pt-3 border-t border-amber-500/10">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    رقم السجل المدني <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.civilVolume}
                    onChange={(e) => setForm({ ...form, civilVolume: e.target.value })}
                    placeholder="مثال: 452"
                    className="text-xs h-9 font-mono bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    رقم الصحيفة <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.civilPage}
                    onChange={(e) => setForm({ ...form, civilPage: e.target.value })}
                    placeholder="مثال: 18"
                    className="text-xs h-9 font-mono bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    المدرسة السابقة <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.previousSchool}
                    onChange={(e) => setForm({ ...form, previousSchool: e.target.value })}
                    placeholder="اسم المدرسة السابقة"
                    className="text-xs h-9 bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    وثيقة التخرج / كتاب النقل <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.graduationDocNumber}
                    onChange={(e) => setForm({ ...form, graduationDocNumber: e.target.value })}
                    placeholder="رقم الوثيقة أو كتاب النقل"
                    className="text-xs h-9 bg-background"
                  />
                </div>
              </div>

              {/* Identity Documents Upload (هوية الأحوال / البطاقة الوطنية وجهين) */}
              <div className="pt-4 border-t border-amber-500/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-xs font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-600" />
                    المستمسكات والوثائق المصورة (رفع هوية الأحوال / البطاقة الوطنية وجهين)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    يدعم صور JPG, PNG أو ملفات PDF
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Student National ID / Civil ID (Face 1 & Face 2) */}
                  <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/80 pb-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        هوية / بطاقة الطالب (الوجهان)
                      </span>
                      <Badge variant="outline" className="text-[10px]">مستمسك الطالب</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Student Front */}
                      <div className="space-y-1.5 text-center">
                        <span className="text-[11px] font-semibold text-muted-foreground block text-right">
                          الوجه الأمامي
                        </span>
                        <div className="relative group w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-secondary/20 overflow-hidden flex flex-col items-center justify-center transition-all">
                          {idCardFrontPreview || form.idCardFrontUrl ? (
                            <>
                              <img
                                src={idCardFrontPreview || form.idCardFrontUrl}
                                alt="وجه هوية الطالب"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setPreviewModal({
                                      url: idCardFrontPreview || form.idCardFrontUrl,
                                      title: 'وجه هوية الطالب (الأمامي)',
                                    })
                                  }
                                  className="h-6 w-6 p-0 rounded-md"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setIdCardFrontPreview(null);
                                    setForm((prev) => ({ ...prev, idCardFrontUrl: '' }));
                                  }}
                                  className="h-6 w-6 p-0 rounded-md"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-primary transition-colors">
                              <Upload className="w-5 h-5 mb-1 text-primary/70" />
                              <span className="text-[10px] font-bold">رفع الوجه الأمامي</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadFile(file, 'student_id_front');
                                }}
                              />
                            </label>
                          )}
                          {uploadingDoc === 'student_id_front' && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs">
                              <RotateCcw className="w-5 h-5 animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Student Back */}
                      <div className="space-y-1.5 text-center">
                        <span className="text-[11px] font-semibold text-muted-foreground block text-right">
                          الوجه الخلفي
                        </span>
                        <div className="relative group w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-secondary/20 overflow-hidden flex flex-col items-center justify-center transition-all">
                          {idCardBackPreview || form.idCardBackUrl ? (
                            <>
                              <img
                                src={idCardBackPreview || form.idCardBackUrl}
                                alt="ظهر هوية الطالب"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setPreviewModal({
                                      url: idCardBackPreview || form.idCardBackUrl,
                                      title: 'ظهر هوية الطالب (الخلفي)',
                                    })
                                  }
                                  className="h-6 w-6 p-0 rounded-md"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setIdCardBackPreview(null);
                                    setForm((prev) => ({ ...prev, idCardBackUrl: '' }));
                                  }}
                                  className="h-6 w-6 p-0 rounded-md"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-primary transition-colors">
                              <Upload className="w-5 h-5 mb-1 text-primary/70" />
                              <span className="text-[10px] font-bold">رفع الوجه الخلفي</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadFile(file, 'student_id_back');
                                }}
                              />
                            </label>
                          )}
                          {uploadingDoc === 'student_id_back' && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs">
                              <RotateCcw className="w-5 h-5 animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Guardian National ID / Civil ID (Face 1 & Face 2) */}
                  <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/80 pb-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-600" />
                        هوية / بطاقة الأب أو ولي الأمر (الوجهان)
                      </span>
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">مستمسك ولي الأمر</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Guardian Front */}
                      <div className="space-y-1.5 text-center">
                        <span className="text-[11px] font-semibold text-muted-foreground block text-right">
                          الوجه الأمامي
                        </span>
                        <div className="relative group w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-emerald-500/50 bg-secondary/20 overflow-hidden flex flex-col items-center justify-center transition-all">
                          {guardianIdFrontPreview || form.guardianIdFrontUrl ? (
                            <>
                              <img
                                src={guardianIdFrontPreview || form.guardianIdFrontUrl}
                                alt="وجه هوية ولي الأمر"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setPreviewModal({
                                      url: guardianIdFrontPreview || form.guardianIdFrontUrl,
                                      title: 'وجه هوية ولي الأمر (الأمامي)',
                                    })
                                  }
                                  className="h-6 w-6 p-0 rounded-md"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setGuardianIdFrontPreview(null);
                                    setForm((prev) => ({ ...prev, guardianIdFrontUrl: '' }));
                                  }}
                                  className="h-6 w-6 p-0 rounded-md"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-emerald-700 transition-colors">
                              <Upload className="w-5 h-5 mb-1 text-emerald-600" />
                              <span className="text-[10px] font-bold">رفع الوجه الأمامي</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadFile(file, 'guardian_id_front');
                                }}
                              />
                            </label>
                          )}
                          {uploadingDoc === 'guardian_id_front' && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs">
                              <RotateCcw className="w-5 h-5 animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Guardian Back */}
                      <div className="space-y-1.5 text-center">
                        <span className="text-[11px] font-semibold text-muted-foreground block text-right">
                          الوجه الخلفي
                        </span>
                        <div className="relative group w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-emerald-500/50 bg-secondary/20 overflow-hidden flex flex-col items-center justify-center transition-all">
                          {guardianIdBackPreview || form.guardianIdBackUrl ? (
                            <>
                              <img
                                src={guardianIdBackPreview || form.guardianIdBackUrl}
                                alt="ظهر هوية ولي الأمر"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setPreviewModal({
                                      url: guardianIdBackPreview || form.guardianIdBackUrl,
                                      title: 'ظهر هوية ولي الأمر (الخلفي)',
                                    })
                                  }
                                  className="h-6 w-6 p-0 rounded-md"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setGuardianIdBackPreview(null);
                                    setForm((prev) => ({ ...prev, guardianIdBackUrl: '' }));
                                  }}
                                  className="h-6 w-6 p-0 rounded-md"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-emerald-700 transition-colors">
                              <Upload className="w-5 h-5 mb-1 text-emerald-600" />
                              <span className="text-[10px] font-bold">رفع الوجه الخلفي</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadFile(file, 'guardian_id_back');
                                }}
                              />
                            </label>
                          )}
                          {uploadingDoc === 'guardian_id_back' && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs">
                              <RotateCcw className="w-5 h-5 animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: بطاقة السكن وعنوان الإقامة في العراق */}
          <Card className="rounded-2xl border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 bg-secondary/15 border-b border-border/80 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    3. بطاقة السكن وعنوان الإقامة في العراق (اختياري)
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    المحافظة، القضاء، المحلة والزقاق والدار للوصول والتواصل
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">العنوان السكني</Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">المحافظة</Label>
                  <select
                    value={form.governorate}
                    onChange={(e) => setForm({ ...form, governorate: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {IRAQI_GOVERNORATES.map((gov) => (
                      <option key={gov} value={gov}>
                        {gov}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    القضاء / المدينة <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.cityDistrict}
                    onChange={(e) => setForm({ ...form, cityDistrict: e.target.value })}
                    placeholder="مثال: الكرخ، الرصافة، الكاظمية..."
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    المنطقة / الحي / المحلة <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.neighborhood}
                    onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                    placeholder="مثال: المنصور، حي الجامعة..."
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right pt-3 border-t border-border/50">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    الزقاق <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.streetAlley}
                    onChange={(e) => setForm({ ...form, streetAlley: e.target.value })}
                    placeholder="مثال: زقاق 24"
                    className="text-xs h-9 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    رقم الدار <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.houseNumber}
                    onChange={(e) => setForm({ ...form, houseNumber: e.target.value })}
                    placeholder="مثال: دار 12"
                    className="text-xs h-9 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    أقرب نقطة دالة <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.nearestLandmark}
                    onChange={(e) => setForm({ ...form, nearestLandmark: e.target.value })}
                    placeholder="قرب جامع، مدرسة، ساحة..."
                    className="text-xs h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: التسكين الأكاديمي */}
          <Card className="rounded-2xl border-primary/20 bg-primary/[0.01] shadow-xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 bg-primary/10 border-b border-primary/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <School className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    4. التسكين الأكاديمي (المرحلة والصف والشعبة)
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    تسكين الطالب وتحديد قيده بالشعبة والصف بالمعهد
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                التسكين
              </Badge>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">المرحلة التعليمية</Label>
                  <select
                    value={form.programId}
                    onChange={(e) => {
                      setForm({ ...form, programId: e.target.value, gradeId: '', sectionId: '' });
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">-- اختر المرحلة --</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">الصف الدراسي</Label>
                  <select
                    value={form.gradeId}
                    disabled={!form.programId}
                    onChange={(e) => {
                      setForm({ ...form, gradeId: e.target.value, sectionId: '' });
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">-- اختر الصف --</option>
                    {availableGrades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">الشعبة الدراسية</Label>
                  <select
                    value={form.sectionId}
                    disabled={!form.gradeId}
                    onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">-- اختر الشعبة --</option>
                    {availableSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (سعة: {s.capacity || 30})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: ربط ولي الأمر */}
          <Card className="rounded-2xl border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 bg-secondary/15 border-b border-border/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    5. حساب ولي الأمر وتطبيق المتابعة
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    اختيار ولي أمر مسجل، أو إنشاء حساب ولي أمر فوراً
                  </p>
                </div>
              </div>

              {/* Mode Switcher Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-background rounded-lg border border-border shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setGuardianMode('none');
                    setForm({ ...form, existingGuardianPersonId: '' });
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    guardianMode === 'none'
                      ? 'bg-secondary text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  بدون ولي أمر
                </button>
                <button
                  type="button"
                  onClick={() => setGuardianMode('search')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                    guardianMode === 'search'
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>بحث واختيار</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGuardianMode('new');
                    if (!newGuardianForm.lastName && form.lastName) {
                      setNewGuardianForm((prev) => ({
                        ...prev,
                        lastName: form.lastName,
                        fatherName: form.fatherName,
                      }));
                    }
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                    guardianMode === 'new'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إنشاء جديد الآن</span>
                </button>
                {onNavigateToGuardians && (
                  <button
                    type="button"
                    onClick={onNavigateToGuardians}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all flex items-center gap-1"
                    title="الانتقال إلى سجل أولياء الأمور المعتمد"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>سجل الأولياء</span>
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {/* Mode 1: Search Existing */}
              {guardianMode === 'search' && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.02] space-y-3">
                  {form.existingGuardianPersonId && selectedGuardian ? (
                    <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          <Check className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-foreground flex items-center gap-2">
                            <span>{selectedGuardian.full_name}</span>
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {selectedGuardian.access_code}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono block mt-0.5">
                            {selectedGuardian.phone || 'بدون هاتف مسجل'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="space-y-0.5 text-right">
                          <Label className="text-[10px] text-muted-foreground block">صلة القرابة</Label>
                          <select
                            value={form.relationshipType}
                            onChange={(e) => setForm({ ...form, relationshipType: e.target.value })}
                            className="h-8 text-xs px-2.5 rounded-md border border-input bg-background font-medium"
                          >
                            <option value="father">الأب</option>
                            <option value="mother">الأم</option>
                            <option value="brother">الأخ</option>
                            <option value="uncle">العم / الخال</option>
                            <option value="guardian">وصي قانوني</option>
                          </select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setForm({ ...form, existingGuardianPersonId: '' })}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 px-2.5 mt-3"
                        >
                          تغيير الاختيار
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          type="text"
                          value={guardianSearchQuery}
                          onChange={(e) => setGuardianSearchQuery(e.target.value)}
                          placeholder="ابحث باسم ولي الأمر، رقم الهاتف، أو كود GRD..."
                          className="pr-9 pl-8 text-xs h-9 bg-background"
                        />
                        {guardianSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setGuardianSearchQuery('')}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border rounded-xl p-1.5 bg-background">
                        {searchMatchingGuardians.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">
                            لا يوجد ولي أمر يطابق بحثك. انقر على «إنشاء جديد الآن» أعلاه لإنشائه فوراً!
                          </div>
                        ) : (
                          searchMatchingGuardians.map((g) => (
                            <div
                              key={g.person_id}
                              onClick={() => {
                                setForm({ ...form, existingGuardianPersonId: g.person_id });
                              }}
                              className="p-2.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/20 cursor-pointer flex items-center justify-between text-xs transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <Avatar className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-xs shrink-0">
                                  <AvatarFallback>{g.first_name?.[0] || 'و'}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <span className="font-bold text-foreground block">{g.full_name}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {g.phone || 'بدون هاتف'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px] bg-secondary/50">
                                  {g.access_code}
                                </Badge>
                                <span className="text-xs text-primary font-bold">اختيار ✓</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Create New Guardian */}
              {guardianMode === 'new' && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 dark:bg-indigo-950/20 space-y-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      إنشاء حساب ولي أمر وتوليد كود الدخول فوراً
                    </span>
                    {(form.fatherName || form.lastName) && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewGuardianForm((prev) => ({
                            ...prev,
                            firstName: form.fatherName || prev.firstName,
                            lastName: form.lastName || prev.lastName,
                          }));
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                      >
                        نسخ من اسم الأب واللقب
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">اسم ولي الأمر الأول *</Label>
                      <Input
                        required={guardianMode === 'new'}
                        value={newGuardianForm.firstName}
                        onChange={(e) =>
                          setNewGuardianForm({ ...newGuardianForm, firstName: e.target.value })
                        }
                        placeholder="مثال: حيدر"
                        className="text-xs h-9 bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">اسم الأب</Label>
                      <Input
                        value={newGuardianForm.fatherName}
                        onChange={(e) =>
                          setNewGuardianForm({ ...newGuardianForm, fatherName: e.target.value })
                        }
                        placeholder="مثال: كاظم"
                        className="text-xs h-9 bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">اللقب / العشيرة *</Label>
                      <Input
                        required={guardianMode === 'new'}
                        value={newGuardianForm.lastName}
                        onChange={(e) =>
                          setNewGuardianForm({ ...newGuardianForm, lastName: e.target.value })
                        }
                        placeholder="مثال: الأسدي"
                        className="text-xs h-9 bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right pt-2 border-t border-indigo-200/50">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">رقم الهاتف للتواصل *</Label>
                      <Input
                        type="text"
                        dir="ltr"
                        required={guardianMode === 'new'}
                        value={newGuardianForm.phone}
                        onChange={(e) =>
                          setNewGuardianForm({ ...newGuardianForm, phone: e.target.value })
                        }
                        placeholder="07701234567"
                        className="font-mono text-xs h-9 bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">صلة القرابة</Label>
                      <select
                        value={newGuardianForm.relationshipType}
                        onChange={(e) =>
                          setNewGuardianForm({ ...newGuardianForm, relationshipType: e.target.value })
                        }
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="father">الأب</option>
                        <option value="mother">الأم</option>
                        <option value="brother">الأخ</option>
                        <option value="uncle">العم / الخال</option>
                        <option value="guardian">وصي قانوني</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">المهنة (اختياري)</Label>
                      <Input
                        value={newGuardianForm.occupation}
                        onChange={(e) =>
                          setNewGuardianForm({ ...newGuardianForm, occupation: e.target.value })
                        }
                        placeholder="موظف، مهندس..."
                        className="text-xs h-9 bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 3: None */}
              {guardianMode === 'none' && (
                <div className="p-3.5 rounded-xl border border-dashed border-border bg-secondary/15 text-muted-foreground text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span>سيسجل الطالب كحساب مستقل بدون ولي أمر حالياً.</span>
                  <span className="text-[11px] text-primary font-medium">
                    يمكنك ربطه بأي ولي أمر لاحقاً بنقرة واحدة من شاشة الطلاب
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 6: الاتصال والطوارئ والملف الصحي */}
          <Card className="rounded-2xl border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 bg-secondary/15 border-b border-border/80 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    6. الاتصال والطوارئ والملف الصحي (اختياري)
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    هواتف الطوارئ والحالة الصحية العامة لسلامة الطالب
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">السلامة والصحة</Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    هاتف الطالب الشخصي <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    dir="ltr"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="07701234567"
                    className="font-mono text-xs h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    جهة اتصال الطوارئ <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.emergencyContactName}
                    onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                    placeholder="مثال: الخال، العم، الأخ..."
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    هاتف الطوارئ <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    dir="ltr"
                    value={form.emergencyContactPhone}
                    onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                    placeholder="07801234567"
                    className="font-mono text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right pt-3 border-t border-border/50">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">الحالة الصحية العامة</Label>
                  <Input
                    value={form.healthStatus}
                    onChange={(e) => setForm({ ...form, healthStatus: e.target.value })}
                    placeholder="سليم معافى / يحتاج رعاية خاصة..."
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    ملاحظات طبية أو حساسية <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                  </Label>
                  <Input
                    value={form.medicalNotes}
                    onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })}
                    placeholder="أدوية مستمرة، حساسية أطعمة..."
                    className="text-xs h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Submit Bar */}
          <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={submitting}
              className="text-xs font-bold h-9"
            >
              إلغاء والعودة
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="text-xs font-bold gap-1.5 h-9 bg-primary text-primary-foreground shadow-sm px-6"
            >
              {submitting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>{isEdit ? 'جاري حفظ التعديلات...' : 'جاري تسجيل الطالب...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEdit ? 'حفظ التعديلات' : 'اعتماد وتسجيل الطالب وتوليد الكود'}</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Sidebar: Live Student Preview Card & Summary (4 cols) */}
        <div className="lg:col-span-4 space-y-4 sticky top-6">
          {/* Live Student Identity Card Preview */}
          <Card className="rounded-2xl border-primary/20 shadow-sm overflow-hidden bg-gradient-to-b from-card via-card to-primary/[0.02]">
            <CardHeader className="py-3 px-4 bg-primary/10 border-b border-primary/20 flex flex-row items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                معاينة بطاقة قيد الطالب الفورية
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Live ID</span>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-xs shrink-0 ring-2 ring-primary/20 overflow-hidden">
                  {photoPreview || form.photoUrl ? (
                    <img
                      src={photoPreview || form.photoUrl}
                      alt="صورة الطالب"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <AvatarFallback>
                      {form.firstName ? form.firstName.charAt(0) : 'ط'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-foreground truncate">
                    {form.firstName || form.lastName
                      ? `${form.firstName} ${form.fatherName ? form.fatherName + ' ' : ''}${form.lastName}`
                      : 'اسم الطالب المسجل'}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 font-mono">
                    <span>كود متولد تلقائياً</span>
                    <span>•</span>
                    <span>{form.gender === 'female' ? 'أنثى' : 'ذكر'}</span>
                  </div>
                </div>
              </div>

              {/* Progress Completeness */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">اكتمال بيانات الاستمارة:</span>
                  <span className="font-bold font-mono text-primary">{completeness}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>

              {/* Card Meta Badges */}
              <div className="space-y-2 text-xs pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">السجل الورقي:</span>
                  <span className="font-mono font-bold text-amber-900 dark:text-amber-200">
                    {form.generalRegisterNumber || 'غير محدد'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">المرحلة والصف:</span>
                  <span className="font-bold text-foreground">
                    {availableGrades.find((g) => g.id === form.gradeId)?.name || 'غير محدد'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">الشعبة:</span>
                  <span className="font-bold text-purple-700">
                    {availableSections.find((s) => s.id === form.sectionId)?.name || 'غير مسكن'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">المحافظة:</span>
                  <span className="font-medium text-foreground">{form.governorate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">اسم الأم:</span>
                  <span className="font-medium text-foreground">{form.motherName || '---'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">ولي الأمر:</span>
                  <span className="font-medium text-emerald-700">
                    {guardianMode === 'search' && selectedGuardian
                      ? selectedGuardian.full_name
                      : guardianMode === 'new' && newGuardianForm.firstName
                      ? `${newGuardianForm.firstName} ${newGuardianForm.lastName} (جديد)`
                      : 'حساب مستقل'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Guidance Box */}
          <div className="p-4 rounded-2xl border border-border bg-card space-y-2.5 text-xs text-muted-foreground">
            <span className="font-bold text-foreground block flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-primary" />
              ضوابط التسجيل العراقي
            </span>
            <ul className="space-y-1.5 text-[11px] leading-relaxed list-disc list-inside">
              <li>كافة الحقول باستثناء (الاسم الأول، اللقب، والجنس) اختيارية لتسهيل التسجيل السريع.</li>
              <li>رقم السجل العام يطابق رقم القيد في السجل الورقي المعتمد بالمعهد.</li>
              <li>يتم توليد كود دخول فوري ومستقل للطالب للدخول لتطبيقه الخاص.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Document/Photo Full Preview */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-card rounded-2xl overflow-hidden shadow-2xl border border-border p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                {previewModal.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl flex items-center justify-center bg-black/5 dark:bg-black/40 p-2">
              <img
                src={previewModal.url}
                alt={previewModal.title}
                className="max-h-[65vh] w-auto rounded-lg object-contain shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
