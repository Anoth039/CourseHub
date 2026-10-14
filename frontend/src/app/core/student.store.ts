import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { Course, EnrollmentRecord, WaitlistRecord } from './models';

/** A hallgatói oldalak közös állapota (katalógus + saját jelentkezések). */
@Injectable({ providedIn: 'root' })
export class StudentStore {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  readonly courses = signal<Course[]>([]);
  readonly enrollments = signal<EnrollmentRecord[]>([]);
  readonly waitlist = signal<WaitlistRecord[]>([]);
  readonly loading = signal(false);

  readonly maxCredits = computed(() => this.auth.user()?.maxCredits ?? 30);
  readonly totalCredits = computed(() => this.enrollments().reduce((s, e) => s + e.credits, 0));

  load(): void {
    this.loading.set(true);
    forkJoin({
      courses: this.api.getCatalog(),
      enrollments: this.api.getEnrollments(),
      waitlist: this.api.getWaitlist()
    }).subscribe({
      next: (r) => {
        this.courses.set(r.courses);
        this.enrollments.set(r.enrollments);
        this.waitlist.set(r.waitlist);
        this.loading.set(false);
      },
      error: (e) => { this.loading.set(false); this.toast.error(e, 'Az adatok betöltése sikertelen'); }
    });
  }

  waitlistEntry(courseId: number): WaitlistRecord | undefined {
    return this.waitlist().find((w) => w.courseId === courseId);
  }

  isEnrolled(courseId: number): boolean {
    return this.enrollments().some((e) => e.courseId === courseId);
  }
}
