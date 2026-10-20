import React from 'react';
import {
  Layers,
  GraduationCap,
  DoorOpen,
  BookOpen,
  Search,
  RotateCcw,
  ChevronLeft,
  X,
  Filter,
} from 'lucide-react';
import { Button, Input, Badge, Card } from '@/components/ui';
import { useAcademicFilter } from '../../context/AcademicFilterContext';

export interface AcademicFilterBarProps {
  title?: string;
  subtitle?: string;
  showProgram?: boolean;
  showGrade?: boolean;
  showSection?: boolean;
  showCurriculum?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  allowAll?: boolean;
  compact?: boolean;
  extraActions?: React.ReactNode;
  className?: string;
}

export const AcademicFilterBar: React.FC<AcademicFilterBarProps> = ({
  title,
  subtitle,
  showProgram = true,
  showGrade = true,
  showSection = false,
  showCurriculum = false,
  showSearch = true,
  searchPlaceholder = 'بحث بالاسم، الرمز...',
  allowAll = true,
  compact = false,
  extraActions,
  className = '',
}) => {
  const {
    filters,
    setProgramId,
    setGradeId,
    setSectionId,
    setCurriculumId,
    setSearchQuery,
    resetFilters,
    availablePrograms,
    availableGrades,
    availableSections,
    availableCurricula,
    filterSummary,
    loading,
  } = useAcademicFilter();

  return (
    <Card
      className={`border border-border bg-card shadow-xs transition-all ${
        compact ? 'p-3' : 'p-4'
      } ${className}`}
    >
      {/* Top Bar Header & Active Breadcrumb */}
      {(title || filterSummary.hasActiveFilter || extraActions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 pb-3 border-b border-border/70">
          <div className="flex flex-wrap items-center gap-2.5">
            {title && (
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">{title}</h3>
                  {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
            )}

            {/* Active Path Breadcrumbs */}
            {filterSummary.breadcrumb.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap bg-secondary/50 border border-border px-2.5 py-1 rounded-lg text-xs">
                <span className="text-[10px] text-muted-foreground font-medium">المسار:</span>
                {filterSummary.breadcrumb.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronLeft className="w-3 h-3 text-muted-foreground" />}
                    <span className="text-primary font-bold text-[11px]">{crumb}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mr-auto">
            {filterSummary.hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تصفير</span>
              </Button>
            )}
            {extraActions}
          </div>
        </div>
      )}

      {/* Filter Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-end">
        {/* 1. Stage / Program Selector */}
        {showProgram && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>المرحلة التعليمية</span>
            </label>
            <select
              value={filters.programId}
              onChange={(e) => setProgramId(e.target.value)}
              disabled={loading}
              className="w-full h-9 bg-background border border-input text-foreground text-xs rounded-lg px-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition disabled:opacity-50"
            >
              {allowAll && <option value="all">جميع المراحل ({availablePrograms.length})</option>}
              {availablePrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.grades ? `(${p.grades.length} صفوف)` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 2. Study Grade Selector */}
        {showGrade && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              <span>الصف الدراسي</span>
            </label>
            <select
              value={filters.gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              disabled={loading || availableGrades.length === 0}
              className="w-full h-9 bg-background border border-input text-foreground text-xs rounded-lg px-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition disabled:opacity-50"
            >
              {allowAll && <option value="all">جميع الصفوف ({availableGrades.length})</option>}
              {availableGrades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 3. Section Selector (Optional) */}
        {showSection && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>الشعبة</span>
            </label>
            <select
              value={filters.sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={loading || availableSections.length === 0}
              className="w-full h-9 bg-background border border-input text-foreground text-xs rounded-lg px-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition disabled:opacity-50"
            >
              {allowAll && (
                <option value="all">
                  {availableSections.length > 0
                    ? `جميع الشعب (${availableSections.length})`
                    : 'لا توجد شعب'}
                </option>
              )}
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>
                  شعبة {s.name} {s.capacity ? `(${s.capacity} مقعد)` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 4. Curriculum Selector (Optional) */}
        {showCurriculum && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              <span>المادة الدراسية</span>
            </label>
            <select
              value={filters.curriculumId}
              onChange={(e) => setCurriculumId(e.target.value)}
              disabled={loading || availableCurricula.length === 0}
              className="w-full h-9 bg-background border border-input text-foreground text-xs rounded-lg px-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition disabled:opacity-50"
            >
              {allowAll && <option value="all">جميع المواد ({availableCurricula.length})</option>}
              {availableCurricula.map((c) => {
                const subName = c.curriculum_edition?.definition?.subject?.name || 'مادة دراسية';
                return (
                  <option key={c.id} value={c.id}>
                    {subName} {c.study_grade?.name ? `(${c.study_grade.name})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* 5. Live Search Input */}
        {showSearch && (
          <div className={`space-y-1.5 ${!showSection && !showCurriculum ? 'md:col-span-1' : ''}`}>
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <span>بحث سريع</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={filters.searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 bg-background border-input text-xs pl-8 pr-3 rounded-lg"
              />
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
