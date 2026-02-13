import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {DocumentExtactorComponent} from "./document-extactor/document-extactor.component";
import {PagesLayoutComponent} from "../../layouts/pages-layout/pages-layout.component";
import {DocumentValidationComponent} from "./document-validation/document-validation.component";

const routes: Routes = [
  {
    path: '',
    component : PagesLayoutComponent,
    children: [
      { path: 'scannerDoc' , component: DocumentExtactorComponent},
      { path: 'validateDoc' , component: DocumentValidationComponent},

    ]}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PagesRoutingModule { }
