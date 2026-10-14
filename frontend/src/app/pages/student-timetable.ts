import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudentStore } from '../core/student.store';
import { Timetable, TimetableEvent } from '../shared/timetable';

@Component({
  selector: 'app-student-timetable',
  imports: [Timetable, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      @if (store.loading() && store.enrollments().length === 0) {
        <p class="text-sm text-slate-500">Betöltés…</p>
      } @else if (events().length === 0) {
        <div class="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200">
          <h3 class="text-base sm:text-lg font-bold text-slate-700">Még nincs felvett tárgyad</h3>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">Az órarended a tárgyfelvétel után itt jelenik meg.</p>
          <a routerLink="/student/courses" class="inline-block mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow">
            Kurzuskatalógus
          </a>
        </div>
      } @else {
        <app-timetable [events]="events()" />
      }
    </div>
  `
})
export class StudentTimetablePage implements OnInit {
  readonly store = inject(StudentStore);

  readonly events = computed<TimetableEvent[]>(() =>
    this.store.enrollments().flatMap((e) => [
      {
        id: `l${e.id}`, kind: 'lecture' as const, code: e.courseCode, title: e.courseTitle, label: 'Előadás',
        schedule: e.lecture.schedule, location: e.lecture.location, detail: e.lecture.instructor
      },
      {
        id: `p${e.id}`, kind: 'practice' as const, code: e.courseCode, title: e.courseTitle, label: e.practice.name,
        schedule: e.practice.schedule, location: e.practice.location, detail: e.practice.instructor
      }
    ])
  );

  ngOnInit(): void { this.store.load(); }
}
