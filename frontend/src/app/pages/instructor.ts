import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { CompletionType, Course, CourseOption, CourseStudent, InstructorInfo, PracticeInput, TeachingRecord } from '../core/models';
import { schedulesOverlap } from '../core/schedule';
import { ToastService } from '../core/toast.service';
import { ComboOption, Combobox } from '../shared/combobox';
import { ConfirmModal } from '../shared/confirm-modal';

const defaultPractices = (me: number): PracticeInput[] => [
  { name: 'G01 - Labor', schedule: 'Szerda 08:30 - 10:00', location: 'PC Labor 1', capacity: 20, instructorId: me },
  { name: 'G02 - Labor', schedule: 'Szerda 10:00 - 11:30', location: 'PC Labor 1', capacity: 20, instructorId: me }
];

const inputCls = 'w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500';
const smallCls = 'p-2 rounded-lg border border-slate-300 bg-white text-slate-900';

@Component({
  selector: 'app-instructor',
  imports: [ConfirmModal, Combobox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900">Meghirdetett kurzusaim</h1>
          <p class="text-xs sm:text-sm text-slate-500">Kezelje meghirdetett kurzusait, órarendi sávjait és tekintse meg a hallgatói létszámot.</p>
        </div>
        <button (click)="openCreate()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition flex-shrink-0">
          + Új kurzus meghirdetése
        </button>
      </div>

      @if (loading()) {
        <p class="text-sm text-slate-500">Betöltés…</p>
      } @else if (courses().length === 0) {
        <div class="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200">
          <h3 class="text-base sm:text-lg font-bold text-slate-800">Még nem hirdetett meg kurzust</h3>
          <p class="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">Hozza létre az első kurzusát, hogy a hallgatók felvehessék.</p>
          <button (click)="openCreate()" class="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow transition">+ Új kurzus létrehozása</button>
        </div>
      } @else {
        <div class="space-y-4">
          @for (course of courses(); track course.id) {
            <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div class="flex items-center space-x-3">
                  <span class="px-2.5 py-1 text-xs font-bold font-mono bg-indigo-100 text-indigo-700 rounded-lg">{{ course.code }}</span>
                  <div>
                    <h3 class="text-base sm:text-lg font-bold text-slate-900">{{ course.title }}</h3>
                    <span class="text-xs text-slate-500">{{ course.department }} • Ajánlott: {{ course.recommendedSemester }}. félév • {{ course.credits }} Kredit@if (course.prerequisites.length) { • Előfeltétel: {{ prereqCodes(course) }} }</span>
                  </div>
                </div>
                <div class="flex items-center space-x-2 self-end sm:self-center">
                  <button (click)="openStudents(course)" class="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition">Hallgatók</button>
                  <button (click)="openEdit(course)" class="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition">Módosítás</button>
                  <button (click)="deleting.set(course)" class="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition">Törlés</button>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                @for (lec of course.lectures; track lec.id) {
                  <div class="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-1">Előadás sáv</span>
                    <div class="font-bold text-slate-800">{{ lec.schedule }}</div>
                    <div class="text-slate-500 mt-0.5">Helyszín: {{ lec.location }}</div>
                    <div class="mt-2 flex items-center justify-between text-[11px] font-semibold">
                      <span class="text-slate-600">Összesen jelentkezve:</span>
                      <span class="text-indigo-700 font-bold">{{ lec.enrolledCount }} / {{ lec.capacity }} fő</span>
                    </div>
                  </div>
                }
                <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Gyakorlati csoportok ({{ course.practices.length }})</span>
                  @for (prac of course.practices; track prac.id) {
                    <div class="space-y-1">
                      <div class="flex items-center justify-between font-semibold gap-2">
                        <span class="text-slate-800">{{ prac.name }} ({{ prac.schedule }})</span>
                        <span class="text-slate-600 font-mono whitespace-nowrap">{{ prac.enrolledCount }} / {{ prac.capacity }}</span>
                      </div>
                      <div class="text-[11px] text-slate-500">Oktató: {{ prac.instructor }}</div>
                      <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-emerald-500 h-full transition-all" [style.width.%]="(prac.enrolledCount / prac.capacity) * 100"></div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (teaching().length > 0) {
        <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div>
            <h2 class="text-base sm:text-lg font-bold text-slate-900">Általam vezetett gyakorlatok</h2>
            <p class="text-xs text-slate-500">Más oktató kurzusában Ön tartja ezeket a gyakorlatokat.</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            @for (t of teaching(); track t.slot.id) {
              <div class="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 text-[11px] font-bold font-mono bg-indigo-100 text-indigo-700 rounded-md">{{ t.code }}</span>
                  <span class="font-bold text-slate-800">{{ t.title }}</span>
                </div>
                <div class="mt-1.5 font-semibold text-slate-800">{{ t.slot.name }} ({{ t.slot.schedule }})</div>
                <div class="text-slate-500 mt-0.5">Helyszín: {{ t.slot.location }} • Tárgyfelelős: {{ t.owner }}</div>
                <div class="mt-1 flex items-center justify-between">
                  <span class="text-[11px] font-semibold text-emerald-700">{{ t.slot.enrolledCount }} / {{ t.slot.capacity }} fő jelentkezett</span>
                  <button (click)="openStudents({ id: t.courseId, code: t.code, title: t.title }, true)" class="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition">Hallgatók</button>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>

    @if (deleting(); as course) {
      <app-confirm-modal title="Kurzus törlése"
        [message]="'Biztosan törölni szeretné a(z) ' + course.code + ' — ' + course.title + ' kurzust a felvételi katalógusból?'"
        note="A kurzushoz tartozó összes hallgatói jelentkezés is törlődik."
        confirmLabel="Végleges törlés" [busy]="busy()"
        (cancelled)="deleting.set(null)" (confirmed)="confirmDelete(course)" />
    }

    @if (studentsFor(); as course) {
      <div class="fixed inset-0 z-50 overflow-y-auto flex p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative m-auto">
          <button (click)="studentsFor.set(null)" aria-label="Bezárás" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <h2 class="text-xl font-bold text-slate-900 mb-1">Jelentkezett hallgatók</h2>
          <p class="text-xs text-slate-500 mb-5">{{ course.code }} — {{ course.title }}.
            @if (studentsReadOnly()) { Csak az Ön gyakorlati csoportjaiba jelentkezett hallgatók láthatók. }
            @else { A teljesítettnek jelölt hallgató az erre épülő kurzusokat felveheti, de erre a kurzusra már nem jelentkezhet újra. }
          </p>

          @if (studentsLoading()) {
            <p class="text-sm text-slate-500">Betöltés…</p>
          } @else if (students().length === 0) {
            <p class="text-sm text-slate-500">Még nem jelentkezett hallgató.</p>
          } @else {
            <div class="space-y-2">
              @for (s of students(); track s.id) {
                <div class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                  <div class="min-w-0">
                    <div class="font-bold text-slate-900 truncate">{{ s.name }} @if (s.studentId) { <span class="font-mono font-semibold text-slate-500">({{ s.studentId }})</span> }</div>
                    <div class="text-slate-500 mt-0.5">{{ s.major }} • {{ s.semester }}. félév • {{ s.lecture }} / {{ s.practice }}</div>
                  </div>
                  @if (studentsReadOnly()) {
                    @if (s.completed) { <span class="px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">Teljesítve</span> }
                  } @else if (s.completed) {
                    <span class="px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">Teljesítve</span>
                  } @else {
                    <button (click)="markCompleted(course, s)" [disabled]="busy()" class="flex-shrink-0 px-3 py-2 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow transition">Teljesítettnek jelöl</button>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    }

    @if (showCreate()) {
      <div class="fixed inset-0 z-50 overflow-y-auto flex p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative m-auto">
          <button (click)="showCreate.set(false)" aria-label="Bezárás" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <h2 class="text-xl font-bold text-slate-900 mb-1">{{ editingId() ? 'Kurzus módosítása' : 'Új kurzus meghirdetése' }}</h2>
          <p class="text-xs text-slate-500 mb-5">{{ editingId() ? 'Módosítsa a tantárgy adatait, az előadás sávját, vagy szerkessze és egészítse ki a gyakorlati csoportokat.' : 'Adja meg a tantárgy adatait, az előadás sávját és a gyakorlati csoportokat.' }}</p>

          <form (submit)="save($event)" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Tárgykód *</label>
                <input type="text" required [value]="f.code()" (input)="f.code.set($any($event.target).value)" placeholder="pl. CS301" [class]="inputCls">
              </div>
              <div class="sm:col-span-2">
                <label class="block font-bold text-slate-700 mb-1">Tantárgy neve *</label>
                <input type="text" required [value]="f.title()" (input)="f.title.set($any($event.target).value)" placeholder="pl. Webes Rendszerek Fejlesztése" [class]="inputCls">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Kreditérték *</label>
                <input type="number" min="1" max="15" required [value]="f.credits()" (input)="f.credits.set($any($event.target).valueAsNumber)" [class]="inputCls">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Ajánlott félév *</label>
                <input type="number" min="1" max="10" required [value]="f.recSemester()" (input)="f.recSemester.set($any($event.target).valueAsNumber)" [class]="inputCls">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Teljesítés típusa *</label>
                <select [value]="f.completion()" (change)="f.completion.set($any($event.target).value)" [class]="inputCls">
                  <option value="Gyakorlati jegy">Gyakorlati jegy</option>
                  <option value="Kollokvium">Kollokvium</option>
                  <option value="Aláírás">Aláírás</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Előfeltételek (opcionális)</label>
              @if (selectedPrereqs().length) {
                <div class="flex flex-wrap gap-1.5 mb-2">
                  @for (p of selectedPrereqs(); track p.id) {
                    <span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {{ p.code }} — {{ p.title }}
                      <button type="button" aria-label="Előfeltétel eltávolítása" (click)="removePrereq(p.id)" class="text-indigo-400 hover:text-indigo-700">&times;</button>
                    </span>
                  }
                </div>
              }
              <app-combobox [options]="prereqOptions()" [value]="null"
                placeholder="Előfeltétel hozzáadása – keresés kód vagy név alapján"
                (valueChange)="addPrereq($any($event))" />
              <p class="text-[11px] text-slate-500 mt-1">A hallgató csak akkor vehet fel vagy várólistázhat a kurzusra, ha az összes előfeltétel-tárgyat már teljesítette.</p>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Tantárgy leírása</label>
              <textarea rows="2" [value]="f.desc()" (input)="f.desc.set($any($event.target).value)" placeholder="A tantárgy rövid tartalma, elvárt ismeretek..." [class]="inputCls"></textarea>
            </div>

            <div class="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 space-y-2">
              <span class="font-bold text-indigo-700 block">Előadás beállításai</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Időpont *</label>
                  <input type="text" required [value]="f.lecSchedule()" (input)="f.lecSchedule.set($any($event.target).value)" placeholder="pl. Hétfő 10:00 - 11:30" [class]="smallCls + ' w-full'">
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Helyszín *</label>
                  <input type="text" required [value]="f.lecLocation()" (input)="f.lecLocation.set($any($event.target).value)" placeholder="pl. Informatikai Tömb 101" [class]="smallCls + ' w-full'">
                </div>
              </div>
              <p class="text-[11px] text-slate-500">Az előadás férőhelyeinek száma a gyakorlati csoportok összkapacitásával egyezik meg.</p>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800">Gyakorlati csoportok</span>
                <button type="button" (click)="addPractice()" class="text-indigo-600 font-bold hover:underline">+ Csoport hozzáadása</button>
              </div>
              <p class="text-[11px] text-slate-500">Gyakorlatvezetőnek csak regisztrált oktató választható. Akinek az adott időpontban már van órája, az nem választható.</p>
              @for (prac of f.practices(); track $index) {
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-700">{{ $index + 1 }}. gyakorlati csoport</span>
                    @if (prac.enrolledCount) {
                      <span class="text-[11px] font-semibold text-slate-500">{{ prac.enrolledCount }} fő jelentkezett – nem törölhető</span>
                    } @else if (f.practices().length > 1) {
                      <button type="button" (click)="removePractice($index)" class="text-rose-500 hover:text-rose-700 font-bold">Törlés</button>
                    }
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="text" required [value]="prac.name" (input)="updatePractice($index, 'name', $any($event.target).value)" placeholder="pl. G01 - Labor" aria-label="Csoport neve" [class]="smallCls">
                    <input type="text" required [value]="prac.schedule" (input)="updatePractice($index, 'schedule', $any($event.target).value)" placeholder="pl. Szerda 08:30 - 10:00" aria-label="Időpont" [class]="smallCls">
                    <div class="flex space-x-2">
                      <input type="text" required [value]="prac.location" (input)="updatePractice($index, 'location', $any($event.target).value)" placeholder="PC Labor 1" aria-label="Helyszín" [class]="smallCls + ' w-full'">
                      <input type="number" [min]="prac.enrolledCount || 1" max="100" required [value]="prac.capacity" (input)="updatePractice($index, 'capacity', $any($event.target).valueAsNumber)" placeholder="Fő" aria-label="Létszám" [class]="smallCls + ' w-20'">
                    </div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Gyakorlatvezető oktató</label>
                    <app-combobox [options]="instructorOptions($index)" [value]="prac.instructorId ?? me"
                      placeholder="Oktató keresése névre…" [inputClass]="smallCls + ' w-full'"
                      (valueChange)="updatePractice($index, 'instructorId', $any($event))" />
                  </div>
                </div>
              }
            </div>

            <div class="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button type="button" (click)="showCreate.set(false)" class="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800">Mégse</button>
              <button type="submit" [disabled]="busy()" class="px-5 py-2.5 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-md transition">{{ editingId() ? 'Módosítások mentése' : 'Kurzus meghirdetése' }}</button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class InstructorPage implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  /** A bejelentkezett oktató azonosítója */
  readonly me = this.auth.user()!.id;

  readonly inputCls = inputCls;
  readonly smallCls = smallCls;

  courses = signal<Course[]>([]);
  options = signal<CourseOption[]>([]);
  loading = signal(false);
  busy = signal(false);
  editingId = signal<number | null>(null);
  deleting = signal<Course | null>(null);
  showCreate = signal(false);
  studentsFor = signal<{ id: number; code: string; title: string } | null>(null);
  studentsReadOnly = signal(false);
  students = signal<CourseStudent[]>([]);
  studentsLoading = signal(false);
  instructors = signal<InstructorInfo[]>([]);
  teaching = signal<TeachingRecord[]>([]);


  /** Az új kurzus űrlapjának állapota */
  f = {
    code: signal(''),
    title: signal(''),
    credits: signal(5),
    recSemester: signal(4),
    completion: signal<CompletionType>('Gyakorlati jegy'),
    desc: signal(''),
    prerequisiteIds: signal<number[]>([]),
    lecSchedule: signal('Hétfő 10:00 - 11:30'),
    lecLocation: signal('Informatikai Tömb 101'),
    practices: signal<PracticeInput[]>(defaultPractices(this.me))
  };

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.api.getTeaching().subscribe({ next: (t) => this.teaching.set(t), error: () => {} });
    this.loading.set(true);
    this.api.getMyCourses().subscribe({
      next: (list) => { this.courses.set(list); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.toast.error(e, 'A kurzusok betöltése sikertelen'); }
    });
  }

  openEdit(course: Course): void {
    const lec = course.lectures[0];
    this.editingId.set(course.id);
    this.f.code.set(course.code); this.f.title.set(course.title);
    this.f.credits.set(course.credits); this.f.recSemester.set(course.recommendedSemester);
    this.f.completion.set(course.completionType); this.f.desc.set(course.description);
    this.f.prerequisiteIds.set(course.prerequisites.map((p) => p.id));
    this.f.lecSchedule.set(lec?.schedule ?? ''); this.f.lecLocation.set(lec?.location ?? '');
    this.f.practices.set(course.practices.map((p) => ({
      id: p.id, name: p.name, instructorId: p.instructorId ?? this.me, schedule: p.schedule, location: p.location, capacity: p.capacity, enrolledCount: p.enrolledCount
    })));
    this.api.getCourseOptions().subscribe({
      next: (l) => this.options.set(l),
      error: (e) => this.toast.error(e, 'Az előfeltétel-lista betöltése sikertelen')
    });
    this.api.getInstructors().subscribe({
      next: (l) => this.instructors.set(l),
      error: (e) => this.toast.error(e, 'Az oktatók listájának betöltése sikertelen')
    });
    this.showCreate.set(true);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.f.code.set(''); this.f.title.set(''); this.f.credits.set(5); this.f.recSemester.set(4);
    this.f.completion.set('Gyakorlati jegy'); this.f.desc.set(''); this.f.prerequisiteIds.set([]);
    this.f.lecSchedule.set('Hétfő 10:00 - 11:30'); this.f.lecLocation.set('Informatikai Tömb 101');
    this.f.practices.set(defaultPractices(this.me));
    this.api.getCourseOptions().subscribe({
      next: (l) => this.options.set(l),
      error: (e) => this.toast.error(e, 'Az előfeltétel-lista betöltése sikertelen')
    });
    this.api.getInstructors().subscribe({
      next: (l) => this.instructors.set(l),
      error: (e) => this.toast.error(e, 'Az oktatók listájának betöltése sikertelen')
    });
    this.showCreate.set(true);
  }

  openStudents(course: { id: number; code: string; title: string }, readOnly = false): void {
    this.studentsReadOnly.set(readOnly);
    this.studentsFor.set(course);
    this.students.set([]);
    this.studentsLoading.set(true);
    this.api.getCourseStudents(course.id).subscribe({
      next: (l) => { this.students.set(l); this.studentsLoading.set(false); },
      error: (e) => {
        this.studentsLoading.set(false);
        this.studentsFor.set(null);
        this.toast.error(e, 'A hallgatók betöltése sikertelen');
      }
    });
  }

  markCompleted(course: { id: number; code: string }, s: CourseStudent): void {
    this.busy.set(true);
    this.api.markCompleted(course.id, s.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.students.update((l) => l.map((x) => (x.id === s.id ? { ...x, completed: true } : x)));
        this.toast.add('success', 'Kurzus teljesítettnek jelölve', `${s.name} — ${course.code}`);
      },
      error: (err) => { this.busy.set(false); this.toast.error(err, 'A művelet sikertelen'); }
    });
  }

  /** Előfeltétel-lehetőségek (a szerkesztett kurzus önmaga és a már kiválasztottak nem szerepelnek). */
  prereqOptions = computed<ComboOption[]>(() =>
    this.options()
      .filter((o) => o.id !== this.editingId() && !this.f.prerequisiteIds().includes(o.id))
      .map((o) => ({ value: o.id, label: `${o.code} — ${o.title}` })));

  /** A kiválasztott előfeltételek (chipekhez). */
  selectedPrereqs = computed(() =>
    this.f.prerequisiteIds()
      .map((id) => this.options().find((o) => o.id === id))
      .filter((o): o is CourseOption => !!o));

  addPrereq(id: number | string | null): void {
    if (id == null) return;
    const n = Number(id);
    if (!this.f.prerequisiteIds().includes(n)) this.f.prerequisiteIds.update((l) => [...l, n]);
  }

  removePrereq(id: number): void {
    this.f.prerequisiteIds.update((l) => l.filter((x) => x !== id));
  }

  prereqCodes(c: Course): string {
    return c.prerequisites.map((p) => p.code).join(', ');
  }

  /** Az i. gyakorlathoz választható oktatók; akinek ekkor már van órája, az nem választható. */
  instructorOptions(i: number): ComboOption[] {
    const current = this.f.practices()[i]?.instructorId ?? this.me;
    return this.instructors().map((ins) => {
      const busy = ins.id !== current && this.isBusy(ins, i);
      return {
        value: ins.id,
        label: ins.id === this.me ? `${ins.name} (Ön)` : ins.name,
        sub: [ins.title, ins.department].filter(Boolean).join(' • ') || undefined,
        disabled: busy,
        note: busy ? 'ekkor már van órája' : undefined
      };
    });
  }

  private isBusy(ins: InstructorInfo, i: number): boolean {
    const practices = this.f.practices();
    const schedule = practices[i].schedule;
    // más kurzusokban lefoglalt órák (a most szerkesztett kurzus régi óráit az űrlap értékei helyettesítik)
    if (ins.busy.some((b) => b.courseId !== this.editingId() && schedulesOverlap(b.schedule, schedule))) return true;
    // ugyanezen az űrlapon: az előadást a kurzus tulajdonosa (Ön) tartja
    if (ins.id === this.me && schedulesOverlap(this.f.lecSchedule(), schedule)) return true;
    // ugyanezen az űrlapon: a többi gyakorlat
    return practices.some((p, j) => j !== i && (p.instructorId ?? this.me) === ins.id && schedulesOverlap(p.schedule, schedule));
  }

  addPractice(): void {
    const n = this.f.practices().length + 1;
    this.f.practices.update((l) => [...l, { name: `G${String(n).padStart(2, '0')} - Labor`, schedule: 'Csütörtök 12:00 - 13:30', location: 'PC Labor 2', capacity: 20, instructorId: this.me }]);
  }

  removePractice(i: number): void {
    if (this.f.practices().length <= 1) return;
    this.f.practices.update((l) => l.filter((_, idx) => idx !== i));
  }

  updatePractice(i: number, field: keyof PracticeInput, value: string | number): void {
    this.f.practices.update((l) => l.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  save(e: Event): void {
    e.preventDefault();
    this.busy.set(true);
    const body = {
      code: this.f.code().trim(),
      title: this.f.title().trim(),
      credits: this.f.credits(),
      recommendedSemester: this.f.recSemester(),
      completionType: this.f.completion(),
      description: this.f.desc(),
      prerequisiteIds: this.f.prerequisiteIds(),
      lecture: { schedule: this.f.lecSchedule(), location: this.f.lecLocation() },
      practices: this.f.practices()
    };
    const id = this.editingId();

    if (id) {
      this.api.updateCourse(id, body).subscribe({
        next: (c) => {
          this.busy.set(false);
          this.showCreate.set(false);
          this.editingId.set(null);
          this.courses.update((l) => l.map((x) => (x.id === c.id ? c : x)));
          this.toast.add('success', 'Kurzus módosítva', `${c.code}: ${c.title} adatai frissültek.`);
        },
        error: (err) => { this.busy.set(false); this.toast.error(err, 'A módosítás sikertelen'); }
      });
      return;
    }

    this.api.createCourse(body).subscribe({
      next: (c) => {
        this.busy.set(false);
        this.showCreate.set(false);
        this.courses.update((l) => [c, ...l]);
        this.toast.add('success', 'Kurzus sikeresen meghirdetve!', `${c.code}: ${c.title} bekerült a tantárgykatalógusba.`);
      },
      error: (err) => { this.busy.set(false); this.toast.error(err, 'A kurzus mentése sikertelen'); }
    });
  }

  confirmDelete(course: Course): void {
    this.busy.set(true);
    this.api.deleteCourse(course.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleting.set(null);
        this.courses.update((l) => l.filter((c) => c.id !== course.id));
        this.toast.add('info', 'Kurzus törölve', `A(z) ${course.code} kurzus törölve lett a meghirdetett tárgyak közül.`);
      },
      error: (err) => { this.busy.set(false); this.toast.error(err, 'A törlés sikertelen'); }
    });
  }
}
