import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200">
        <h3 class="text-base sm:text-lg font-bold text-rose-600 mb-3">{{ title() }}</h3>
        <p class="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">{{ message() }}</p>
        @if (note()) {
          <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-5">
            {{ note() }}
          </div>
        }
        <div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
          <button type="button" (click)="cancelled.emit()"
            class="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl transition">
            Mégse
          </button>
          <button type="button" (click)="confirmed.emit()" [disabled]="busy()"
            class="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-xl shadow transition">
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmModal {
  title = input.required<string>();
  message = input.required<string>();
  note = input<string>('');
  confirmLabel = input('Megerősítés');
  busy = input(false);
  confirmed = output<void>();
  cancelled = output<void>();
}
