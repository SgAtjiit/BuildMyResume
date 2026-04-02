export type BackendUser = {
  _id?: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  customDomain?: string;
  notificationsEnabled?: boolean;
  linkedInUrl?: string;
  githubUrl?: string;
  leetCodeId?: string;
  geeksForGeeksId?: string;
  education?: string[];
  educationEntries?: {
    degree: string;
    specialization?: string;
    college: string;
    location?: string;
    endDate?: string;
    grade?: string;
  }[];
  skillLanguages?: string[];
  skillFrameworks?: string[];
  skillTools?: string[];
  skillLibraries?: string[];
  skillSections?: {
    title: string;
    skills: string[];
  }[];
  experience?: {
    role: string;
    company: string;
    location?: string;
    date?: string;
    bullets: string[];
  }[];
  achievements?: {
    title: string;
    date?: string;
    bullets: string[];
  }[];
  lastLoginAt: string;
};
