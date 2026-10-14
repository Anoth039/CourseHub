import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div class="w-full max-w-md">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900">Bejelentkezés</h1>
        <p class="text-xs sm:text-sm text-slate-500 mt-1 mb-6">
          Lépjen be az egyetemi e-mail címével a tárgyfelvételhez vagy a kurzusai kezeléséhez.
        </p>

        <form (submit)="submit($event)" class="space-y-4 text-xs sm:text-sm">
          <div>
            <label for="email" class="block font-bold text-slate-700 mb-1">E-mail cím</label>
            <input id="email" name="email" type="email" required autocomplete="username" [(ngModel)]="email"
              class="w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>
          <div>
            <label for="password" class="block font-bold text-slate-700 mb-1">Jelszó</label>
            <input id="password" name="password" type="password" required autocomplete="current-password" [(ngModel)]="password"
              class="w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>

          @if (error()) {
            <div role="alert" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {{ error() }}
            </div>
          }

          <button type="submit" [disabled]="busy()"
            class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold shadow-md transition">
            {{ busy() ? 'Belépés…' : 'Belépés' }}
          </button>
        </form>

      </div>
    </div>
      </div>
  `
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  busy = signal(false);
  error = signal('');

  submit(e: Event): void {
    e.preventDefault();
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.email().trim(), this.password()).subscribe({
      next: () => { this.busy.set(false); this.router.navigateByUrl(this.auth.homeUrl()); },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'A szerver nem érhető el.');
      }
    });
  }
}