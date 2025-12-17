import { create } from 'zustand';

interface UIStore {
  searchQuery: string;
  levelFilter: number | null;
  typeFilter: string | null;
  semesterFilter: 'S1' | 'S2' | null;
  showPrerequisitesMet: boolean;
  selectedCourse: string | null;
  isCoursePanelOpen: boolean;
  targetSemester: { year: number; semester: 1 | 2 } | null;
  showCourseModal: string | null;

  // Actions
  setSearchQuery: (query: string) => void;
  setLevelFilter: (level: number | null) => void;
  setTypeFilter: (type: string | null) => void;
  setSemesterFilter: (semester: 'S1' | 'S2' | null) => void;
  setShowPrerequisitesMet: (show: boolean) => void;
  setSelectedCourse: (courseCode: string | null) => void;
  openCoursePanel: (year: number, semester: 1 | 2) => void;
  closeCoursePanel: () => void;
  openCourseModal: (courseCode: string) => void;
  closeCourseModal: () => void;
  resetFilters: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  searchQuery: '',
  levelFilter: null,
  typeFilter: null,
  semesterFilter: null,
  showPrerequisitesMet: false,
  selectedCourse: null,
  isCoursePanelOpen: false,
  targetSemester: null,
  showCourseModal: null,

  setSearchQuery: (query) => set({ searchQuery: query }),
  setLevelFilter: (level) => set({ levelFilter: level }),
  setTypeFilter: (type) => set({ typeFilter: type }),
  setSemesterFilter: (semester) => set({ semesterFilter: semester }),
  setShowPrerequisitesMet: (show) => set({ showPrerequisitesMet: show }),
  setSelectedCourse: (courseCode) => set({ selectedCourse: courseCode }),

  openCoursePanel: (year, semester) => set({
    isCoursePanelOpen: true,
    targetSemester: { year, semester },
  }),

  closeCoursePanel: () => set({
    isCoursePanelOpen: false,
    targetSemester: null,
    searchQuery: '',
  }),

  openCourseModal: (courseCode) => set({ showCourseModal: courseCode }),
  closeCourseModal: () => set({ showCourseModal: null }),

  resetFilters: () => set({
    searchQuery: '',
    levelFilter: null,
    typeFilter: null,
    semesterFilter: null,
    showPrerequisitesMet: false,
  }),
}));
