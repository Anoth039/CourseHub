import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Course } from '../core/models';

@Component({
  selector: 'app-course-details-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative">
        <button (click)="closed.emit()" aria-label="Bezárás"
          class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <div class="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1 pr-10">
          {{ course().department }} • Ajánlott: {{ course().recommendedSemester }}. félév • {{ course().completionType }}
        </div>
        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 mb-2 pr-10">
          {{ course().code }}: {{ course().title }}
        </h2>
        <p class="text-xs sm:text-sm text-slate-600 mb-3 leading-relaxed">{{ course().description }}</p>
        @if (course().prerequisites.length) {
          <div class="text-xs mb-5 font-semibold space-y-0.5">
            @for (pre of course().prerequisites; track pre.id) {
              <p [class]="pre.met ? 'text-emerald-600' : 'text-amber-600'">
                Előfeltétel: {{ pre.code }} — {{ pre.title }}
                @if (canEnroll()) { ({{ pre.met ? 'teljesítve' : 'nincs teljesítve' }}) }
              </p>
            }
          </div>
        } @else {
          <div class="mb-2"></div>
        }

        <div class="space-y-3 mb-6">
          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Kurzusok</h4>
          <div class="grid grid-cols-1 gap-2 text-xs">
            @for (lec of course().lectures; track lec.id) {
              <div class="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl flex justify-between items-center gap-3">
                <div>
                  <span class="font-bold text-indigo-900">{{ lec.name }}</span>
                  <div class="text-slate-600 text-[11px]">{{ lec.schedule }} • {{ lec.location }} ({{ lec.instructor }})</div>
                </div>
                <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 whitespace-nowrap">
                  {{ lec.capacity - lec.enrolledCount }} szabad hely
                </span>
              </div>
            }
            @for (prac of course().practices; track prac.id) {
              <div class="bg-slate-50 border border-slate-200 p-3 rounded-xl flex justify-between items-center gap-3">
                <div>
                  <span class="font-bold text-slate-800">{{ prac.name }}</span>
                  <div class="text-slate-500 text-[11px]">{{ prac.schedule }} • {{ prac.location }} ({{ prac.instructor }})</div>
                </div>
                <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 whitespace-nowrap">
                  {{ prac.capacity - prac.enrolledCount }} szabad hely
                </span>
              </div>
            }
          </div>
        </div>

        <div class="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
          <button (click)="closed.emit()" class="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800">
            Bezárás
          </button>
          @if (canEnroll()) {
            @if (enrolled()) {
              <button disabled class="px-5 py-2 text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-100 rounded-xl cursor-not-allowed">Már felvéve</button>
            } @else if (!course().prerequisiteMet) {
              <button disabled class="px-5 py-2 text-xs sm:text-sm font-semibold text-amber-700 bg-amber-100 rounded-xl cursor-not-allowed">Előfeltétel hiányzik</button>
            } @else if (waitlistPosition() !== null) {
              <button disabled class="px-5 py-2 text-xs sm:text-sm font-semibold text-amber-700 bg-amber-100 rounded-xl cursor-not-allowed">Várólistán: {{ waitlistPosition() }}. hely</button>
            } @else if (seatsLeft() <= 0) {
              <button (click)="waitlist.emit()" class="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow transition">Várólistára jelentkezem</button>
            } @else {
              <button (click)="enroll.emit()" class="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition">
                Tovább a jelentkezéshez
              </button>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class CourseDetailsModal {
  course = input.required<Course>();
  canEnroll = input(false);
  enrolled = input(false);
  /** A hallgató helye a várólistán (null, ha nincs rajta). */
  waitlistPosition = input<number | null>(null);
  closed = output<void>();
  enroll = output<void>();
  waitlist = output<void>();

  seatsLeft = computed(() =>
    this.course().practices.reduce((s, p) => s + Math.max(0, p.capacity - p.enrolledCount), 0)
  );
}
