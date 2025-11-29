import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/reports/reports').then((m) => m.Reports),
  },
  {
    path: 'logs',
    loadComponent: () => import('./pages/logs/logs').then((m) => m.Logs),
  },
  {
    path: 'market-scanner',
    loadComponent: () =>
      import('./pages/market-scanner/market-scanner').then((m) => m.MarketScanner),
  },
];
