import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TimeRange, parseSchedule } from '../core/schedule';

/** Egy órarendi blokk. Az időpont a megszokott „Hétfő 10:00 - 11:30” formátumban érkezik. */
export interface TimetableEvent {
  id: string;
  kind: 'lecture' | 'practice';
  code: string;      // pl. CS102
  title: string;     // kurzus neve
  label: string;     // pl. Előadás vagy G01 - Labor
  schedule: string;
  location: string;
  detail?: string;   // pl. oktató neve, létszám
  muted?: boolean;   // halványított blokk
}

interface Placed { ev: TimetableEvent; top: number; height: number; lane: number; lanes: number; time: string; }

const DAY_NAMES = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'];
const HOUR_PX = 56;
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** Az egy napra eső blokkok elhelyezése; az egymást átfedők egymás mellé kerülnek. */
function place(items: { ev: TimetableEvent; r: TimeRange }[], firstHour: number): Placed[] {
  const sorted = [...items].sort((a, b) => a.r.start - b.r.start || a.r.end - b.r.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const flush = () => {
    cluster.forEach((p) => (p.lanes = laneEnds.length));
    out.push(...cluster);
    cluster = []; laneEnds = []; clusterEnd = -1;
  };

  for (const { ev, r } of sorted) {
    if (cluster.length && r.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= r.start);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(r.end); } else { laneEnds[lane] = r.end; }
    clusterEnd = Math.max(clusterEnd, r.end);
    cluster.push({
      ev, lane, lanes: 1,
      top: ((r.start - firstHour * 60) / 60) * HOUR_PX,
      height: ((r.end - r.start) / 60) * HOUR_PX,
      time: `${fmt(r.start)}-${fmt(r.end)}`
    });
  }
  flush();
  return out;
}

@Component({
  selector: 'app-timetable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div class="flex items-center justify-end gap-4 px-4 pt-3 text-xs font-medium text-slate-600">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-indigo-600 inline-block"></span>Előadás</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-600 inline-block"></span>Gyakorlat</span>
      </div>

      <!-- Mobil: napok szerint csoportosított lista -->
      <div class="md:hidden p-3 space-y-4">
        @for (c of layout().columns; track c.d) {
          @if (c.items.length > 0) {
            <section>
              <h3 class="text-xs font-bold mb-2" [class]="c.d === today ? 'text-indigo-600' : 'text-slate-500'">
                {{ c.name }}@if (c.d === today) { <span class="ml-1 font-semibold">• ma</span> }
              </h3>
              <div class="space-y-2">
                @for (p of c.items; track p.ev.id) {
                  <div class="flex rounded-xl overflow-hidden border border-slate-200 bg-white" [class.opacity-60]="p.ev.muted">
                    <div class="w-1.5 shrink-0" [class]="p.ev.kind === 'lecture' ? 'bg-indigo-600' : 'bg-emerald-600'"></div>
                    <div class="flex-1 min-w-0 p-3">
                      <div class="flex items-baseline justify-between gap-2">
                        <span class="text-[11px] font-bold uppercase tracking-wide truncate"
                          [class]="p.ev.kind === 'lecture' ? 'text-indigo-700' : 'text-emerald-700'">{{ p.ev.code }} · {{ p.ev.label }}</span>
                        <span class="text-xs font-mono font-semibold text-slate-700 whitespace-nowrap">{{ p.time }}</span>
                      </div>
                      <div class="text-sm font-bold text-slate-900 leading-snug">{{ p.ev.title }}</div>
                      <div class="text-xs text-slate-500 mt-0.5">{{ p.ev.location }}@if (p.ev.detail) { • {{ p.ev.detail }} }</div>
                    </div>
                  </div>
                }
              </div>
            </section>
          }
        }
      </div>

      <!-- Asztali / tablet: heti rács -->
      <div class="hidden md:block overflow-x-auto">
        <div class="min-w-[720px] p-3 sm:p-4">
          <div class="flex">
            <div class="w-12 shrink-0"></div>
            @for (c of layout().columns; track c.d) {
              <div class="flex-1 text-center text-xs font-semibold py-2"
                [class]="c.d === today ? 'text-indigo-600' : 'text-slate-500'">{{ c.name }}</div>
            }
          </div>

          <div class="flex border-t border-slate-200">
            <div class="w-12 shrink-0 relative" [style.height.px]="layout().height">
              @for (h of layout().hours; track h; let i = $index) {
                <span class="absolute right-2 text-[11px] font-mono text-slate-400" [style.top.px]="i * hourPx + 2">{{ h }}:00</span>
              }
            </div>

            @for (c of layout().columns; track c.d) {
              <div class="flex-1 relative border-l border-slate-100" [style.height.px]="layout().height"
                [style.background-image]="gridBg" [class.bg-indigo-50]="c.d === today">
                @for (p of c.items; track p.ev.id) {
                  <div class="absolute box-border rounded-lg px-2 py-1 text-white border overflow-hidden shadow-sm"
                    [class]="(p.ev.kind === 'lecture' ? 'bg-indigo-600 border-indigo-700' : 'bg-emerald-600 border-emerald-700') + (p.ev.muted ? ' opacity-50' : '')"
                    [style.top.px]="p.top + 1" [style.height.px]="p.height - 2"
                    [style.left]="'calc(' + (p.lane * 100 / p.lanes) + '% + 2px)'"
                    [style.width]="'calc(' + (100 / p.lanes) + '% - 4px)'"
                    [attr.title]="p.ev.code + ' – ' + p.ev.title + '\\n' + p.ev.label + '\\n' + p.time + ' • ' + p.ev.location + (p.ev.detail ? '\\n' + p.ev.detail : '')">
                    <div class="text-[10px] uppercase tracking-wide font-bold opacity-85 truncate">{{ p.ev.code }} · {{ p.ev.label }}</div>
                    @if (p.height >= 48) { <div class="text-[11px] font-bold leading-tight truncate">{{ p.ev.title }}</div> }
                    @if (p.height >= 70) { <div class="text-[10px] opacity-90 truncate">{{ p.time }} • {{ p.ev.location }}</div> }
                    @if (p.height >= 90 && p.ev.detail) { <div class="text-[10px] opacity-90 truncate">{{ p.ev.detail }}</div> }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class Timetable {
  events = input.required<TimetableEvent[]>();

  readonly hourPx = HOUR_PX;
  readonly gridBg = `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, #f1f5f9 ${HOUR_PX - 1}px, #f1f5f9 ${HOUR_PX}px)`;
  readonly today = (new Date().getDay() + 6) % 7; // hétfő = 0

  layout = computed(() => {
    const parsed = this.events()
      .map((ev) => ({ ev, r: parseSchedule(ev.schedule) }))
      .filter((x): x is { ev: TimetableEvent; r: TimeRange } => !!x.r);

    const firstHour = Math.min(8, ...parsed.map((p) => Math.floor(p.r.start / 60)));
    const lastHour = Math.max(18, ...parsed.map((p) => Math.ceil(p.r.end / 60)));
    const hours = Array.from({ length: lastHour - firstHour }, (_, i) => pad(firstHour + i));
    const lastDay = Math.max(4, ...parsed.map((p) => p.r.day)); // hétvége csak ha van rá óra

    const columns = DAY_NAMES.slice(0, lastDay + 1).map((name, d) => ({
      name, d, items: place(parsed.filter((p) => p.r.day === d), firstHour)
    }));
    return { hours, columns, height: hours.length * HOUR_PX };
  });
}
