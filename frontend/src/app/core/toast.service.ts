import { Injectable, signal } from '@angular/core';
import { ToastMessage } from './models';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);
  private nextId = 1;

  add(type: ToastMessage['type'], title: string, message: string): void {
    const id = this.nextId++;
    this.toasts.update((l) => [{ id, type, title, message }, ...l]);
    setTimeout(() => this.remove(id), 4500);
  }

  error(err: unknown, title = 'Hiba történt'): void {
    const msg = (err as any)?.error?.message ?? 'A szerver nem érhető el, próbálja újra később.';
    this.add('error', title, msg);
  }

  remove(id: number): void {
    this.toasts.update((l) => l.filter((t) => t.id !== id));
  }
}
