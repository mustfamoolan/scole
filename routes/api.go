package routes

import (
	"context"
	"time"

	"institute/app/controllers"
	"institute/app/middleware"
	"institute/app/models"
	"institute/app/repositories"
	"institute/app/services"
	"institute/bootstrap"
	"institute/config"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// RegisterAPIRoutes sets up API v1, authentication, RBAC, and operational health/readiness endpoints.
func RegisterAPIRoutes(app *fiber.App) {
	// Top-level liveness and readiness probes
	app.Get("/health/live", handleLiveness)
	app.Get("/health/ready", handleReadiness)

	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Versioned health & readiness
	v1.Get("/health", handleLiveness)
	v1.Get("/ready", handleReadiness)

	// Wire auth, RBAC, and tenant endpoints
	RegisterAuthAndTenantRoutes(app)
}

// RegisterAuthAndTenantRoutes wires up authentication, RBAC, and tenant operational endpoints.
func RegisterAuthAndTenantRoutes(app *fiber.App) {
	if bootstrap.DB == nil {
		return
	}

	userRepo := repositories.NewUserRepository(bootstrap.DB)
	sessionRepo := repositories.NewSessionRepository(bootstrap.DB)
	tenantRepo := repositories.NewTenantRepository(bootstrap.DB)
	authService := services.NewAuthService(userRepo, sessionRepo)
	authCtrl := controllers.NewAuthController(authService)

	tenantMgmtService := services.NewTenantManagementService(bootstrap.DB, tenantRepo, userRepo)
	instituteCtrl := controllers.NewInstituteController(tenantMgmtService)

	domainRepo := repositories.NewDomainRepository(bootstrap.DB)
	domainService := services.NewDomainService(domainRepo, tenantRepo, config.Global.App.URL, nil)
	domainCtrl := controllers.NewDomainController(domainService)

	planRepo := repositories.NewPlanRepository(bootstrap.DB)
	subRepo := repositories.NewSubscriptionRepository(bootstrap.DB)
	receiptRepo := repositories.NewPaymentReceiptRepository(bootstrap.DB)
	billingService := services.NewBillingService(bootstrap.DB, planRepo, subRepo, receiptRepo, tenantRepo)
	billingCtrl := controllers.NewBillingController(billingService)
	auditRepo := repositories.NewAuditLogRepository(bootstrap.DB)
	auditService := services.NewAuditService(auditRepo, zap.L())
	auditCtrl := controllers.NewAuditController(auditService)

	supportRepo := repositories.NewSupportRepository(bootstrap.DB)
	supportService := services.NewSupportService(supportRepo, tenantMgmtService, auditService)
	supportCtrl := controllers.NewSupportController(supportService)

	settingRepo := repositories.NewPlatformSettingRepository(bootstrap.DB)
	settingService := services.NewPlatformSettingService(settingRepo)
	settingCtrl := controllers.NewPlatformSettingController(settingService)

	academicService := services.NewAcademicService(bootstrap.DB)
	academicCtrl := controllers.NewAcademicController(bootstrap.DB, academicService)

	assessmentService := services.NewAssessmentService(bootstrap.DB)
	assessmentCtrl := controllers.NewAssessmentController(bootstrap.DB, assessmentService)

	financeService := services.NewEducationalFinanceService(bootstrap.DB)
	financeCtrl := controllers.NewEducationalFinanceController(bootstrap.DB, financeService)

	workforceService := services.NewWorkforceService(bootstrap.DB)
	contractService := services.NewContractService(bootstrap.DB)
	teachingService := services.NewTeachingService(bootstrap.DB)
	staffAttendanceService := services.NewStaffAttendanceService(bootstrap.DB)
	payoutService := services.NewTeacherPayoutService(bootstrap.DB)
	hrCtrl := controllers.NewHRController(bootstrap.DB, workforceService, contractService, teachingService, staffAttendanceService, payoutService)
	homeworkService := services.NewHomeworkService(bootstrap.DB)
	homeworkCtrl := controllers.NewHomeworkController(bootstrap.DB, homeworkService)

	tenantMgmtService.SetAuditService(auditService)
	tenantMgmtService.SetBillingService(billingService)
	tenantMgmtService.SetAuthService(authService)
	instituteCtrl.SetSettingService(settingService)
	billingService.SetAuditService(auditService)

	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Global auth middleware
	v1.Use(middleware.Authenticate(authService))

	// Public endpoints (Landing page inquiries, dynamic CMS settings, plans, and self-registration)
	v1.Post("/public/inquiries", supportCtrl.SubmitLandingInquiry)
	v1.Get("/public/settings", settingCtrl.GetPublicSettings)
	v1.Get("/public/plans", billingCtrl.ListPublicPlans)
	v1.Post("/public/register-institute", instituteCtrl.SelfRegisterInstitute)

	// Platform admin authentication
	v1.Post("/platform/auth/login", authCtrl.LoginPlatform)

	// Student, Guardian, and Teacher Mobile App Code Authentication (Publicly accessible with or without subdomain)
	v1.Post("/portal/student-login", academicCtrl.StudentCodeLogin)
	v1.Post("/portal/guardian-login", academicCtrl.GuardianCodeLogin)
	v1.Post("/portal/teacher-login", academicCtrl.TeacherCodeLogin)
	v1.Post("/auth/student-login", academicCtrl.StudentCodeLogin)
	v1.Post("/auth/guardian-login", academicCtrl.GuardianCodeLogin)
	v1.Post("/auth/teacher-login", academicCtrl.TeacherCodeLogin)

	// Portal Homework & Submissions (Accessible by Student, Guardian, and Teacher apps)
	v1.Post("/portal/homeworks/upload", homeworkCtrl.UploadAttachment)
	v1.Get("/portal/student/homeworks", homeworkCtrl.StudentHomeworks)
	v1.Post("/portal/student/homeworks/:id/submit", homeworkCtrl.SubmitHomework)
	v1.Get("/portal/teacher/homeworks", homeworkCtrl.ListHomeworks)
	v1.Post("/portal/teacher/homeworks", homeworkCtrl.CreateHomework)
	v1.Get("/portal/teacher/homeworks/:id", homeworkCtrl.GetHomeworkDetails)
	v1.Put("/portal/teacher/submissions/:submission_id/review", homeworkCtrl.ReviewSubmission)

	// Student School Homeworks Stream (Chat & Feed for Institute Tutoring)
	v1.Post("/portal/school-homeworks", homeworkCtrl.UploadSchoolHomework)
	v1.Get("/portal/school-homeworks", homeworkCtrl.ListSchoolHomeworksFeed)
	v1.Put("/portal/school-homeworks/:id/acknowledge", homeworkCtrl.AcknowledgeSchoolHomework)

	// Protected Platform routes (Require platform_admin)
	platform := v1.Group("/platform", middleware.RequireAuth(), middleware.RequireRole(models.RolePlatformAdmin))
	platform.Get("/dashboard", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
			"view":   "platform_central_dashboard",
		})
	})
	// Phase 4: Platform institute lifecycle management
	platform.Post("/institutes", instituteCtrl.CreateInstitute)
	platform.Get("/institutes", instituteCtrl.ListInstitutes)
	platform.Get("/institutes/:id", instituteCtrl.GetInstitute)
	platform.Put("/institutes/:id", instituteCtrl.UpdateInstituteByPlatform)
	platform.Put("/institutes/:id/status", instituteCtrl.UpdateInstituteStatus)
	// Phase 5: Platform custom domain audit
	platform.Get("/domains", domainCtrl.ListAllDomains)
	// Phase 6: Platform billing, plans, and financial ledgering
	platform.Post("/plans", billingCtrl.CreatePlan)
	platform.Get("/plans", billingCtrl.ListAllPlans)
	platform.Post("/plans/upload-image", billingCtrl.UploadPlanImage)
	platform.Put("/plans/:id", billingCtrl.UpdatePlan)
	platform.Put("/plans/:id/status", billingCtrl.TogglePlanStatus)
	platform.Delete("/plans/:id", billingCtrl.DeletePlan)
	platform.Get("/subscriptions", billingCtrl.ListAllSubscriptions)
	platform.Post("/subscriptions", billingCtrl.CreateSubscription)
	platform.Post("/subscriptions/:id/renew", billingCtrl.RenewSubscription)
	platform.Post("/subscriptions/:id/change-plan", billingCtrl.ChangePlan)
	platform.Post("/subscriptions/:id/activate", billingCtrl.ActivateSubscription)
	platform.Post("/subscriptions/:id/cancel", billingCtrl.CancelSubscription)
	platform.Post("/receipts", billingCtrl.RecordPayment)
	platform.Get("/receipts", billingCtrl.ListAllReceipts)
	// Phase 8: Platform audit log examination
	platform.Get("/audit-logs", auditCtrl.ListPlatformAuditLogs)

	// Phase 3 & 4: Platform Inquiries, Support Tickets, and Settings
	platform.Get("/inquiries", supportCtrl.ListInquiries)
	platform.Put("/inquiries/:id/status", supportCtrl.UpdateInquiryStatus)
	platform.Post("/inquiries/:id/convert", supportCtrl.ConvertInquiryToTenant)
	platform.Get("/support/tickets", supportCtrl.ListTickets)
	platform.Post("/support/tickets/:id/respond", supportCtrl.RespondTicket)
	platform.Get("/settings", settingCtrl.GetAllSettings)
	platform.Put("/settings", settingCtrl.UpdateSettings)

	// Tenant-scoped routes (Requires valid tenant resolved from domain or subdomain)
	tenantGroup := v1.Group("/tenant", middleware.TenantResolver(middleware.TenantConfig{
		Repo:       tenantRepo,
		DomainRepo: domainRepo,
		BaseDomain: config.Global.App.URL,
	}))

	// Tenant user authentication
	tenantGroup.Post("/auth/login", authCtrl.LoginTenant)
	tenantGroup.Post("/auth/student-login", academicCtrl.StudentCodeLogin)
	tenantGroup.Post("/auth/guardian-login", academicCtrl.GuardianCodeLogin)
	tenantGroup.Post("/auth/teacher-login", academicCtrl.TeacherCodeLogin)

	// Current tenant public info
	tenantGroup.Get("/current", func(c *fiber.Ctx) error {
		tenant := middleware.GetTenant(c)
		return c.JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"id":            tenant.ID,
				"name":          tenant.Name,
				"slug":          tenant.Slug,
				"logo_url":      tenant.LogoURL,
				"primary_color": tenant.PrimaryColor,
				"phone":         tenant.Phone,
				"email":         tenant.Email,
				"address":       tenant.Address,
				"status":        tenant.Status,
			},
		})
	})

	// Protected tenant routes (Must be authenticated AND belong to this tenant)
	protectedTenant := tenantGroup.Group("", middleware.RequireAuth(), middleware.RequireTenantUser())
	protectedTenant.Get("/auth/me", authCtrl.Me)
	protectedTenant.Post("/auth/logout", authCtrl.Logout)

	// Institute Admin routes (Must have role institute_admin)
	adminTenant := protectedTenant.Group("/admin", middleware.RequireRole(models.RoleInstituteAdmin))
	adminTenant.Get("/settings", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
			"view":   "institute_admin_settings",
		})
	})
	// Phase 4: Institute Admin profile management
	adminTenant.Get("/profile", instituteCtrl.GetTenantProfile)
	adminTenant.Put("/profile", instituteCtrl.UpdateTenantProfile)
	adminTenant.Post("/profile/upload-logo", instituteCtrl.UploadTenantLogo)

	// Phase 5: Institute custom domain management & verification
	adminTenant.Post("/domains", domainCtrl.RequestDomain)
	adminTenant.Get("/domains", domainCtrl.ListTenantDomains)
	adminTenant.Post("/domains/:id/verify", domainCtrl.VerifyDomain)
	adminTenant.Post("/domains/:id/primary", domainCtrl.SetPrimaryDomain)
	adminTenant.Delete("/domains/:id", domainCtrl.DeleteDomain)

	// Phase 6: Institute subscription & receipt history
	adminTenant.Get("/billing/subscription", billingCtrl.GetTenantSubscription)
	adminTenant.Get("/billing/receipts", billingCtrl.ListTenantReceipts)
	adminTenant.Get("/billing/plans", billingCtrl.ListPublicPlans)

	// Phase 8: Institute audit log history
	adminTenant.Get("/audit-logs", auditCtrl.ListTenantAuditLogs)

	// Phase 3: Institute Support Tickets
	adminTenant.Post("/support/tickets", supportCtrl.CreateTenantTicket)
	adminTenant.Get("/support/tickets", supportCtrl.ListTenantTickets)

	// Academic operations
	adminTenant.Post("/students", academicCtrl.CreateStudent)
	adminTenant.Get("/students", academicCtrl.ListStudents)
	adminTenant.Put("/students/:id", academicCtrl.UpdateStudent)
	adminTenant.Post("/students/upload-document", academicCtrl.UploadStudentDocument)
	adminTenant.Post("/enrollments", academicCtrl.EnrollStudent)
	adminTenant.Post("/enrollments/:id/transfer", academicCtrl.TransferSection)

	// Guardians operations (Phase 3 & Mobile Apps preparation)
	adminTenant.Get("/guardians", academicCtrl.ListGuardians)
	adminTenant.Post("/guardians", academicCtrl.CreateGuardian)
	adminTenant.Post("/guardians/link-student", academicCtrl.LinkStudentToGuardian)
	adminTenant.Delete("/guardians/relations/:relationId", academicCtrl.UnlinkStudentFromGuardian)

	// Academic Structure, Grades, Classes & Curricula Management
	adminTenant.Get("/academic/structure", academicCtrl.GetAcademicStructure)
	adminTenant.Post("/academic/programs", academicCtrl.CreateEducationalProgram)
	adminTenant.Put("/academic/programs/:id", academicCtrl.UpdateEducationalProgram)
	adminTenant.Delete("/academic/programs/:id", academicCtrl.DeleteEducationalProgram)
	adminTenant.Post("/academic/grades", academicCtrl.CreateStudyGrade)
	adminTenant.Put("/academic/grades/:id", academicCtrl.UpdateStudyGrade)
	adminTenant.Delete("/academic/grades/:id", academicCtrl.DeleteStudyGrade)
	adminTenant.Post("/academic/sections", academicCtrl.CreateClassSection)
	adminTenant.Delete("/academic/sections/:id", academicCtrl.DeleteClassSection)
	adminTenant.Get("/academic/subjects", academicCtrl.ListSubjects)
	adminTenant.Post("/academic/subjects", academicCtrl.CreateSubject)
	adminTenant.Delete("/academic/subjects/:id", academicCtrl.DeleteSubject)
	adminTenant.Post("/academic/curricula/adopt", academicCtrl.AdoptCurriculum)
	adminTenant.Delete("/academic/curricula/adopt/:id", academicCtrl.RemoveAdoptedCurriculum)
	adminTenant.Post("/academic/initialize-defaults", academicCtrl.InitializeDefaultStructure)

	// Assessment & Attendance operations
	adminTenant.Post("/attendance", assessmentCtrl.RecordAttendance)
	adminTenant.Post("/grades", assessmentCtrl.SubmitGrade)
	adminTenant.Put("/grades/:id/revise", assessmentCtrl.ReviseGrade)
	adminTenant.Get("/students/:student_id/grades", assessmentCtrl.ListStudentGrades)

	// Educational Finance operations
	adminTenant.Post("/finance/charges", financeCtrl.CreateCharge)
	adminTenant.Get("/students/:student_id/charges", financeCtrl.ListStudentCharges)
	adminTenant.Post("/finance/payments", financeCtrl.CollectPayment)
	adminTenant.Post("/finance/refunds", financeCtrl.ProcessRefund)

	// HR, Staff & Teacher Operations (HR-7)
	adminTenant.Post("/hr/staff", hrCtrl.CreateStaff)
	adminTenant.Get("/hr/staff", hrCtrl.ListStaff)
	adminTenant.Post("/hr/teachers", hrCtrl.CreateTeacher)
	adminTenant.Get("/hr/teachers", hrCtrl.ListTeachers)
	adminTenant.Get("/hr/teachers/:id", hrCtrl.GetTeacher)
	adminTenant.Put("/hr/teachers/:id", hrCtrl.UpdateTeacher)
	adminTenant.Patch("/hr/teachers/:id/status", hrCtrl.ToggleTeacherStatus)
	adminTenant.Get("/hr/curricula", hrCtrl.ListAdoptedCurricula)
	adminTenant.Post("/hr/teachers/:id/assignments", hrCtrl.CreateTeacherAssignment)
	adminTenant.Delete("/hr/teachers/assignments/:assignment_id", hrCtrl.TerminateTeacherAssignment)
	adminTenant.Get("/hr/payouts/accruals", hrCtrl.ListPayoutAccruals)
	adminTenant.Post("/hr/payouts/accruals/:id/approve", hrCtrl.ApprovePayoutAccrual)
	adminTenant.Post("/hr/payouts/accruals/:id/disburse", hrCtrl.DisbursePayout)

	// Homeworks & Daily Preparations Management for Institute Admin
	adminTenant.Get("/homeworks", homeworkCtrl.ListHomeworks)
	adminTenant.Post("/homeworks", homeworkCtrl.CreateHomework)
	adminTenant.Post("/homeworks/upload", homeworkCtrl.UploadAttachment)
	adminTenant.Get("/homeworks/:id", homeworkCtrl.GetHomeworkDetails)
	adminTenant.Put("/homeworks/submissions/:submission_id/review", homeworkCtrl.ReviewSubmission)

	// School Homeworks (Tutoring Daily Preparations) for Institute Admin
	adminTenant.Get("/school-homeworks", homeworkCtrl.ListSchoolHomeworksFeed)
	adminTenant.Put("/school-homeworks/:id/acknowledge", homeworkCtrl.AcknowledgeSchoolHomework)
}

func handleLiveness(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":    "ok",
		"version":   "v1",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func handleReadiness(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 3*time.Second)
	defer cancel()

	checks := make(map[string]string)
	isReady := true
	reqID := middleware.GetRequestID(c)

	// Check Database
	if err := bootstrap.CheckDatabaseHealth(ctx); err != nil {
		zap.L().Error("Readiness probe: database health check failed",
			zap.String("request_id", reqID),
			zap.Error(err),
		)
		if config.Global.App.Env == "production" {
			checks["database"] = "failed: dependency unavailable"
		} else {
			checks["database"] = "failed: " + err.Error()
		}
		isReady = false
	} else {
		checks["database"] = "ok"
	}

	// Check Cache
	if err := bootstrap.CheckCacheHealth(ctx); err != nil {
		zap.L().Error("Readiness probe: cache health check failed",
			zap.String("request_id", reqID),
			zap.Error(err),
		)
		if config.Global.App.Env == "production" {
			checks["cache"] = "failed: dependency unavailable"
		} else {
			checks["cache"] = "failed: " + err.Error()
		}
		isReady = false
	} else {
		checks["cache"] = "ok"
	}

	if !isReady {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"status":     "unavailable",
			"checks":     checks,
			"request_id": reqID,
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":     "ready",
		"checks":     checks,
		"request_id": reqID,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}
