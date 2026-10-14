import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-50 text-slate-800 min-h-screen transition-colors duration-200 flex flex-col font-sans">

      @if (auth.user(); as user) {
      <header class="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-slate-200 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-14 sm:h-16 gap-4">
            <a [routerLink]="auth.homeUrl()" (click)="menuOpen.set(false)" class="flex items-center space-x-2 select-none">
              <div class="bg-gradient-to-tr from-indigo-600 to-violet-500 text-white p-2 rounded-xl shadow-md shadow-indigo-500/20">
                <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                </svg>
              </div>
              <span class="text-base sm:text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">CourseHub</span>
            </a>

            <!-- Asztali menü -->
            <div class="hidden sm:flex items-center gap-2 sm:gap-4">
              <nav class="flex items-center gap-2">
                @for (item of navItems(); track item.path) {
                  <a [routerLink]="item.path" routerLinkActive #rla="routerLinkActive" [class]="rla.isActive ? active : idle"
                    class="px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap">{{ item.label }}</a>
                }
              </nav>
              <div class="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs border border-slate-200/60">
                <div class="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">{{ initials(user.name) }}</div>
                <div class="flex flex-col text-left">
                  <div class="flex items-center space-x-1.5">
                    <span class="font-bold text-slate-800">{{ user.name }}</span>
                    @if (user.studentId) {
                      <span class="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-semibold">{{ user.studentId }}</span>
                    }
                  </div>
                  <span class="text-[10px] text-slate-500">{{ user.role === 'student' ? user.major : user.title }}</span>
                </div>
              </div>
              <button (click)="auth.logout()" class="px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition whitespace-nowrap">Kijelentkezés</button>
            </div>

            <!-- Hamburger gomb (mobil) -->
            <button type="button" class="sm:hidden p-2 -mr-2 rounded-lg text-slate-700 hover:bg-slate-100"
              [attr.aria-expanded]="menuOpen()" aria-controls="mobile-menu" aria-label="Menü" (click)="menuOpen.set(!menuOpen())">
              @if (menuOpen()) {
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              } @else {
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
              }
            </button>
          </div>
        </div>

        <!-- Mobil menü -->
        @if (menuOpen()) {
          <div id="mobile-menu" class="sm:hidden border-t border-slate-200 bg-white/95">
            <div class="px-4 py-3 space-y-1">
              @for (item of navItems(); track item.path) {
                <a [routerLink]="item.path" routerLinkActive #mrla="routerLinkActive" [class]="mrla.isActive ? active : idle"
                  (click)="menuOpen.set(false)" class="block px-3 py-2.5 rounded-lg text-sm transition-all">{{ item.label }}</a>
              }
            </div>
            <div class="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">{{ initials(user.name) }}</div>
                <div class="min-w-0">
                  <div class="text-sm font-bold text-slate-800 truncate">{{ user.name }}</div>
                  <div class="text-[11px] text-slate-500 truncate">{{ user.role === 'student' ? user.major : user.title }}@if (user.studentId) { • {{ user.studentId }} }</div>
                </div>
              </div>
              <button (click)="menuOpen.set(false); auth.logout()" class="px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition whitespace-nowrap">Kijelentkezés</button>
            </div>
          </div>
        }
      </header>
      }

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full">
        <router-outlet />
      </main>


      <div class="fixed bottom-4 right-4 z-[60] flex flex-col space-y-2 max-w-sm w-full pointer-events-none px-2 sm:px-0" aria-live="polite">
        @for (toast of toastService.toasts(); track toast.id) {
          <div class="pointer-events-auto p-3.5 sm:p-4 rounded-xl shadow-xl border flex items-start space-x-3 bg-white border-slate-200">
            <span class="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
              [class]="toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'warning' ? 'bg-amber-500' : toast.type === 'error' ? 'bg-rose-500' : 'bg-sky-500'"></span>
            <div class="flex-1 overflow-hidden">
              <h4 class="text-xs font-bold text-slate-900">{{ toast.title }}</h4>
              <p class="text-xs text-slate-600 mt-0.5 leading-snug">{{ toast.message }}</p>
            </div>
            <button (click)="toastService.remove(toast.id)" aria-label="Bezárás" class="text-slate-400 hover:text-slate-600 p-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class App {
  readonly auth = inject(AuthService);
  readonly toastService = inject(ToastService);

  /** Mobilon nyitható hamburger menü */
  readonly menuOpen = signal(false);

  readonly navItems = computed(() =>
    this.auth.user()?.role === 'student'
      ? [
          { path: '/student/courses', label: 'Kurzuskatalógus' },
          { path: '/student/enrollments', label: 'Jelentkezéseim' },
          { path: '/student/timetable', label: 'Órarend' }
        ]
      : [
          { path: '/instructor/courses', label: 'Saját kurzusaim' },
          { path: '/instructor/timetable', label: 'Órarend' }
        ]
  );

  readonly active = 'bg-indigo-50 text-indigo-600 font-semibold';
  readonly idle = 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';

  initials(name: string): string {
    return name.replace(/^(Dr|Prof)\.\s*/i, '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }
}
