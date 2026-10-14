import { Routes } from '@angular/router';
import { loginGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: 'login', canActivate: [loginGuard], loadComponent: () => import('./pages/login').then((m) => m.LoginPage) },
  {
    path: 'student',
    canActivate: [roleGuard('student')],
    children: [
      { path: 'courses', loadComponent: () => import('./pages/catalog').then((m) => m.CatalogPage) },
      { path: 'enrollments', loadComponent: () => import('./pages/enrollments').then((m) => m.EnrollmentsPage) },
      { path: 'timetable', loadComponent: () => import('./pages/student-timetable').then((m) => m.StudentTimetablePage) },
      { path: '', pathMatch: 'full', redirectTo: 'courses' }
    ]
  },
  {
    path: 'instructor',
    canActivate: [roleGuard('instructor')],
    children: [
      { path: 'courses', loadComponent: () => import('./pages/instructor').then((m) => m.InstructorPage) },
      { path: 'timetable', loadComponent: () => import('./pages/instructor-timetable').then((m) => m.InstructorTimetablePage) },
      { path: '', pathMatch: 'full', redirectTo: 'courses' }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
