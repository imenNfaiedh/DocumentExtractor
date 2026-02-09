import { Component } from '@angular/core';
import {SidebarComponent} from "../../shared/sidebar/sidebar.component";
import {HeaderComponent} from "../../shared/header/header.component";

@Component({
  selector: 'app-pages-layout',
  standalone: true,
  imports: [
    SidebarComponent,
    HeaderComponent
  ],
  templateUrl: './pages-layout.component.html',
  styleUrl: './pages-layout.component.css'
})
export class PagesLayoutComponent {

}
