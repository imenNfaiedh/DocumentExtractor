import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {LoginComponent} from "./login/login.component";
import {AuthLayoutComponent} from "../../layouts/auth-layout/auth-layout.component";

const routes: Routes = [

  {
    path: '',
    children: [
      { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
      { path: 'login', component: LoginComponent }
    ]
  }
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }
