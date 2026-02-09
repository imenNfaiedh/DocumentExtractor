import { Routes } from '@angular/router';
import {AuthLayoutComponent} from "./layouts/auth-layout/auth-layout.component";

export const routes: Routes = [

  {
    path: 'auth',
    component: AuthLayoutComponent, loadChildren: () => import('./modules/auth/auth.module')
        .then(m => m.AuthModule)
  }
];
