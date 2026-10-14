import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export interface ComboOption {
  value: number | string;
  label: string;
  sub?: string;        // másodlagos sor (pl. tanszék)
  disabled?: boolean;  // nem választható
  note?: string;       // rövid megjegyzés a sor végén (pl. „foglalt”)
}

/** Kereshető legördülő lista: gépeléssel szűr (ékezetek és kis/nagybetű nélkül), kattintással vagy billentyűvel választ. */
@Component({
  selector: 'app-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <input type="text" role="combobox" autocomplete="off" [attr.aria-expanded]="open()"
        [value]="open() ? query() : selectedLabel()"
        [placeholder]="open() && selectedLabel() ? selectedLabel() : placeholder()"
        [class]="inputClass() + ' pr-8'"
        (focus)="openList()" (click)="openList()" (blur)="close()"
        (input)="onInput($any($event.target).value)" (keydown)="onKey($event)">

      @if (clearable() && value() !== null && !open()) {
        <button type="button" aria-label="Törlés" (mousedown)="clear($event)"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      } @else {
        <svg class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      }

      @if (open()) {
        <ul role="listbox" class="absolute z-30 mt-1 w-full max-h-56 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1">
          @for (o of filtered(); track o.value; let i = $index) {
            <li role="option" [attr.aria-selected]="o.value === value()" [attr.aria-disabled]="o.disabled || null"
              (mousedown)="pick(o, $event)"
              class="px-3 py-2 text-xs sm:text-sm"
              [class]="o.disabled ? 'text-slate-400 cursor-not-allowed' : 'cursor-pointer ' + (i === active() ? 'bg-indigo-50' : 'hover:bg-slate-50')">
              <div class="flex items-center justify-between gap-2">
                <span [class]="o.value === value() ? 'font-bold text-indigo-700' : 'font-medium'">{{ o.label }}</span>
                @if (o.note) { <span class="text-[10px] font-semibold text-amber-600 whitespace-nowrap">{{ o.note }}</span> }
              </div>
              @if (o.sub) { <div class="text-[11px] text-slate-500">{{ o.sub }}</div> }
            </li>
          } @empty {
            <li class="px-3 py-2 text-xs text-slate-500">Nincs találat.</li>
          }
        </ul>
      }
    </div>
  `
})
export class Combobox {
  options = input.required<ComboOption[]>();
  value = input<number | string | null>(null);
  placeholder = input('Keresés…');
  clearable = input(false);
  inputClass = input('w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500');
  valueChange = output<number | string | null>();

  open = signal(false);
  query = signal('');
  active = signal(0);

  selectedLabel = computed(() => this.options().find((o) => o.value === this.value())?.label ?? '');

  filtered = computed(() => {
    const q = norm(this.query());
    const all = this.options();
    return q ? all.filter((o) => norm(`${o.label} ${o.sub ?? ''}`).includes(q)) : all;
  });

  openList(): void {
    if (this.open()) return;
    this.query.set('');
    this.open.set(true);
    this.active.set(this.firstEnabled());
  }

  close(): void { this.open.set(false); }

  onInput(v: string): void {
    this.query.set(v);
    this.open.set(true);
    this.active.set(this.firstEnabled());
  }

  pick(o: ComboOption, ev: Event): void {
    ev.preventDefault(); // az input ne veszítse el a fókuszt a kattintás előtt
    if (o.disabled) return;
    this.valueChange.emit(o.value);
    this.close();
  }

  clear(ev: Event): void {
    ev.preventDefault();
    this.valueChange.emit(null);
  }

  onKey(ev: KeyboardEvent): void {
    const list = this.filtered();
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.open.set(true);
      const step = ev.key === 'ArrowDown' ? 1 : -1;
      let i = this.active();
      for (let n = 0; n < list.length; n++) {
        i = (i + step + list.length) % list.length;
        if (!list[i].disabled) break;
      }
      this.active.set(i);
    } else if (ev.key === 'Enter' && this.open()) {
      ev.preventDefault();
      const o = list[this.active()];
      if (o && !o.disabled) { this.valueChange.emit(o.value); this.close(); }
    } else if (ev.key === 'Escape') {
      this.close();
    }
  }

  private firstEnabled(): number {
    const i = this.filtered().findIndex((o) => !o.disabled);
    return i < 0 ? 0 : i;
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
