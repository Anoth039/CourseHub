import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Course, TeachingRecord } from '../core/models';
import { ToastService } from '../core/toast.service';
import { Timetable, TimetableEvent } from '../shared/timetable';

@Component({
  selector: 'app-instructor-timetable',
  imports: [Timetable, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      @if (loading()) {
        <p class="text-sm text-slate-500">Betöltés…</p>
      } @else if (events().length === 0) {
        <div class="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200">
          <h3 class="text-base sm:text-lg font-bold text-slate-700">Még nincs órád</h3>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">Az órarended a kurzus meghirdetése vagy gyakorlatvezetés után itt jelenik meg.</p>
          <a routerLink="/instructor/courses" class="inline-block mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow">
            Saját kurzusaim
          </a>
        </div>
      } @else {
        <app-timetable [events]="events()" />
      }
    </div>
  `
})
export class InstructorTimetablePage implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  loading = signal(false);
  courses = signal<Course[]>([]);
  teaching = signal<TeachingRecord[]>([]);

  readonly events = computed<TimetableEvent[]>(() => {
    const me = this.auth.user()?.id;
    // a saját kurzusaim összes órája; halványan, ha a gyakorlatot más oktató vezeti
    const own = this.courses().flatMap((c) => [
      ...c.lectures.map((s) => ({ kind: 'lecture' as const, label: 'Előadás', s })),
      ...c.practices.map((s) => ({ kind: 'practice' as const, label: s.name, s }))
    ].map(({ kind, label, s }) => ({
      id: `${kind[0]}${s.id}`, kind, code: c.code, title: c.title, label,
      schedule: s.schedule, location: s.location,
      detail: `${s.instructor} • ${s.enrolledCount} / ${s.capacity} fő`,
      muted: s.instructorId != null && s.instructorId !== me
    })));
    // más kurzusában általam vezetett gyakorlatok
    const guest = this.teaching().map((t) => ({
      id: `g${t.slot.id}`, kind: 'practice' as const, code: t.code, title: t.title, label: t.slot.name,
      schedule: t.slot.schedule, location: t.slot.location,
      detail: `Tárgyfelelős: ${t.owner} • ${t.slot.enrolledCount} / ${t.slot.capacity} fő`
    }));
    return [...own, ...guest];
  });

  readonly hasOthers = computed(() => this.events().some((e) => e.muted));

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({ mine: this.api.getMyCourses(), teaching: this.api.getTeaching() }).subscribe({
      next: (r) => { this.courses.set(r.mine); this.teaching.set(r.teaching); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.toast.error(e, 'Az órarend betöltése sikertelen'); }
    });
  }
}
