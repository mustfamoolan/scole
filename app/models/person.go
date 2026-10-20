package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Person represents a central human identity across all institutions and roles.
type Person struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	NationalIDNumber *string        `gorm:"type:varchar(50);uniqueIndex" json:"national_id_number,omitempty"`
	FirstName        string         `gorm:"type:varchar(100);not null" json:"first_name"`
	FatherName       *string        `gorm:"type:varchar(100)" json:"father_name,omitempty"`
	GrandfatherName  *string        `gorm:"type:varchar(100)" json:"grandfather_name,omitempty"`
	LastName         string         `gorm:"type:varchar(100);not null" json:"last_name"`
	Gender           string         `gorm:"type:varchar(20);not null" json:"gender"`
	DateOfBirth      *time.Time     `json:"date_of_birth,omitempty"`
	Nationality      *string        `gorm:"type:varchar(50)" json:"nationality,omitempty"`
	MotherName       *string        `gorm:"type:varchar(100)" json:"mother_name,omitempty"`
	MotherFatherName *string        `gorm:"type:varchar(100)" json:"mother_father_name,omitempty"`
	PlaceOfBirth     *string        `gorm:"type:varchar(100)" json:"place_of_birth,omitempty"`
	BloodType        *string        `gorm:"type:varchar(10)" json:"blood_type,omitempty"`
	Governorate      *string        `gorm:"type:varchar(100)" json:"governorate,omitempty"`
	CityDistrict     *string        `gorm:"type:varchar(100)" json:"city_district,omitempty"`
	Neighborhood     *string        `gorm:"type:varchar(100)" json:"neighborhood,omitempty"`
	StreetAlley      *string        `gorm:"type:varchar(50)" json:"street_alley,omitempty"`
	HouseNumber      *string        `gorm:"type:varchar(50)" json:"house_number,omitempty"`
	NearestLandmark  *string        `gorm:"type:varchar(255)" json:"nearest_landmark,omitempty"`
	AvatarURL        *string        `gorm:"type:varchar(500)" json:"avatar_url,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	CommunicationChannels []CommunicationChannel `gorm:"foreignKey:PersonID" json:"communication_channels,omitempty"`
	TenantMemberships     []TenantMembership     `gorm:"foreignKey:PersonID" json:"tenant_memberships,omitempty"`
}

func (Person) TableName() string {
	return "persons"
}

// FullName returns the concatenated official name.
func (p *Person) FullName() string {
	name := p.FirstName
	if p.FatherName != nil && *p.FatherName != "" {
		name += " " + *p.FatherName
	}
	if p.GrandfatherName != nil && *p.GrandfatherName != "" {
		name += " " + *p.GrandfatherName
	}
	name += " " + p.LastName
	return name
}

// CommunicationChannel stores contact vectors for a person (phone, email, whatsapp).
type CommunicationChannel struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	PersonID     uuid.UUID `gorm:"type:uuid;not null;index" json:"person_id"`
	ChannelType  string    `gorm:"type:varchar(30);not null" json:"channel_type"` // email, phone, whatsapp, telegram
	ChannelValue string    `gorm:"type:varchar(255);not null;index" json:"channel_value"`
	IsVerified   bool      `gorm:"not null;default:false" json:"is_verified"`
	IsPrimary    bool      `gorm:"not null;default:false" json:"is_primary"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (CommunicationChannel) TableName() string {
	return "communication_channels"
}

// TenantMembership defines explicit affiliation between a Person and an Institution (Tenant).
type TenantMembership struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	TenantID  uuid.UUID  `gorm:"type:uuid;not null;index:idx_tenant_person,unique" json:"tenant_id"`
	PersonID  uuid.UUID  `gorm:"type:uuid;not null;index:idx_tenant_person,unique" json:"person_id"`
	Status    string     `gorm:"type:varchar(50);not null;default:'active';index" json:"status"` // active, suspended, terminated
	JoinedAt  time.Time  `json:"joined_at"`
	LeftAt    *time.Time `json:"left_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`

	Person Person  `gorm:"foreignKey:PersonID" json:"person,omitempty"`
	Tenant *Tenant `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
}

func (TenantMembership) TableName() string {
	return "tenant_memberships"
}
