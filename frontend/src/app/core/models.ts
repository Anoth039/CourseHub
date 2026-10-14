export type Role = 'student' | 'instructor';
export type CompletionType = 'Kollokvium' | 'Gyakorlati jegy' | 'Aláírás';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  studentId: string | null;
  major: string | null;
  semester: number | null;
  maxCredits: number | null;
  title: string | null;
  department: string | null;
}

export interface CourseSlot {
  id: number;
  name: string;
  schedule: string;
  instructor: string;
  instructorId: number | null;
  location: string;
  capacity: number;
  enrolledCount: number;
}

export interface CoursePrerequisite { id: number; code: string; title: string; met: boolean; }
export interface CourseOption { id: number; code: string; title: string; }

export interface Course {
  id: number;
  code: string;
  title: string;
  department: string;
  credits: number;
  semester: string;
  recommendedSemester: number;
  completionType: CompletionType;
  description: string;
  prerequisites: CoursePrerequisite[];
  prerequisiteMet: boolean;
  completed: boolean;
  lectures: CourseSlot[];
  practices: CourseSlot[];
}

export interface EnrollmentRecord {
  id: number;
  courseId: number;
  courseCode: string;
  courseTitle: string;
  credits: number;
  lecture: CourseSlot;
  practice: CourseSlot;
  enrolledAt: string;
  status: string;
}

export interface WaitlistRecord {
  id: number;
  courseId: number;
  courseCode: string;
  courseTitle: string;
  credits: number;
  practice: CourseSlot;
  position: number;
  createdAt: string;
}

export interface PracticeInput { id?: number; name: string; instructorId?: number | null; schedule: string; location: string; capacity: number; enrolledCount?: number; }

export interface NewCourseInput {
  code: string;
  title: string;
  credits: number;
  recommendedSemester: number;
  completionType: CompletionType;
  description: string;
  prerequisiteIds: number[];
  lecture: { schedule: string; location: string };
  practices: PracticeInput[];
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

export interface CourseStudent {
  id: number;
  name: string;
  studentId: string | null;
  major: string | null;
  semester: number | null;
  lecture: string;
  practice: string;
  completed: boolean;
}

export interface InstructorInfo {
  id: number;
  name: string;
  title: string | null;
  department: string | null;
  busy: { courseId: number; schedule: string; label: string }[];
}

export interface TeachingRecord {
  courseId: number;
  code: string;
  title: string;
  owner: string;
  slot: CourseSlot;
}
