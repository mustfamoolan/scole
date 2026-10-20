package seeders

import (
	"errors"
	"fmt"
	"time"

	"institute/app/models"

	"github.com/fatih/color"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// MaryaTeachersSeeder seeds 11 male and female teachers for the "marya" school tenant with whole IQD amounts.
type MaryaTeachersSeeder struct{}

type teacherSeedData struct {
	StaffNumber    string
	FirstName      string
	FatherName     string
	LastName       string
	Gender         string
	Specialization string
	EmploymentType string
	HourlyRate     int64
	MonthlySalary  int64
	Phone          string
	Email          string
}

func (s *MaryaTeachersSeeder) Run(db *gorm.DB) error {
	// 1. Locate "marya" tenant
	var tenant models.Tenant
	err := db.Where("slug = ?", "marya").First(&tenant).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Fallback: search by known ID or create if not present
			maryaID, _ := uuid.Parse("92082ab3-181e-4cf2-bf15-1acc429d3ee2")
			if errID := db.Where("id = ?", maryaID).First(&tenant).Error; errID != nil {
				return fmt.Errorf("tenant with slug 'marya' not found: %w", err)
			}
		} else {
			return fmt.Errorf("failed to locate tenant 'marya': %w", err)
		}
	}

	fmt.Printf("%s Seeding 11 teachers for school: %s (%s)...\n",
		color.CyanString("ℹ"),
		color.GreenString(tenant.Name),
		color.YellowString(tenant.Slug),
	)

	// 2. Define 11 teachers (6 men, 5 women) with Iraqi Dinar without fils (integers)
	teachers := []teacherSeedData{
		{
			StaffNumber:    "TCH-2026-001",
			FirstName:      "أحمد",
			FatherName:     "كريم",
			LastName:       "السعدي",
			Gender:         "male",
			Specialization: "الرياضيات والتحليل الجبري",
			EmploymentType: "per_session",
			HourlyRate:     30000, // 30,000 د.ع للحصة
			MonthlySalary:  0,
			Phone:          "07701234561",
			Email:          "ahmed.saadi@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-002",
			FirstName:      "زينب",
			FatherName:     "علي",
			LastName:       "الموسوي",
			Gender:         "female",
			Specialization: "اللغة العربية وقواعد النحو",
			EmploymentType: "full_time",
			HourlyRate:     0,
			MonthlySalary:  1200000, // 1,200,000 د.ع شهرياً
			Phone:          "07802345672",
			Email:          "zainab.mousawi@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-003",
			FirstName:      "حيدر",
			FatherName:     "مهدي",
			LastName:       "الربيعي",
			Gender:         "male",
			Specialization: "الفيزياء المتقدمة للمرحلة الإعدادية",
			EmploymentType: "per_session",
			HourlyRate:     35000, // 35,000 د.ع للحصة
			MonthlySalary:  0,
			Phone:          "07713456783",
			Email:          "haider.rubaie@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-004",
			FirstName:      "مريم",
			FatherName:     "عبد الله",
			LastName:       "الكرخي",
			Gender:         "female",
			Specialization: "الكيمياء العضوية والتطبيقية",
			EmploymentType: "full_time",
			HourlyRate:     0,
			MonthlySalary:  1100000, // 1,100,000 د.ع شهرياً
			Phone:          "07504567894",
			Email:          "maryam.karkhi@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-005",
			FirstName:      "مصطفى",
			FatherName:     "جاسم",
			LastName:       "الزبيدي",
			Gender:         "male",
			Specialization: "اللغة الإنجليزية والمحادثة",
			EmploymentType: "per_session",
			HourlyRate:     25000, // 25,000 د.ع للحصة
			MonthlySalary:  0,
			Phone:          "07725678905",
			Email:          "mustafa.zubaidi@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-006",
			FirstName:      "فاطمة",
			FatherName:     "صادق",
			LastName:       "الخفاجي",
			Gender:         "female",
			Specialization: "علم الأحياء وعلم الوراثة",
			EmploymentType: "full_time",
			HourlyRate:     0,
			MonthlySalary:  1250000, // 1,250,000 د.ع شهرياً
			Phone:          "07816789016",
			Email:          "fatima.khafaji@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-007",
			FirstName:      "عمر",
			FatherName:     "عادل",
			LastName:       "التميمي",
			Gender:         "male",
			Specialization: "الحاسوب وتكنولوجيا المعلومات والبرمجة",
			EmploymentType: "full_time",
			HourlyRate:     0,
			MonthlySalary:  1350000, // 1,350,000 د.ع شهرياً
			Phone:          "07737890127",
			Email:          "omar.tamimi@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-008",
			FirstName:      "نور الهدى",
			FatherName:     "حميد",
			LastName:       "الجبوري",
			Gender:         "female",
			Specialization: "التاريخ والجغرافيا (الاجتماعيات)",
			EmploymentType: "per_session",
			HourlyRate:     20000, // 20,000 د.ع للحصة
			MonthlySalary:  0,
			Phone:          "07518901238",
			Email:          "nour.jubouri@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-009",
			FirstName:      "محمد",
			FatherName:     "هادي",
			LastName:       "الشمري",
			Gender:         "male",
			Specialization: "التربية الإسلامية وأحكام التلاوة",
			EmploymentType: "full_time",
			HourlyRate:     0,
			MonthlySalary:  950000, // 950,000 د.ع شهرياً
			Phone:          "07829012349",
			Email:          "mohammed.shammari@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-010",
			FirstName:      "سارة",
			FatherName:     "رعد",
			LastName:       "البصري",
			Gender:         "female",
			Specialization: "اللغة الفرنسية والآداب",
			EmploymentType: "per_session",
			HourlyRate:     30000, // 30,000 د.ع للحصة
			MonthlySalary:  0,
			Phone:          "07740123450",
			Email:          "sara.basri@marya.edu.iq",
		},
		{
			StaffNumber:    "TCH-2026-011",
			FirstName:      "علي",
			FatherName:     "حسن",
			LastName:       "الدليمي",
			Gender:         "male",
			Specialization: "العلوم العامة والفيزياء المتوسطة",
			EmploymentType: "part_time",
			HourlyRate:     0,
			MonthlySalary:  650000, // 650,000 د.ع شهرياً
			Phone:          "07831234561",
			Email:          "ali.dulaimi@marya.edu.iq",
		},
	}

	for _, item := range teachers {
		// Check if already seeded by staff number
		var existing models.TeacherProfile
		err := db.Where("tenant_id = ? AND staff_number = ?", tenant.ID, item.StaffNumber).First(&existing).Error
		if err == nil {
			// Update existing teacher to match seed values
			spec := item.Specialization
			existing.Specialization = &spec
			existing.EmploymentType = item.EmploymentType
			existing.Status = "active"
			if item.HourlyRate > 0 {
				hr := decimal.NewFromInt(item.HourlyRate)
				existing.HourlyRate = &hr
				existing.MonthlySalary = nil
			} else if item.MonthlySalary > 0 {
				ms := decimal.NewFromInt(item.MonthlySalary)
				existing.MonthlySalary = &ms
				existing.HourlyRate = nil
			}
			db.Save(&existing)
			continue
		}

		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("failed checking teacher %s: %w", item.StaffNumber, err)
		}

		// 3. Create Person
		person := models.Person{
			FirstName:  item.FirstName,
			FatherName: &item.FatherName,
			LastName:   item.LastName,
			Gender:     item.Gender,
		}
		if err := db.Create(&person).Error; err != nil {
			return fmt.Errorf("failed to create person for %s: %w", item.StaffNumber, err)
		}

		// 4. Communication channels
		phoneChan := models.CommunicationChannel{
			PersonID:     person.ID,
			ChannelType:  "phone",
			ChannelValue: item.Phone,
			IsPrimary:    true,
			IsVerified:   true,
		}
		db.Create(&phoneChan)

		emailChan := models.CommunicationChannel{
			PersonID:     person.ID,
			ChannelType:  "email",
			ChannelValue: item.Email,
			IsPrimary:    true,
			IsVerified:   true,
		}
		db.Create(&emailChan)

		// 5. Tenant membership
		membership := models.TenantMembership{
			TenantID: tenant.ID,
			PersonID: person.ID,
			Status:   "active",
			JoinedAt: time.Now(),
		}
		db.Create(&membership)

		// 6. Teacher profile
		spec := item.Specialization
		newTeacher := models.TeacherProfile{
			TenantID:       tenant.ID,
			PersonID:       person.ID,
			StaffNumber:    item.StaffNumber,
			Specialization: &spec,
			EmploymentType: item.EmploymentType,
			Status:         "active",
		}
		if item.HourlyRate > 0 {
			hr := decimal.NewFromInt(item.HourlyRate)
			newTeacher.HourlyRate = &hr
		} else if item.MonthlySalary > 0 {
			ms := decimal.NewFromInt(item.MonthlySalary)
			newTeacher.MonthlySalary = &ms
		}

		if err := db.Create(&newTeacher).Error; err != nil {
			return fmt.Errorf("failed to create teacher %s: %w", item.StaffNumber, err)
		}
	}

	fmt.Printf("%s 11 teachers seeded successfully for %s in Iraqi Dinars (IQD).\n",
		color.GreenString("✔"),
		tenant.Name,
	)
	return nil
}
