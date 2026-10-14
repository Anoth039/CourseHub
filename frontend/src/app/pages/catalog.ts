import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Course, CourseSlot } from '../core/models';
import { schedulesOverlap } from '../core/schedule';
import { StudentStore } from '../core/student.store';
import { ToastService } from '../core/toast.service';
import { CourseDetailsModal } from '../shared/course-details-modal';

@Component({
  selector: 'app-catalog',
  imports: [CourseDetailsModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Szűrők -->
    <div class="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 mb-6 sm:mb-8">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
        <div class="lg:col-span-7">
          <input type="text" [value]="searchQuery()" (input)="searchQuery.set($any($event.target).value)"
            placeholder="Keresés tárgynév, kód vagy oktató alapján..." aria-label="Keresés"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-xs sm:text-sm">
        </div>
        <div class="lg:col-span-5">
          <select [value]="selectedDepartment()" (change)="selectedDepartment.set($any($event.target).value)" aria-label="Tanszék"
            class="w-full py-2.5 px-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-xs sm:text-sm">
            <option value="ALL">Összes tanszék / intézet</option>
            @for (dept of departments(); track dept) {
              <option [value]="dept">{{ dept }}</option>
            }
          </select>
        </div>
      </div>
    </div>

    <div class="mb-4">
      <h2 class="text-base sm:text-lg font-bold text-slate-800">Elérhető tárgyak ({{ filteredCourses().length }})</h2>
    </div>

    @if (store.loading() && store.courses().length === 0) {
      <p class="text-sm text-slate-500">Betöltés…</p>
    } @else if (filteredCourses().length === 0) {
      <div class="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200 my-6">
        <h3 class="text-base sm:text-lg font-bold text-slate-700">Nincs a szűrésnek megfelelő tárgy</h3>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">Próbálja meg módosítani a keresőkifejezést vagy a tanszéki szűrőt.</p>
        <button (click)="resetFilters()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition shadow">
          Szűrők törlése
        </button>
      </div>
    } @else {
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        @for (course of filteredCourses(); track course.id) {
          <div class="bg-white rounded-2xl border border-slate-200 hover:shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden group">
            <div class="p-4 sm:p-5 flex-1 flex flex-col">
              <div class="flex items-start justify-between gap-2 mb-2">
                <span class="inline-block px-2.5 py-1 text-xs font-bold font-mono bg-slate-100 text-slate-700 rounded-md tracking-wider">{{ course.code }}</span>
                @if (course.completed) {
                  <span class="text-[11px] sm:text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Teljesítve</span>
                } @else if (store.waitlistEntry(course.id); as w) {
                  <span class="text-[11px] sm:text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-700 border border-amber-200">Várólista: {{ w.position }}.</span>
                } @else if (seatsLeft(course) > 0) {
                  <span class="text-[11px] sm:text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Szabad</span>
                } @else {
                  <span class="text-[11px] sm:text-xs px-2.5 py-1 rounded-full font-semibold bg-rose-100 text-rose-700 border border-rose-200">Betelt</span>
                }
              </div>
              <h3 class="text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition line-clamp-2">{{ course.title }}</h3>
              <p class="text-xs text-slate-500 mt-1 font-medium">Ajánlott félév: {{ course.recommendedSemester }}. &bull; Teljesítés: {{ course.completionType }}</p>
              @if (course.prerequisites.length) {
                <p class="text-[11px] mt-1.5 font-semibold" [class]="course.prerequisiteMet ? 'text-slate-500' : 'text-amber-600'">
                  Előfeltétel: {{ prereqCodes(course) }}{{ course.prerequisiteMet ? ' ✓' : ' (nincs teljesítve)' }}
                </p>
              }
              <div class="mt-auto pt-3">
                <span class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">{{ course.credits }} Kredit</span>
              </div>
            </div>
            <div class="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <button (click)="detail.set(course)" class="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-200/60 transition">Részletek</button>
              @if (course.completed) {
                <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">Teljesítve</span>
              } @else if (store.isEnrolled(course.id)) {
                <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">Felvéve</span>
              } @else if (!course.prerequisiteMet) {
                <button disabled class="text-xs font-semibold px-3 py-2 rounded-lg bg-amber-100 text-amber-700 cursor-not-allowed">Előfeltétel hiányzik</button>
              } @else if (store.waitlistEntry(course.id)) {
                <span class="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">Várólistán</span>
              } @else if (seatsLeft(course) <= 0) {
                <button (click)="initiateWaitlist(course)" class="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl shadow-sm hover:shadow transition">Várólista</button>
              } @else {
                <button (click)="initiateEnrollment(course)" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl shadow-sm hover:shadow transition">Jelentkezés</button>
              }
            </div>
          </div>
        }
      </div>
    }

    @if (detail(); as course) {
      <app-course-details-modal [course]="course" [canEnroll]="!course.completed" [enrolled]="store.isEnrolled(course.id)"
        [waitlistPosition]="store.waitlistEntry(course.id)?.position ?? null"
        (closed)="detail.set(null)" (enroll)="detail.set(null); initiateEnrollment(course)"
        (waitlist)="detail.set(null); initiateWaitlist(course)" />
    }

    <!-- Jelentkezési ablak -->
    @if (enrolling(); as course) {
      <div class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative">
          <button (click)="enrolling.set(null)" aria-label="Bezárás" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <h3 class="text-lg sm:text-xl font-bold text-slate-900 mb-1">Jelentkezés a kurzusra</h3>
          <p class="text-xs sm:text-sm text-slate-500 mb-5">
            <span class="font-bold text-slate-800">{{ course.code }} — {{ course.title }}</span> ({{ course.credits }} kredit)
          </p>

          <form (submit)="confirmEnrollment($event)" class="space-y-5">
            <div class="space-y-2">
              <span class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Előadás kiválasztása <span class="text-rose-500">*</span></span>
              @for (lec of course.lectures; track lec.id) {
                <label [class]="slotClass(lec.capacity - lec.enrolledCount, selectedLecture() === lec.id, !!conflictWith(lec))" class="flex items-start p-3 rounded-xl border transition">
                  <input type="radio" name="lectureSlot" [disabled]="lec.capacity - lec.enrolledCount <= 0 || !!conflictWith(lec)"
                    [checked]="selectedLecture() === lec.id" (change)="selectedLecture.set(lec.id)" class="mt-0.5 text-indigo-600">
                  <div class="ml-3 flex-1 text-xs">
                    <div class="flex items-center justify-between font-bold text-slate-900">
                      <span>{{ lec.name }}</span>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded" [class]="lec.capacity - lec.enrolledCount <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'">
                        {{ lec.capacity - lec.enrolledCount <= 0 ? 'Betelt' : (lec.capacity - lec.enrolledCount) + ' szabad hely' }}
                      </span>
                    </div>
                    <div class="text-slate-600 font-semibold mt-1">{{ lec.schedule }}</div>
                    @if (conflictWith(lec); as c) { <div class="text-[11px] font-bold text-rose-600 mt-0.5">Órarendi ütközés: {{ c }}</div> }
                    <div class="text-slate-500 mt-0.5 text-[11px] flex items-center justify-between"><span>Helyszín: {{ lec.location }}</span><span>Oktató: {{ lec.instructor }}</span></div>
                  </div>
                </label>
              }
            </div>

            <div class="space-y-2">
              <span class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Gyakorlati csoport kiválasztása <span class="text-rose-500">*</span></span>
              <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                @for (prac of course.practices; track prac.id) {
                  <label [class]="slotClass(prac.capacity - prac.enrolledCount, selectedPractice() === prac.id, !!conflictWith(prac) || overlapsSelectedLecture(prac))" class="flex items-start p-3 rounded-xl border transition">
                    <input type="radio" name="practiceSlot" [disabled]="prac.capacity - prac.enrolledCount <= 0 || !!conflictWith(prac) || overlapsSelectedLecture(prac)"
                      [checked]="selectedPractice() === prac.id" (change)="selectedPractice.set(prac.id)" class="mt-0.5 text-indigo-600">
                    <div class="ml-3 flex-1 text-xs">
                      <div class="flex items-center justify-between font-bold text-slate-900">
                        <span>{{ prac.name }}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded" [class]="prac.capacity - prac.enrolledCount <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'">
                          {{ prac.capacity - prac.enrolledCount <= 0 ? 'Betelt' : (prac.capacity - prac.enrolledCount) + ' szabad hely' }}
                        </span>
                      </div>
                      <div class="text-slate-600 font-semibold mt-1">{{ prac.schedule }}</div>
                    @if (conflictWith(prac); as c) { <div class="text-[11px] font-bold text-rose-600 mt-0.5">Órarendi ütközés: {{ c }}</div> }
                      <div class="text-slate-500 mt-0.5 text-[11px] flex items-center justify-between"><span>Helyszín: {{ prac.location }}</span><span>Oktató: {{ prac.instructor }}</span></div>
                    </div>
                  </label>
                }
              </div>
            </div>

            <div class="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button type="button" (click)="enrolling.set(null)" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800">Mégse</button>
              <button type="submit" [disabled]="!selectedLecture() || !selectedPractice() || busy()"
                class="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed">
                Tárgyfelvétel megerősítése
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Várólista ablak -->
    @if (waitlisting(); as course) {
      <div class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative">
          <button (click)="waitlisting.set(null)" aria-label="Bezárás" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <h3 class="text-lg sm:text-xl font-bold text-slate-900 mb-1">Jelentkezés a várólistára</h3>
          <p class="text-xs sm:text-sm text-slate-500 mb-2">
            <span class="font-bold text-slate-800">{{ course.code }} — {{ course.title }}</span> ({{ course.credits }} kredit)
          </p>
          <p class="text-xs text-slate-500 mb-5">
            Minden csoport betelt. Válassza ki azt a gyakorlati csoportot, amelyre várakozna – ha helyet szabadít fel valaki,
            érkezési sorrendben automatikusan felvesszük (feltéve, hogy addig is megfelel a feltételeknek).
          </p>

          <form (submit)="confirmWaitlist($event)" class="space-y-5">
            <div class="space-y-2">
              <span class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Gyakorlati csoport <span class="text-rose-500">*</span></span>
              <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
                @for (prac of course.practices; track prac.id) {
                  <label [class]="slotClass(1, waitlistPractice() === prac.id, !!conflictWith(prac))" class="flex items-start p-3 rounded-xl border transition">
                    <input type="radio" name="waitlistSlot" [disabled]="!!conflictWith(prac)" [checked]="waitlistPractice() === prac.id"
                      (change)="waitlistPractice.set(prac.id)" class="mt-0.5 text-amber-600">
                    <div class="ml-3 flex-1 text-xs">
                      <div class="flex items-center justify-between font-bold text-slate-900">
                        <span>{{ prac.name }}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">Betelt ({{ prac.enrolledCount }}/{{ prac.capacity }})</span>
                      </div>
                      <div class="text-slate-600 font-semibold mt-1">{{ prac.schedule }}</div>
                    @if (conflictWith(prac); as c) { <div class="text-[11px] font-bold text-rose-600 mt-0.5">Órarendi ütközés: {{ c }}</div> }
                      <div class="text-slate-500 mt-0.5 text-[11px] flex items-center justify-between"><span>Helyszín: {{ prac.location }}</span><span>Oktató: {{ prac.instructor }}</span></div>
                    </div>
                  </label>
                }
              </div>
            </div>
            <div class="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button type="button" (click)="waitlisting.set(null)" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800">Mégse</button>
              <button type="submit" [disabled]="!waitlistPractice() || busy()"
                class="px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed">
                Felvétel a várólistára
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class CatalogPage implements OnInit {
  readonly store = inject(StudentStore);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  searchQuery = signal('');
  selectedDepartment = signal('ALL');

  detail = signal<Course | null>(null);
  enrolling = signal<Course | null>(null);
  selectedLecture = signal<number | null>(null);
  selectedPractice = signal<number | null>(null);
  waitlisting = signal<Course | null>(null);
  waitlistPractice = signal<number | null>(null);
  busy = signal(false);

  departments = computed(() => [...new Set(this.store.courses().map((c) => c.department))].sort());

  filteredCourses = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const dept = this.selectedDepartment();
    return this.store.courses().filter((c) => {
      const matchesSearch = !q ||
        c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) ||
        c.lectures.some((l) => l.instructor.toLowerCase().includes(q)) ||
        c.practices.some((p) => p.instructor.toLowerCase().includes(q));
      return matchesSearch && (dept === 'ALL' || c.department === dept);
    });
  });

  ngOnInit(): void { this.store.load(); }

  seatsLeft(c: Course): number {
    return c.practices.reduce((s, p) => s + Math.max(0, p.capacity - p.enrolledCount), 0);
  }

  /** A hallgató már felvett csoportjai közül az első, amellyel a megadott csoport ütközik. */
  conflictWith(slot: CourseSlot): string | null {
    for (const e of this.store.enrollments()) {
      for (const other of [e.lecture, e.practice]) {
        if (schedulesOverlap(slot.schedule, other.schedule)) return `${e.courseCode} – ${other.name} (${other.schedule})`;
      }
    }
    return null;
  }

  /** A gyakorlat átfedi-e az éppen kiválasztott előadást (ugyanazon kurzuson belül). */
  overlapsSelectedLecture(prac: CourseSlot): boolean {
    const lec = this.enrolling()?.lectures.find((l) => l.id === this.selectedLecture());
    return !!lec && schedulesOverlap(lec.schedule, prac.schedule);
  }

  slotClass(free: number, selected: boolean, blocked = false): string {
    if (free <= 0 || blocked) return 'opacity-60 bg-slate-100 border-slate-200 cursor-not-allowed';
    return selected
      ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 cursor-pointer'
      : 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer';
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedDepartment.set('ALL');
  }

  prereqCodes(c: Course): string {
    return c.prerequisites.map((p) => p.code).join(', ');
  }

  /** A még nem teljesített előfeltételek felsorolása. */
  private missingPrereqs(c: Course): string {
    return c.prerequisites.filter((p) => !p.met).map((p) => `${p.code} — ${p.title}`).join(', ');
  }

  initiateEnrollment(course: Course): void {
    if (course.completed) {
      this.toast.add('info', 'Már teljesítette', `A(z) ${course.code} kurzust már teljesítette, nem veheti fel újra.`);
      return;
    }
    if (!course.prerequisiteMet) {
      this.toast.add('warning', 'Hiányzó előfeltétel',
        `A tárgy felvételéhez előbb teljesítenie kell: ${this.missingPrereqs(course)}.`);
      return;
    }
    if (this.store.totalCredits() + course.credits > this.store.maxCredits()) {
      this.toast.add('warning', 'Kreditlimit túllépése',
        `A tárgy felvételével túllépné a maximálisan engedélyezett ${this.store.maxCredits()} kreditet.`);
      return;
    }
    this.selectedLecture.set(course.lectures.length === 1 && this.free(course.lectures[0]) && !this.conflictWith(course.lectures[0]) ? course.lectures[0].id : null);
    this.selectedPractice.set(null);
    this.enrolling.set(course);
  }

  initiateWaitlist(course: Course): void {
    if (course.completed) {
      this.toast.add('info', 'Már teljesítette', `A(z) ${course.code} kurzust már teljesítette.`);
      return;
    }
    if (!course.prerequisiteMet) {
      this.toast.add('warning', 'Hiányzó előfeltétel',
        `A várólistára lépéshez előbb teljesítenie kell: ${this.missingPrereqs(course)}.`);
      return;
    }
    this.waitlistPractice.set(course.practices.length === 1 ? course.practices[0].id : null);
    this.waitlisting.set(course);
  }

  confirmWaitlist(e: Event): void {
    e.preventDefault();
    const course = this.waitlisting(), prac = this.waitlistPractice();
    if (!course || !prac) return;

    this.busy.set(true);
    this.api.joinWaitlist(course.id, prac).subscribe({
      next: (rec) => {
        this.busy.set(false);
        this.waitlisting.set(null);
        this.store.load();
        this.toast.add('info', 'Felvéve a várólistára',
          `${rec.courseCode}: ${rec.practice.name} — jelenlegi helye a sorban: ${rec.position}.`);
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error(err, 'A várólistára jelentkezés nem sikerült');
        this.store.load();
        this.waitlisting.set(null);
      }
    });
  }

  private free(s: { capacity: number; enrolledCount: number }): boolean { return s.capacity - s.enrolledCount > 0; }

  confirmEnrollment(e: Event): void {
    e.preventDefault();
    const course = this.enrolling(), lec = this.selectedLecture(), prac = this.selectedPractice();
    if (!course || !lec || !prac) return;

    this.busy.set(true);
    this.api.enroll(course.id, lec, prac).subscribe({
      next: (rec) => {
        this.busy.set(false);
        this.enrolling.set(null);
        this.store.load();
        this.toast.add('success', 'Sikeres tárgyfelvétel!', `${rec.courseCode}: ${rec.courseTitle} felvéve (${rec.practice.name} — ${rec.practice.schedule}).`);
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error(err, 'A jelentkezés nem sikerült');
        this.store.load(); // frissítjük a szabad helyeket
        this.enrolling.set(null);
      }
    });
  }
}