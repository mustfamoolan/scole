import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { apiRequest } from '../api/client';
import {
  AcademicStructureData,
  EducationalProgram,
  StudyGrade,
  ClassSection,
  AdoptedCurriculum,
  Subject,
} from '../types';
import { useAuth } from './AuthContext';

export interface AcademicFilterState {
  programId: string; // 'all' or UUID
  gradeId: string;   // 'all' or UUID
  sectionId: string; // 'all' or UUID
  curriculumId: string; // 'all' or UUID
  searchQuery: string;
}

export interface AcademicFilterContextValue {
  // Raw Data
  structure: AcademicStructureData | null;
  loading: boolean;
  error: string | null;
  refreshStructure: () => Promise<void>;

  // Filter State
  filters: AcademicFilterState;
  setProgramId: (id: string) => void;
  setGradeId: (id: string) => void;
  setSectionId: (id: string) => void;
  setCurriculumId: (id: string) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
  setFilterBatch: (updates: Partial<AcademicFilterState>) => void;

  // Filtered & Available Options (Cascaded)
  availablePrograms: EducationalProgram[];
  availableGrades: StudyGrade[];
  availableSections: ClassSection[];
  availableCurricula: AdoptedCurriculum[];
  availableSubjects: Subject[];

  // Selected Entities
  selectedProgram: EducationalProgram | null;
  selectedGrade: StudyGrade | null;
  selectedSection: ClassSection | null;
  selectedCurriculum: AdoptedCurriculum | null;

  // Active Summary
  filterSummary: {
    programName: string;
    gradeName: string;
    sectionName: string;
    curriculumName: string;
    hasActiveFilter: boolean;
    breadcrumb: string[];
  };
}

const defaultState: AcademicFilterState = {
  programId: 'all',
  gradeId: 'all',
  sectionId: 'all',
  curriculumId: 'all',
  searchQuery: '',
};

const AcademicFilterContext = createContext<AcademicFilterContextValue | null>(null);

const STORAGE_KEY_PREFIX = 'aylia_academic_filter_';

export const AcademicFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant, user } = useAuth();
  const tenantId = tenant?.id || 'default';

  const [structure, setStructure] = useState<AcademicStructureData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize filters from localStorage if saved
  const [filters, setFilters] = useState<AcademicFilterState>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tenantId}`);
      if (saved) {
        return { ...defaultState, ...JSON.parse(saved) };
      }
    } catch {
      // ignore JSON parse error
    }
    return defaultState;
  });

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (tenantId) {
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantId}`, JSON.stringify(filters));
      } catch {
        // ignore storage error
      }
    }
  }, [filters, tenantId]);

  // Fetch academic structure for the active tenant
  const fetchStructure = useCallback(async () => {
    if (!user || user.role === 'platform_admin' || !tenantId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: AcademicStructureData }>(
        '/api/v1/tenant/admin/academic/structure'
      );
      if (res.data) {
        setStructure(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحميل بيانات الهيكل الأكاديمي';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, tenantId]);

  useEffect(() => {
    fetchStructure();
  }, [fetchStructure]);

  // Available programs
  const availablePrograms = useMemo(() => {
    return structure?.programs || [];
  }, [structure]);

  // Available grades cascaded by programId
  const availableGrades = useMemo(() => {
    if (!structure?.programs) return [];
    if (filters.programId === 'all') {
      return structure.programs.flatMap((p) => p.grades || []);
    }
    const prog = structure.programs.find((p) => p.id === filters.programId);
    return prog?.grades || [];
  }, [structure, filters.programId]);

  // Available sections cascaded by gradeId
  const availableSections = useMemo(() => {
    if (!availableGrades.length) return [];
    if (filters.gradeId === 'all') {
      return availableGrades.flatMap((g) => g.sections || []);
    }
    const grade = availableGrades.find((g) => g.id === filters.gradeId);
    return grade?.sections || [];
  }, [availableGrades, filters.gradeId]);

  // Available curricula cascaded by gradeId
  const availableCurricula = useMemo(() => {
    const list = structure?.adopted_curricula || [];
    if (filters.gradeId === 'all') {
      if (filters.programId === 'all') return list;
      const gradeIds = new Set(availableGrades.map((g) => g.id));
      return list.filter((c) => c.study_grade_id && gradeIds.has(c.study_grade_id));
    }
    return list.filter((c) => c.study_grade_id === filters.gradeId);
  }, [structure, availableGrades, filters.gradeId, filters.programId]);

  const availableSubjects = useMemo(() => {
    return structure?.subjects || [];
  }, [structure]);

  // Validate filter cascade whenever structure or parent selections change
  useEffect(() => {
    setFilters((prev) => {
      let changed = false;
      const next = { ...prev };

      // 1. If programId is not 'all', verify it exists
      if (next.programId !== 'all') {
        const progExists = availablePrograms.some((p) => p.id === next.programId);
        if (!progExists) {
          next.programId = 'all';
          next.gradeId = 'all';
          next.sectionId = 'all';
          next.curriculumId = 'all';
          changed = true;
        }
      }

      // 2. If gradeId is not 'all', verify it belongs to current available grades
      if (next.gradeId !== 'all') {
        const gradeExists = availableGrades.some((g) => g.id === next.gradeId);
        if (!gradeExists) {
          next.gradeId = 'all';
          next.sectionId = 'all';
          next.curriculumId = 'all';
          changed = true;
        }
      }

      // 3. If sectionId is not 'all', verify it belongs to current available sections
      if (next.sectionId !== 'all') {
        const secExists = availableSections.some((s) => s.id === next.sectionId);
        if (!secExists) {
          next.sectionId = 'all';
          changed = true;
        }
      }

      // 4. If curriculumId is not 'all', verify it belongs to available curricula
      if (next.curriculumId !== 'all') {
        const curExists = availableCurricula.some((c) => c.id === next.curriculumId);
        if (!curExists) {
          next.curriculumId = 'all';
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [availablePrograms, availableGrades, availableSections, availableCurricula]);

  // Selected Entities
  const selectedProgram = useMemo(() => {
    if (filters.programId === 'all') return null;
    return availablePrograms.find((p) => p.id === filters.programId) || null;
  }, [availablePrograms, filters.programId]);

  const selectedGrade = useMemo(() => {
    if (filters.gradeId === 'all') return null;
    return availableGrades.find((g) => g.id === filters.gradeId) || null;
  }, [availableGrades, filters.gradeId]);

  const selectedSection = useMemo(() => {
    if (filters.sectionId === 'all') return null;
    return availableSections.find((s) => s.id === filters.sectionId) || null;
  }, [availableSections, filters.sectionId]);

  const selectedCurriculum = useMemo(() => {
    if (filters.curriculumId === 'all') return null;
    return availableCurricula.find((c) => c.id === filters.curriculumId) || null;
  }, [availableCurricula, filters.curriculumId]);

  // Handlers with automatic cascade reset
  const setProgramId = useCallback((id: string) => {
    setFilters((prev) => {
      if (prev.programId === id) return prev;
      return {
        ...prev,
        programId: id,
        gradeId: 'all',
        sectionId: 'all',
        curriculumId: 'all',
      };
    });
  }, []);

  const setGradeId = useCallback((id: string) => {
    setFilters((prev) => {
      if (prev.gradeId === id) return prev;
      return {
        ...prev,
        gradeId: id,
        sectionId: 'all',
        curriculumId: 'all',
      };
    });
  }, []);

  const setSectionId = useCallback((id: string) => {
    setFilters((prev) => ({ ...prev, sectionId: id }));
  }, []);

  const setCurriculumId = useCallback((id: string) => {
    setFilters((prev) => ({ ...prev, curriculumId: id }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultState);
  }, []);

  const setFilterBatch = useCallback((updates: Partial<AcademicFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  // Filter summary & breadcrumbs
  const filterSummary = useMemo(() => {
    const breadcrumb: string[] = [];
    if (selectedProgram) breadcrumb.push(selectedProgram.name);
    if (selectedGrade) breadcrumb.push(selectedGrade.name);
    if (selectedSection) breadcrumb.push(`شعبة ${selectedSection.name}`);
    if (selectedCurriculum) {
      const subName = selectedCurriculum.curriculum_edition?.definition?.subject?.name || 'مادة دراسية';
      breadcrumb.push(subName);
    }

    const hasActiveFilter =
      filters.programId !== 'all' ||
      filters.gradeId !== 'all' ||
      filters.sectionId !== 'all' ||
      filters.curriculumId !== 'all' ||
      Boolean(filters.searchQuery.trim());

    return {
      programName: selectedProgram?.name || 'جميع المراحل',
      gradeName: selectedGrade?.name || 'جميع الصفوف',
      sectionName: selectedSection ? `شعبة ${selectedSection.name}` : 'جميع الشعب',
      curriculumName:
        selectedCurriculum?.curriculum_edition?.definition?.subject?.name || 'جميع المواد والمناهج',
      hasActiveFilter,
      breadcrumb,
    };
  }, [selectedProgram, selectedGrade, selectedSection, selectedCurriculum, filters]);

  const value: AcademicFilterContextValue = {
    structure,
    loading,
    error,
    refreshStructure: fetchStructure,
    filters,
    setProgramId,
    setGradeId,
    setSectionId,
    setCurriculumId,
    setSearchQuery,
    resetFilters,
    setFilterBatch,
    availablePrograms,
    availableGrades,
    availableSections,
    availableCurricula,
    availableSubjects,
    selectedProgram,
    selectedGrade,
    selectedSection,
    selectedCurriculum,
    filterSummary,
  };

  return <AcademicFilterContext.Provider value={value}>{children}</AcademicFilterContext.Provider>;
};

export const useAcademicFilter = (): AcademicFilterContextValue => {
  const context = useContext(AcademicFilterContext);
  if (!context) {
    throw new Error('useAcademicFilter must be used within an AcademicFilterProvider');
  }
  return context;
};
