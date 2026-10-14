import { Course } from './entities/Course';
import { CourseSlot } from './entities/CourseSlot';
import { Enrollment } from './entities/Enrollment';
import { User } from './entities/User';
import { WaitlistEntry } from './entities/WaitlistEntry';

export const slotDto = (s: CourseSlot) => ({
  id: s.id, name: s.name, schedule: s.schedule, instructor: s.instructor, instructorId: s.instructorUserId ?? null,
  location: s.location, capacity: s.capacity, enrolledCount: s.enrolledCount
});

export const courseDto = (c: Course, completedIds?: Set<number>) => {
  const slots = [...(c.slots ?? [])].sort((a, b) => a.id - b.id);
  return {
    id: c.id, code: c.code, title: c.title, department: c.department,
    credits: c.credits, semester: c.semester, recommendedSemester: c.recommendedSemester,
    completionType: c.completionType, description: c.description,
    prerequisites: (c.prerequisites ?? [])
      .map((p) => ({ id: p.id, code: p.code, title: p.title, met: completedIds instanceof Set ? completedIds.has(p.id) : true }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    prerequisiteMet: (c.prerequisites ?? []).every((p) => (completedIds instanceof Set ? completedIds.has(p.id) : true)),
    completed: completedIds instanceof Set ? completedIds.has(c.id) : false,
    lectures: slots.filter((s) => s.type === 'lecture').map(slotDto),
    practices: slots.filter((s) => s.type === 'practice').map(slotDto)
  };
};

export const enrollmentDto = (e: Enrollment) => ({
  id: e.id, courseId: e.course.id, courseCode: e.course.code, courseTitle: e.course.title,
  credits: e.course.credits, lecture: slotDto(e.lecture), practice: slotDto(e.practice),
  enrolledAt: e.enrolledAt, status: e.status
});

export const userDto = (u: User) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, studentId: u.studentId,
  major: u.major, semester: u.semester, maxCredits: u.maxCredits,
  title: u.title, department: u.department
});

export const waitlistDto = (w: WaitlistEntry, position: number) => ({
  id: w.id, courseId: w.course.id, courseCode: w.course.code, courseTitle: w.course.title,
  credits: w.course.credits, practice: slotDto(w.practice), position, createdAt: w.createdAt
});
