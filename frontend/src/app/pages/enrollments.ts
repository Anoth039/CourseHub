import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { CourseSlot, EnrollmentRecord, WaitlistRecord } from '../core/models';
import { schedulesOverlap } from '../core/schedule';
import { StudentStore } from '../core/student.store';
import { ToastService } from '../core/toast.service';
import { ConfirmModal } from '../shared/confirm-modal';

@Component({
  selector: 'app-enrollments',
  imports: [ConfirmModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="text-lg sm:text-xl font-bold text-slate-900">Felvett kurzusok listája</h2>
          <p class="text-xs sm:text-sm text-slate-500">Az aktuális félévben regisztrált tantárgyai és választott időpontjai.</p>
        </div>
        <div class="sm:text-right">
          <span class="text-xs text-slate-500 block">Felvett kredit</span>
          <span class="text-lg font-bold text-indigo-600">{{ store.totalCredits() }} / {{ store.maxCredits() }} Kredit</span>
        </div>
      </div>

      @if (store.enrollments().length === 0) {
        <div class="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200">
          <h3 class="text-base sm:text-lg font-bold text-slate-800">Még egyetlen tárgyat sem vett fel</h3>
          <p class="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">A 2026/27 I. félévre még nem regisztrált kurzust. Böngésszen a katalógusban a tárgyfelvételhez.</p>
          <button (click)="router.navigateByUrl('/student/courses')" class="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow transition">Katalógus megnyitása</button>
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-4">
          @for (item of store.enrollments(); track item.id) {
            <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col gap-4">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2 py-0.5 text-xs font-bold font-mono bg-indigo-100 text-indigo-700 rounded">{{ item.courseCode }}</span>
                  <h3 class="text-base font-bold text-slate-900">{{ item.courseTitle }}</h3>
                  <span class="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">{{ item.credits }} Kredit</span>
                  @if (item.status === 'Teljesítve') {
                    <span class="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Teljesítve</span>
                  }
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                  <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span class="text-[10px] uppercase font-bold text-indigo-600 block mb-0.5">Előadás</span>
                    <div class="font-semibold text-slate-800">{{ item.lecture.name }}</div>
                    <div class="text-slate-500 mt-0.5">{{ item.lecture.schedule }} • {{ item.lecture.location }}</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">Oktató: {{ item.lecture.instructor }}</div>
                  </div>
                  <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span class="text-[10px] uppercase font-bold text-emerald-600 block mb-0.5">Választott Gyakorlat</span>
                    <div class="font-semibold text-slate-800">{{ item.practice.name }}</div>
                    <div class="text-slate-500 mt-0.5">{{ item.practice.schedule }} • {{ item.practice.location }}</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">Oktató: {{ item.practice.instructor }}</div>
                  </div>
                </div>
              </div>
              @if (item.status !== 'Teljesítve') {
              <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button (click)="openSwitch(item)" class="text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-3.5 py-2 rounded-xl transition border border-indigo-200">Gyakorlat váltás</button>
                <button (click)="dropping.set(item)" class="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3.5 py-2 rounded-xl transition border border-rose-200">Tárgy leadása</button>
              </div>
              }
            </div>
          }
        </div>
      }
    </div>

    @if (store.waitlist().length > 0) {
      <div class="space-y-3 mt-8">
        <div>
          <h2 class="text-lg sm:text-xl font-bold text-slate-900">Várólistám</h2>
          <p class="text-xs sm:text-sm text-slate-500">Ha a csoportban hely szabadul fel, a sorban elsőként várakozó hallgatót automatikusan felvesszük.</p>
        </div>
        @for (w of store.waitlist(); track w.id) {
          <div class="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2 py-0.5 text-xs font-bold font-mono bg-amber-100 text-amber-700 rounded">{{ w.courseCode }}</span>
                <h3 class="text-base font-bold text-slate-900">{{ w.courseTitle }}</h3>
                <span class="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">{{ w.credits }} Kredit</span>
              </div>
              <div class="text-xs text-slate-500">{{ w.practice.name }} • {{ w.practice.schedule }} • {{ w.practice.location }}</div>
              <div class="text-xs font-bold text-amber-700">Helye a sorban: {{ w.position }}.</div>
            </div>
            <button (click)="leaveWaitlist(w)" [disabled]="busy()" class="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3.5 py-2 rounded-xl transition border border-rose-200 self-end sm:self-center disabled:opacity-60">Lemondás</button>
          </div>
        }
      </div>
    }

    @if (switching(); as rec) {
      <div class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative">
          <button (click)="switching.set(null)" aria-label="Bezárás" class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <h3 class="text-lg sm:text-xl font-bold text-slate-900 mb-1">Gyakorlat váltás</h3>
          <p class="text-xs sm:text-sm text-slate-500 mb-5">
            <span class="font-bold text-slate-800">{{ rec.courseCode }} — {{ rec.courseTitle }}</span><br>
            A tárgy és az előadás megmarad, csak a gyakorlati csoportja változik.
          </p>
          <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
            @for (prac of switchOptions(); track prac.id) {
              <label [class]="slotClass(prac, rec)" class="flex items-start p-3 rounded-xl border transition">
                <input type="radio" name="switchSlot" [disabled]="!canPick(prac, rec)"
                  [checked]="switchTarget() === prac.id" (change)="switchTarget.set(prac.id)" class="mt-0.5 text-indigo-600">
                <div class="ml-3 flex-1 text-xs">
                  <div class="flex items-center justify-between font-bold text-slate-900">
                    <span>{{ prac.name }}@if (prac.id === rec.practice.id) { <span class="ml-1 font-semibold text-indigo-600">(jelenlegi)</span> }</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded" [class]="prac.capacity - prac.enrolledCount <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'">
                      {{ prac.capacity - prac.enrolledCount <= 0 ? 'Betelt' : (prac.capacity - prac.enrolledCount) + ' szabad hely' }}
                    </span>
                  </div>
                  <div class="text-slate-600 font-semibold mt-1">{{ prac.schedule }}</div>
                  @if (prac.id !== rec.practice.id && conflictWith(prac, rec); as c) { <div class="text-[11px] font-bold text-rose-600 mt-0.5">Órarendi ütközés: {{ c }}</div> }
                  <div class="text-slate-500 mt-0.5 text-[11px] flex items-center justify-between"><span>Helyszín: {{ prac.location }}</span><span>Oktató: {{ prac.instructor }}</span></div>
                </div>
              </label>
            }
          </div>
          <div class="flex items-center justify-end space-x-3 pt-4 mt-4 border-t border-slate-100">
            <button type="button" (click)="switching.set(null)" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800">Mégse</button>
            <button type="button" (click)="confirmSwitch(rec)" [disabled]="!switchTarget() || busy()"
              class="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed">
              Váltás megerősítése
            </button>
          </div>
        </div>
      </div>
    }

    @if (dropping(); as rec) {
      <app-confirm-modal title="Tárgy leadásának megerősítése"
        [message]="'Biztosan le szeretné adni a(z) ' + rec.courseCode + ' — ' + rec.courseTitle + ' kurzust?'"
        [note]="'A leadással ' + rec.credits + ' kredit szabadul fel, és a(z) ' + rec.practice.name + ' csoportban is felszabadul egy hely.'"
        confirmLabel="Tárgy végleges leadása" [busy]="busy()"
        (cancelled)="dropping.set(null)" (confirmed)="confirmDrop(rec)" />
    }
  `
})
export class EnrollmentsPage implements OnInit {
  readonly store = inject(StudentStore);
  readonly router = inject(Router);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  dropping = signal<EnrollmentRecord | null>(null);
  switching = signal<EnrollmentRecord | null>(null);
  switchTarget = signal<number | null>(null);

  /** A váltással érintett kurzus gyakorlati csoportjai (a katalógusból). */
  switchOptions = computed<CourseSlot[]>(() => {
    const rec = this.switching();
    return rec ? (this.store.courses().find((c) => c.id === rec.courseId)?.practices ?? []) : [];
  });
  busy = signal(false);

  ngOnInit(): void { this.store.load(); }

  openSwitch(rec: EnrollmentRecord): void {
    this.switchTarget.set(null);
    this.switching.set(rec);
  }

  /** Ütközés a hallgató többi tárgyával és az ugyanazon kurzushoz tartozó előadással (a saját gyakorlatát nem számítjuk). */
  conflictWith(slot: CourseSlot, rec: EnrollmentRecord): string | null {
    if (schedulesOverlap(slot.schedule, rec.lecture.schedule)) return `${rec.courseCode} – ${rec.lecture.name} (${rec.lecture.schedule})`;
    for (const e of this.store.enrollments()) {
      if (e.id === rec.id) continue;
      for (const other of [e.lecture, e.practice]) {
        if (schedulesOverlap(slot.schedule, other.schedule)) return `${e.courseCode} – ${other.name} (${other.schedule})`;
      }
    }
    return null;
  }

  canPick(slot: CourseSlot, rec: EnrollmentRecord): boolean {
    return slot.id !== rec.practice.id && slot.capacity - slot.enrolledCount > 0 && !this.conflictWith(slot, rec);
  }

  slotClass(slot: CourseSlot, rec: EnrollmentRecord): string {
    if (!this.canPick(slot, rec)) return 'opacity-60 bg-slate-100 border-slate-200 cursor-not-allowed';
    return this.switchTarget() === slot.id
      ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 cursor-pointer'
      : 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer';
  }

  confirmSwitch(rec: EnrollmentRecord): void {
    const target = this.switchTarget();
    if (!target) return;
    this.busy.set(true);
    this.api.changePractice(rec.id, target).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.switching.set(null);
        this.store.load();
        this.toast.add('success', 'Gyakorlat megváltoztatva',
          `${updated.courseCode}: ${updated.practice.name} — ${updated.practice.schedule}.`);
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error(err, 'A gyakorlatváltás nem sikerült');
        this.store.load();
        this.switching.set(null);
      }
    });
  }

  leaveWaitlist(w: WaitlistRecord): void {
    this.busy.set(true);
    this.api.leaveWaitlist(w.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.store.load();
        this.toast.add('info', 'Várólista lemondva', `Lekerült a várólistáról: ${w.courseCode} (${w.practice.name}).`);
      },
      error: (err) => { this.busy.set(false); this.toast.error(err, 'A lemondás nem sikerült'); }
    });
  }

  confirmDrop(rec: EnrollmentRecord): void {
    this.busy.set(true);
    this.api.drop(rec.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.dropping.set(null);
        this.store.load();
        this.toast.add('info', 'Tárgy leadva', `Sikeresen leadta a(z) ${rec.courseCode} tantárgyat és a hozzá tartozó gyakorlatot.`);
      },
      error: (err) => { this.busy.set(false); this.toast.error(err, 'A tárgy leadása nem sikerült'); }
    });
  }
}
