import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {DocumentExtactorComponent} from "./document-extactor/document-extactor.component";
import {PagesLayoutComponent} from "../../layouts/pages-layout/pages-layout.component";

const routes: Routes = [
  {
    path: '',
    component : PagesLayoutComponent,
    children: [
      { path: 'doc' , component: DocumentExtactorComponent},

    ]}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PagesRoutingModule { }
