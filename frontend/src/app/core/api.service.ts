import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';
import { Course, CourseOption, CourseStudent, EnrollmentRecord, InstructorInfo, NewCourseInput, TeachingRecord, WaitlistRecord } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getCatalog() { return this.http.get<Course[]>(`${API_URL}/courses`); }
  getMyCourses() { return this.http.get<Course[]>(`${API_URL}/courses/mine`); }
  getCourseOptions() { return this.http.get<CourseOption[]>(`${API_URL}/courses/options`); }
  getInstructors() { return this.http.get<InstructorInfo[]>(`${API_URL}/courses/instructors`); }
  getTeaching() { return this.http.get<TeachingRecord[]>(`${API_URL}/courses/teaching`); }
  createCourse(body: NewCourseInput) { return this.http.post<Course>(`${API_URL}/courses`, body); }
  updateCourse(id: number, body: NewCourseInput) { return this.http.put<Course>(`${API_URL}/courses/${id}`, body); }
  deleteCourse(id: number) { return this.http.delete<void>(`${API_URL}/courses/${id}`); }

  getCourseStudents(courseId: number) { return this.http.get<CourseStudent[]>(`${API_URL}/courses/${courseId}/students`); }
  markCompleted(courseId: number, studentId: number) {
    return this.http.post<void>(`${API_URL}/courses/${courseId}/completions`, { studentId });
  }

  getEnrollments() { return this.http.get<EnrollmentRecord[]>(`${API_URL}/enrollments`); }
  enroll(courseId: number, lectureSlotId: number, practiceSlotId: number) {
    return this.http.post<EnrollmentRecord>(`${API_URL}/enrollments`, { courseId, lectureSlotId, practiceSlotId });
  }
  changePractice(enrollmentId: number, practiceSlotId: number) {
    return this.http.patch<EnrollmentRecord>(`${API_URL}/enrollments/${enrollmentId}/practice`, { practiceSlotId });
  }
  drop(enrollmentId: number) { return this.http.delete<void>(`${API_URL}/enrollments/${enrollmentId}`); }

  getWaitlist() { return this.http.get<WaitlistRecord[]>(`${API_URL}/waitlist`); }
  joinWaitlist(courseId: number, practiceSlotId: number) {
    return this.http.post<WaitlistRecord>(`${API_URL}/waitlist`, { courseId, practiceSlotId });
  }
  leaveWaitlist(id: number) { return this.http.delete<void>(`${API_URL}/waitlist/${id}`); }
}
