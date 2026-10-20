export interface User {
  id: string;
  tenant_id?: string | null;
  name: string;
  email: string;
  role: 'platform_admin' | 'institute_admin' | 'staff';
  status: 'active' | 'suspended' | 'inactive';
  created_at?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  primary_color?: string;
  status: 'setup' | 'active' | 'suspended' | 'archived';
  created_at?: string;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_iqd: number; // Whole Iraqi Dinars (IQD)
  billing_cycle: 'monthly' | 'quarterly' | 'yearly';
  billing_period?: 'monthly' | 'quarterly' | 'yearly';
  is_popular?: boolean;
  max_students: number;
  max_teachers: number;
  max_branches: number;
  features: string;
  image_url?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  plan?: Plan;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended';
  starts_at: string;
  ends_at: string;
  trial_ends_at?: string | null;
  canceled_at?: string | null;
  auto_renew: boolean;
}

export interface PaymentReceipt {
  id: string;
  tenant_id: string;
  subscription_id?: string | null;
  receipt_number: string;
  amount_iqd: number; // Whole Iraqi Dinars (IQD)
  currency: 'IQD';
  payment_method: 'cash' | 'bank_transfer' | 'manual_receipt' | 'cheque' | 'other';
  reference_note?: string;
  recorded_by_user_id: string;
  paid_at: string;
  created_at?: string;
}

export interface Domain {
  id: string;
  tenant_id: string;
  domain: string;
  is_primary: boolean;
  status: 'pending_verification' | 'verified' | 'active' | 'failed';
  verification_token: string;
  verification_method: string;
  verified_at?: string | null;
  created_at?: string;
}

export interface APIErrorDetail {
  code: string;
  message: string;
}

export interface APIErrorResponse {
  success: false;
  error: APIErrorDetail;
  request_id?: string;
}

export interface AuditLog {
  id: string;
  tenant_id?: string | null;
  user_id?: string | null;
  actor_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface LandingInquiry {
  id: string;
  full_name: string;
  phone: string;
  institute_name: string;
  request_type: 'consultation' | 'booking' | 'demo';
  notes?: string;
  status: 'pending' | 'contacted' | 'converted' | 'rejected';
  converted_tenant_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  tenant_id: string;
  user_id: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_response?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
  tenant?: Tenant;
}

export interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CommunicationChannel {
  id: string;
  person_id: string;
  channel_type: 'phone' | 'email' | 'whatsapp' | 'telegram' | string;
  channel_value: string;
  is_verified: boolean;
  is_primary: boolean;
}

export interface Person {
  id: string;
  national_id_number?: string;
  national_id?: string;
  first_name: string;
  father_name?: string;
  grandfather_name?: string;
  last_name: string;
  gender: string;
  date_of_birth?: string;
  nationality?: string;
  mother_name?: string;
  mother_father_name?: string;
  place_of_birth?: string;
  blood_type?: string;
  governorate?: string;
  city_district?: string;
  neighborhood?: string;
  street_alley?: string;
  house_number?: string;
  nearest_landmark?: string;
  avatar_url?: string;
  phone?: string;
  email?: string;
  city?: string;
  emergency_contact?: string;
  communication_channels?: CommunicationChannel[];
}

export interface GuardianInfo {
  id: string;
  person_id: string;
  name: string;
  relationship_type: string;
  phone?: string;
  access_code: string;
  is_primary: boolean;
}

export interface GuardianProfileDTO {
  id: string;
  person_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  access_code: string;
  occupation?: string;
  students: {
    relation_id: string;
    student_id: string;
    student_number: string;
    student_name: string;
    relationship_type: string;
    access_code: string;
  }[];
}

export interface StudentProfile {
  id: string;
  tenant_id: string;
  person_id: string;
  student_number: string;
  first_name?: string;
  father_name?: string;
  last_name?: string;
  full_name?: string;
  access_code?: string;
  general_register_number?: string;
  previous_school?: string;
  graduation_doc_number?: string;
  identity_doc_type?: string;
  civil_volume?: string;
  civil_page?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  health_status?: string;
  photo_url?: string;
  id_card_front_url?: string;
  id_card_back_url?: string;
  guardian_id_front_url?: string;
  guardian_id_back_url?: string;
  enrollment_status: 'registered' | 'active' | 'withdrawn' | 'suspended' | 'graduated';
  medical_notes?: string;
  special_education_needs?: string;
  person?: Person;
  created_at?: string;
  grade_name?: string;
  section_name?: string;
  program_name?: string;
  program_id?: string;
  grade_id?: string;
  section_id?: string;
  phone?: string;
  guardians_info?: GuardianInfo[];
}

export interface TeacherAssignment {
  id: string;
  tenant_id: string;
  teacher_profile_id: string;
  adopted_curriculum_id: string;
  class_section_id?: string;
  study_cohort_id?: string;
  is_lead_teacher: boolean;
  start_date: string;
  end_date?: string;
  status: 'active' | 'completed' | 'terminated';
  adopted_curriculum?: AdoptedCurriculum & {
    course_name?: string;
    subject_name?: string;
    code?: string;
  };
  class_section?: ClassSection;
}

export interface AdoptedCurriculum {
  id: string;
  tenant_id: string;
  curriculum_edition_id?: string;
  study_grade_id?: string;
  study_cohort_id?: string;
  academic_cycle_id?: string;
  weekly_sessions_count: number;
  academic_term?: {
    id: string;
    name: string;
  };
  curriculum_edition?: {
    id: string;
    edition_name: string;
    definition?: {
      id: string;
      name: string;
      subject?: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
  study_grade?: StudyGrade;
  subject_name?: string;
  subject_code?: string;
  study_grade_name?: string;
  educational_program_name?: string;
  assigned_teacher_id?: string;
  assigned_teacher_name?: string;
}

export interface StaffQualification {
  id: string;
  qualification_type: 'bachelor' | 'master' | 'phd' | 'diploma' | 'certificate' | 'teaching_license' | string;
  title: string;
  institution_name: string;
  graduation_year?: number;
  document_url?: string;
  is_verified: boolean;
}

export interface EmploymentContract {
  id: string;
  contract_number: string;
  contract_type: 'full_time' | 'part_time' | 'per_session' | 'contractor' | 'temporary' | string;
  base_salary?: number;
  hourly_rate?: number;
  default_session_rate?: number;
  currency: string;
  start_date: string;
  end_date?: string;
  status: 'draft' | 'active' | 'renewed' | 'terminated' | 'expired' | string;
  terms_summary?: string;
}

export interface TeacherProfile {
  id: string;
  tenant_id: string;
  person_id: string;
  staff_number: string;
  access_code?: string;
  specialization?: string;
  secondary_specializations?: string[];
  teaching_grades?: string[];
  teaching_mode?: 'in_person' | 'remote' | 'hybrid' | string;
  bio?: string;
  employment_type: 'full_time' | 'part_time' | 'per_session' | 'contractor' | string;
  hourly_rate?: number;
  monthly_salary?: number;
  status: 'active' | 'suspended' | 'inactive' | string;
  created_at?: string;
  updated_at?: string;
  staff_profile_id?: string;
  person?: Person;
  staff_profile?: StaffProfile;
  assignments?: TeacherAssignment[];
  qualifications?: StaffQualification[];
  contract?: EmploymentContract;
}

export interface AcademicEnrollment {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  academic_term_id: string;
  class_section_id?: string;
  study_cohort_id?: string;
  enrollment_date: string;
  enrollment_type: string;
  status: 'active' | 'transferred' | 'withdrawn' | 'completed';
}

export interface AttendanceRecord {
  id: string;
  student_profile_id: string;
  actual_session_id: string;
  record_date: string;
  status: 'present' | 'absent_unexcused' | 'absent_excused' | 'late' | 'left_early';
  minutes_late: number;
}

export interface StudentGradeRecord {
  id: string;
  assessment_item_id: string;
  student_profile_id: string;
  raw_score: number;
  final_score: number;
  grade_letter?: string;
  is_absent: boolean;
  status: 'submitted' | 'approved' | 'revised';
}

export interface ChargeAccrual {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  charge_type: string;
  description: string;
  gross_amount: number;
  discount_amount: number;
  net_due_amount: number;
  paid_amount: number;
  currency: string;
  due_date: string;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'void';
}

export interface Position {
  id: string;
  code: string;
  title: string;
  is_managerial: boolean;
}

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface PositionAssignment {
  id: string;
  position_id: string;
  department_id?: string;
  assignment_type: string;
  is_primary: boolean;
  start_date: string;
  end_date?: string;
  status: string;
  position?: Position;
  department?: Department;
}

export interface StaffProfile {
  id: string;
  tenant_id: string;
  person_id: string;
  staff_number: string;
  employment_status: string;
  hire_date: string;
  termination_date?: string;
  person?: Person;
  assignments?: PositionAssignment[];
}

export interface TeacherPayoutAccrual {
  id: string;
  tenant_id: string;
  teacher_profile_id: string;
  actual_class_session_id?: string;
  payout_calc_model: string;
  calculated_amount: number;
  currency: string;
  accrual_date: string;
  status: 'pending' | 'approved' | 'paid' | 'void';
  teacher_profile?: TeacherProfile;
}

export interface TeacherPayoutTransaction {
  id: string;
  tenant_id: string;
  payout_accrual_id: string;
  payout_receipt_number: string;
  amount_paid: number;
  payment_method: string;
  paid_at: string;
}

export interface ClassSection {
  id: string;
  tenant_id: string;
  study_grade_id: string;
  grade_id?: string;
  name: string;
  capacity: number;
  room_number?: string;
  created_at?: string;
}

export interface StudyGrade {
  id: string;
  tenant_id: string;
  educational_program_id: string;
  program_id?: string;
  name: string;
  grade_level: number;
  created_at?: string;
  sections?: ClassSection[];
  educational_program?: EducationalProgram;
}

export interface EducationalProgram {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  program_type: 'k12' | 'language_course' | 'vocational' | 'private_tutoring' | 'course' | string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  grades?: StudyGrade[];
}

export interface Subject {
  id: string;
  tenant_id?: string;
  code: string;
  name: string;
  description?: string;
}

export interface AcademicStructureData {
  programs: EducationalProgram[];
  adopted_curricula: AdoptedCurriculum[];
  subjects: Subject[];
}

export interface HomeworkSubmission {
  id: string;
  tenant_id: string;
  daily_homework_id: string;
  student_profile_id: string;
  submitted_by: 'student' | 'guardian';
  submission_text?: string | null;
  images: string;
  submitted_at: string;
  review_status: 'pending' | 'reviewed' | 'needs_resubmission';
  teacher_rating?: 'excellent' | 'good' | 'acceptable' | 'incomplete' | 'not_done' | string | null;
  teacher_feedback?: string | null;
  reviewed_at?: string | null;
  student_profile?: StudentProfile;
}

export interface DailyHomework {
  id: string;
  tenant_id: string;
  teacher_assignment_id: string;
  class_section_id?: string;
  study_grade_id?: string;
  title: string;
  lesson_topic?: string | null;
  description?: string | null;
  attachment_urls?: string;
  due_date: string;
  status: 'active' | 'closed';
  created_at: string;
  teacher_assignment?: TeacherAssignment;
  class_section?: ClassSection;
  study_grade?: StudyGrade;
  submissions?: HomeworkSubmission[];
}

export interface StudentHomeworkItem extends DailyHomework {
  subject_name: string;
  teacher_name: string;
  grade_name: string;
  section_name: string;
  user_submission?: HomeworkSubmission;
  is_submitted: boolean;
}

export interface StudentRosterSubmission {
  student_id: string;
  student_number: string;
  full_name: string;
  photo_url?: string | null;
  submission_id?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  submission_text?: string | null;
  images: string[];
  review_status: 'not_submitted' | 'pending' | 'reviewed' | 'needs_resubmission';
  teacher_rating?: string | null;
  teacher_feedback?: string | null;
  reviewed_at?: string | null;
}

export interface StudentSchoolHomework {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  class_section_id?: string;
  study_grade_id?: string;
  subject_name: string;
  title: string;
  description?: string | null;
  images: string; // JSON array of string URLs
  submitted_by: 'student' | 'guardian';
  teacher_profile_id?: string | null;
  teacher_comment?: string | null;
  is_seen: boolean;
  seen_at?: string | null;
  created_at: string;
  updated_at: string;
  student_profile?: StudentProfile;
  class_section?: ClassSection;
  study_grade?: StudyGrade;
  teacher_profile?: TeacherProfile;
}




