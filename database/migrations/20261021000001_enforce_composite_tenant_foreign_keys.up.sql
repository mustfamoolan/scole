-- Migration: enforce_composite_tenant_foreign_keys
-- Up

DO $$
BEGIN
    -- 1. Parent Table UNIQUE (tenant_id, id) constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_student_profiles_tenant_id') THEN
        ALTER TABLE student_profiles ADD CONSTRAINT uq_student_profiles_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_teacher_profiles_tenant_id') THEN
        ALTER TABLE teacher_profiles ADD CONSTRAINT uq_teacher_profiles_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_academic_cycles_tenant_id') THEN
        ALTER TABLE academic_cycles ADD CONSTRAINT uq_academic_cycles_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_academic_terms_tenant_id') THEN
        ALTER TABLE academic_terms ADD CONSTRAINT uq_academic_terms_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_educational_programs_tenant_id') THEN
        ALTER TABLE educational_programs ADD CONSTRAINT uq_educational_programs_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_study_grades_tenant_id') THEN
        ALTER TABLE study_grades ADD CONSTRAINT uq_study_grades_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_class_sections_tenant_id') THEN
        ALTER TABLE class_sections ADD CONSTRAINT uq_class_sections_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_study_cohorts_tenant_id') THEN
        ALTER TABLE study_cohorts ADD CONSTRAINT uq_study_cohorts_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_academic_enrollments_tenant_id') THEN
        ALTER TABLE academic_enrollments ADD CONSTRAINT uq_academic_enrollments_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_adopted_curricula_tenant_id') THEN
        ALTER TABLE adopted_curricula ADD CONSTRAINT uq_adopted_curricula_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_teacher_assignments_tenant_id') THEN
        ALTER TABLE teacher_assignments ADD CONSTRAINT uq_teacher_assignments_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_planned_schedule_slots_tenant_id') THEN
        ALTER TABLE planned_schedule_slots ADD CONSTRAINT uq_planned_schedule_slots_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_actual_class_sessions_tenant_id') THEN
        ALTER TABLE actual_class_sessions ADD CONSTRAINT uq_actual_class_sessions_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_assessment_plans_tenant_id') THEN
        ALTER TABLE assessment_plans ADD CONSTRAINT uq_assessment_plans_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_assessment_items_tenant_id') THEN
        ALTER TABLE assessment_items ADD CONSTRAINT uq_assessment_items_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_student_grade_records_tenant_id') THEN
        ALTER TABLE student_grade_records ADD CONSTRAINT uq_student_grade_records_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fee_policies_tenant_id') THEN
        ALTER TABLE fee_policies ADD CONSTRAINT uq_fee_policies_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_charge_accruals_tenant_id') THEN
        ALTER TABLE charge_accruals ADD CONSTRAINT uq_charge_accruals_tenant_id UNIQUE (tenant_id, id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_payment_transactions_tenant_id') THEN
        ALTER TABLE payment_transactions ADD CONSTRAINT uq_payment_transactions_tenant_id UNIQUE (tenant_id, id);
    END IF;

    -- 2. Drop legacy single-column FKs and add composite (tenant_id, ref_id) FKs

    -- guardian_student_relations
    ALTER TABLE guardian_student_relations DROP CONSTRAINT IF EXISTS guardian_student_relations_student_profile_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_guardian_student_profiles_tenant') THEN
        ALTER TABLE guardian_student_relations ADD CONSTRAINT fk_guardian_student_profiles_tenant
            FOREIGN KEY (tenant_id, student_profile_id) REFERENCES student_profiles(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- academic_terms
    ALTER TABLE academic_terms DROP CONSTRAINT IF EXISTS academic_terms_academic_cycle_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_academic_terms_cycle_tenant') THEN
        ALTER TABLE academic_terms ADD CONSTRAINT fk_academic_terms_cycle_tenant
            FOREIGN KEY (tenant_id, academic_cycle_id) REFERENCES academic_cycles(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- study_grades
    ALTER TABLE study_grades DROP CONSTRAINT IF EXISTS study_grades_educational_program_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_grades_program_tenant') THEN
        ALTER TABLE study_grades ADD CONSTRAINT fk_study_grades_program_tenant
            FOREIGN KEY (tenant_id, educational_program_id) REFERENCES educational_programs(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- class_sections
    ALTER TABLE class_sections DROP CONSTRAINT IF EXISTS class_sections_study_grade_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_sections_grade_tenant') THEN
        ALTER TABLE class_sections ADD CONSTRAINT fk_class_sections_grade_tenant
            FOREIGN KEY (tenant_id, study_grade_id) REFERENCES study_grades(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- study_cohorts
    ALTER TABLE study_cohorts DROP CONSTRAINT IF EXISTS study_cohorts_educational_program_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_cohorts_program_tenant') THEN
        ALTER TABLE study_cohorts ADD CONSTRAINT fk_study_cohorts_program_tenant
            FOREIGN KEY (tenant_id, educational_program_id) REFERENCES educational_programs(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- academic_enrollments
    ALTER TABLE academic_enrollments DROP CONSTRAINT IF EXISTS academic_enrollments_student_profile_id_fkey;
    ALTER TABLE academic_enrollments DROP CONSTRAINT IF EXISTS academic_enrollments_academic_term_id_fkey;
    ALTER TABLE academic_enrollments DROP CONSTRAINT IF EXISTS academic_enrollments_class_section_id_fkey;
    ALTER TABLE academic_enrollments DROP CONSTRAINT IF EXISTS academic_enrollments_study_cohort_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_enrollments_student_tenant') THEN
        ALTER TABLE academic_enrollments ADD CONSTRAINT fk_enrollments_student_tenant
            FOREIGN KEY (tenant_id, student_profile_id) REFERENCES student_profiles(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_enrollments_term_tenant') THEN
        ALTER TABLE academic_enrollments ADD CONSTRAINT fk_enrollments_term_tenant
            FOREIGN KEY (tenant_id, academic_term_id) REFERENCES academic_terms(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_enrollments_section_tenant') THEN
        ALTER TABLE academic_enrollments ADD CONSTRAINT fk_enrollments_section_tenant
            FOREIGN KEY (tenant_id, class_section_id) REFERENCES class_sections(tenant_id, id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_enrollments_cohort_tenant') THEN
        ALTER TABLE academic_enrollments ADD CONSTRAINT fk_enrollments_cohort_tenant
            FOREIGN KEY (tenant_id, study_cohort_id) REFERENCES study_cohorts(tenant_id, id) ON DELETE SET NULL;
    END IF;

    -- enrollment_status_histories
    ALTER TABLE enrollment_status_histories DROP CONSTRAINT IF EXISTS enrollment_status_histories_enrollment_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_enrollment_histories_tenant') THEN
        ALTER TABLE enrollment_status_histories ADD CONSTRAINT fk_enrollment_histories_tenant
            FOREIGN KEY (tenant_id, enrollment_id) REFERENCES academic_enrollments(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- adopted_curricula
    ALTER TABLE adopted_curricula DROP CONSTRAINT IF EXISTS adopted_curricula_study_grade_id_fkey;
    ALTER TABLE adopted_curricula DROP CONSTRAINT IF EXISTS adopted_curricula_study_cohort_id_fkey;
    ALTER TABLE adopted_curricula DROP CONSTRAINT IF EXISTS adopted_curricula_academic_cycle_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_adopted_curricula_grade_tenant') THEN
        ALTER TABLE adopted_curricula ADD CONSTRAINT fk_adopted_curricula_grade_tenant
            FOREIGN KEY (tenant_id, study_grade_id) REFERENCES study_grades(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_adopted_curricula_cohort_tenant') THEN
        ALTER TABLE adopted_curricula ADD CONSTRAINT fk_adopted_curricula_cohort_tenant
            FOREIGN KEY (tenant_id, study_cohort_id) REFERENCES study_cohorts(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_adopted_curricula_cycle_tenant') THEN
        ALTER TABLE adopted_curricula ADD CONSTRAINT fk_adopted_curricula_cycle_tenant
            FOREIGN KEY (tenant_id, academic_cycle_id) REFERENCES academic_cycles(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- teacher_assignments
    ALTER TABLE teacher_assignments DROP CONSTRAINT IF EXISTS teacher_assignments_teacher_profile_id_fkey;
    ALTER TABLE teacher_assignments DROP CONSTRAINT IF EXISTS teacher_assignments_adopted_curriculum_id_fkey;
    ALTER TABLE teacher_assignments DROP CONSTRAINT IF EXISTS teacher_assignments_class_section_id_fkey;
    ALTER TABLE teacher_assignments DROP CONSTRAINT IF EXISTS teacher_assignments_study_cohort_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teacher_assignments_teacher_tenant') THEN
        ALTER TABLE teacher_assignments ADD CONSTRAINT fk_teacher_assignments_teacher_tenant
            FOREIGN KEY (tenant_id, teacher_profile_id) REFERENCES teacher_profiles(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teacher_assignments_curriculum_tenant') THEN
        ALTER TABLE teacher_assignments ADD CONSTRAINT fk_teacher_assignments_curriculum_tenant
            FOREIGN KEY (tenant_id, adopted_curriculum_id) REFERENCES adopted_curricula(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teacher_assignments_section_tenant') THEN
        ALTER TABLE teacher_assignments ADD CONSTRAINT fk_teacher_assignments_section_tenant
            FOREIGN KEY (tenant_id, class_section_id) REFERENCES class_sections(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teacher_assignments_cohort_tenant') THEN
        ALTER TABLE teacher_assignments ADD CONSTRAINT fk_teacher_assignments_cohort_tenant
            FOREIGN KEY (tenant_id, study_cohort_id) REFERENCES study_cohorts(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- planned_schedule_slots
    ALTER TABLE planned_schedule_slots DROP CONSTRAINT IF EXISTS planned_schedule_slots_teacher_assignment_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_schedule_slots_assignment_tenant') THEN
        ALTER TABLE planned_schedule_slots ADD CONSTRAINT fk_schedule_slots_assignment_tenant
            FOREIGN KEY (tenant_id, teacher_assignment_id) REFERENCES teacher_assignments(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- actual_class_sessions
    ALTER TABLE actual_class_sessions DROP CONSTRAINT IF EXISTS actual_class_sessions_planned_schedule_slot_id_fkey;
    ALTER TABLE actual_class_sessions DROP CONSTRAINT IF EXISTS actual_class_sessions_teacher_assignment_id_fkey;
    ALTER TABLE actual_class_sessions DROP CONSTRAINT IF EXISTS actual_class_sessions_substitute_teacher_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_actual_sessions_slot_tenant') THEN
        ALTER TABLE actual_class_sessions ADD CONSTRAINT fk_actual_sessions_slot_tenant
            FOREIGN KEY (tenant_id, planned_schedule_slot_id) REFERENCES planned_schedule_slots(tenant_id, id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_actual_sessions_assignment_tenant') THEN
        ALTER TABLE actual_class_sessions ADD CONSTRAINT fk_actual_sessions_assignment_tenant
            FOREIGN KEY (tenant_id, teacher_assignment_id) REFERENCES teacher_assignments(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_actual_sessions_substitute_tenant') THEN
        ALTER TABLE actual_class_sessions ADD CONSTRAINT fk_actual_sessions_substitute_tenant
            FOREIGN KEY (tenant_id, substitute_teacher_id) REFERENCES teacher_profiles(tenant_id, id) ON DELETE SET NULL;
    END IF;

    -- attendance_records
    ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_student_profile_id_fkey;
    ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_actual_session_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_student_tenant') THEN
        ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_student_tenant
            FOREIGN KEY (tenant_id, student_profile_id) REFERENCES student_profiles(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_session_tenant') THEN
        ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_session_tenant
            FOREIGN KEY (tenant_id, actual_session_id) REFERENCES actual_class_sessions(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- assessment_plans
    ALTER TABLE assessment_plans DROP CONSTRAINT IF EXISTS assessment_plans_adopted_curriculum_id_fkey;
    ALTER TABLE assessment_plans DROP CONSTRAINT IF EXISTS assessment_plans_academic_term_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assessment_plans_curriculum_tenant') THEN
        ALTER TABLE assessment_plans ADD CONSTRAINT fk_assessment_plans_curriculum_tenant
            FOREIGN KEY (tenant_id, adopted_curriculum_id) REFERENCES adopted_curricula(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assessment_plans_term_tenant') THEN
        ALTER TABLE assessment_plans ADD CONSTRAINT fk_assessment_plans_term_tenant
            FOREIGN KEY (tenant_id, academic_term_id) REFERENCES academic_terms(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- assessment_items
    ALTER TABLE assessment_items DROP CONSTRAINT IF EXISTS assessment_items_assessment_plan_id_fkey;
    ALTER TABLE assessment_items DROP CONSTRAINT IF EXISTS assessment_items_class_section_id_fkey;
    ALTER TABLE assessment_items DROP CONSTRAINT IF EXISTS assessment_items_study_cohort_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assessment_items_plan_tenant') THEN
        ALTER TABLE assessment_items ADD CONSTRAINT fk_assessment_items_plan_tenant
            FOREIGN KEY (tenant_id, assessment_plan_id) REFERENCES assessment_plans(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assessment_items_section_tenant') THEN
        ALTER TABLE assessment_items ADD CONSTRAINT fk_assessment_items_section_tenant
            FOREIGN KEY (tenant_id, class_section_id) REFERENCES class_sections(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assessment_items_cohort_tenant') THEN
        ALTER TABLE assessment_items ADD CONSTRAINT fk_assessment_items_cohort_tenant
            FOREIGN KEY (tenant_id, study_cohort_id) REFERENCES study_cohorts(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- student_grade_records
    ALTER TABLE student_grade_records DROP CONSTRAINT IF EXISTS student_grade_records_assessment_item_id_fkey;
    ALTER TABLE student_grade_records DROP CONSTRAINT IF EXISTS student_grade_records_student_profile_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_student_grades_item_tenant') THEN
        ALTER TABLE student_grade_records ADD CONSTRAINT fk_student_grades_item_tenant
            FOREIGN KEY (tenant_id, assessment_item_id) REFERENCES assessment_items(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_student_grades_student_tenant') THEN
        ALTER TABLE student_grade_records ADD CONSTRAINT fk_student_grades_student_tenant
            FOREIGN KEY (tenant_id, student_profile_id) REFERENCES student_profiles(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- grade_audit_logs
    ALTER TABLE grade_audit_logs DROP CONSTRAINT IF EXISTS grade_audit_logs_student_grade_record_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_grade_audit_logs_record_tenant') THEN
        ALTER TABLE grade_audit_logs ADD CONSTRAINT fk_grade_audit_logs_record_tenant
            FOREIGN KEY (tenant_id, student_grade_record_id) REFERENCES student_grade_records(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- behavior_incidents
    ALTER TABLE behavior_incidents DROP CONSTRAINT IF EXISTS behavior_incidents_student_profile_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_behavior_student_tenant') THEN
        ALTER TABLE behavior_incidents ADD CONSTRAINT fk_behavior_student_tenant
            FOREIGN KEY (tenant_id, student_profile_id) REFERENCES student_profiles(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- charge_accruals
    ALTER TABLE charge_accruals DROP CONSTRAINT IF EXISTS charge_accruals_student_profile_id_fkey;
    ALTER TABLE charge_accruals DROP CONSTRAINT IF EXISTS charge_accruals_enrollment_id_fkey;
    ALTER TABLE charge_accruals DROP CONSTRAINT IF EXISTS charge_accruals_fee_policy_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_charge_accruals_student_tenant') THEN
        ALTER TABLE charge_accruals ADD CONSTRAINT fk_charge_accruals_student_tenant
            FOREIGN KEY (tenant_id, student_profile_id) REFERENCES student_profiles(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_charge_accruals_enrollment_tenant') THEN
        ALTER TABLE charge_accruals ADD CONSTRAINT fk_charge_accruals_enrollment_tenant
            FOREIGN KEY (tenant_id, enrollment_id) REFERENCES academic_enrollments(tenant_id, id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_charge_accruals_policy_tenant') THEN
        ALTER TABLE charge_accruals ADD CONSTRAINT fk_charge_accruals_policy_tenant
            FOREIGN KEY (tenant_id, fee_policy_id) REFERENCES fee_policies(tenant_id, id) ON DELETE SET NULL;
    END IF;

    -- scholarship_discounts
    ALTER TABLE scholarship_discounts DROP CONSTRAINT IF EXISTS scholarship_discounts_charge_accrual_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scholarships_accrual_tenant') THEN
        ALTER TABLE scholarship_discounts ADD CONSTRAINT fk_scholarships_accrual_tenant
            FOREIGN KEY (tenant_id, charge_accrual_id) REFERENCES charge_accruals(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- payment_allocations
    ALTER TABLE payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_payment_transaction_id_fkey;
    ALTER TABLE payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_charge_accrual_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payment_alloc_txn_tenant') THEN
        ALTER TABLE payment_allocations ADD CONSTRAINT fk_payment_alloc_txn_tenant
            FOREIGN KEY (tenant_id, payment_transaction_id) REFERENCES payment_transactions(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payment_alloc_accrual_tenant') THEN
        ALTER TABLE payment_allocations ADD CONSTRAINT fk_payment_alloc_accrual_tenant
            FOREIGN KEY (tenant_id, charge_accrual_id) REFERENCES charge_accruals(tenant_id, id) ON DELETE CASCADE;
    END IF;

    -- refund_transactions
    ALTER TABLE refund_transactions DROP CONSTRAINT IF EXISTS refund_transactions_original_payment_id_fkey;
    ALTER TABLE refund_transactions DROP CONSTRAINT IF EXISTS refund_transactions_charge_accrual_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_refunds_original_payment_tenant') THEN
        ALTER TABLE refund_transactions ADD CONSTRAINT fk_refunds_original_payment_tenant
            FOREIGN KEY (tenant_id, original_payment_id) REFERENCES payment_transactions(tenant_id, id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_refunds_accrual_tenant') THEN
        ALTER TABLE refund_transactions ADD CONSTRAINT fk_refunds_accrual_tenant
            FOREIGN KEY (tenant_id, charge_accrual_id) REFERENCES charge_accruals(tenant_id, id) ON DELETE SET NULL;
    END IF;

    -- session_packages
    ALTER TABLE session_packages DROP CONSTRAINT IF EXISTS session_packages_student_profile_id_fkey;
    ALTER TABLE session_packages DROP CONSTRAINT IF EXISTS session_packages_fee_policy_id_fkey;
    ALTER TABLE session_packages DROP CONSTRAINT IF EXISTS session_packages_payment_transaction_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_session_packages_student_tenant') THEN
        ALTER TABLE session_packages ADD CONSTRAINT fk_session_packages_student_tenant
            FOREIGN KEY (tenant_id, student_profile_id) REFERENCES student_profiles(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_session_packages_policy_tenant') THEN
        ALTER TABLE session_packages ADD CONSTRAINT fk_session_packages_policy_tenant
            FOREIGN KEY (tenant_id, fee_policy_id) REFERENCES fee_policies(tenant_id, id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_session_packages_payment_tenant') THEN
        ALTER TABLE session_packages ADD CONSTRAINT fk_session_packages_payment_tenant
            FOREIGN KEY (tenant_id, payment_transaction_id) REFERENCES payment_transactions(tenant_id, id) ON DELETE SET NULL;
    END IF;

    -- teacher_payout_accruals
    ALTER TABLE teacher_payout_accruals DROP CONSTRAINT IF EXISTS teacher_payout_accruals_teacher_profile_id_fkey;
    ALTER TABLE teacher_payout_accruals DROP CONSTRAINT IF EXISTS teacher_payout_accruals_actual_class_session_id_fkey;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payouts_teacher_tenant') THEN
        ALTER TABLE teacher_payout_accruals ADD CONSTRAINT fk_payouts_teacher_tenant
            FOREIGN KEY (tenant_id, teacher_profile_id) REFERENCES teacher_profiles(tenant_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payouts_session_tenant') THEN
        ALTER TABLE teacher_payout_accruals ADD CONSTRAINT fk_payouts_session_tenant
            FOREIGN KEY (tenant_id, actual_class_session_id) REFERENCES actual_class_sessions(tenant_id, id) ON DELETE SET NULL;
    END IF;
END $$;
