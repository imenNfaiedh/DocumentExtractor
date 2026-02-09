import { Routes } from '@angular/router';
import {AuthLayoutComponent} from "./layouts/auth-layout/auth-layout.component";

export const routes: Routes = [
  // rediriger la racine vers 'auth' (le module auth)
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule)
  },

  {
    path: 'pages',
    loadChildren: () => import('./modules/pages/pages.module').then(m => m.PagesModule)
  },


  { path: '**', redirectTo: 'auth/login' }
];
