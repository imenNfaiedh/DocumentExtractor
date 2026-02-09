import {Component, OnInit} from '@angular/core';
import {SidebarComponent} from "../../shared/sidebar/sidebar.component";
import {HeaderComponent} from "../../shared/header/header.component";
import {SideNavToggle} from "../../core/utils/type";
import {BodyComponent} from "../../shared/body/body.component";

@Component({
  selector: 'app-pages-layout',
  standalone: true,
  imports: [
    SidebarComponent,
    HeaderComponent,
    BodyComponent
  ],
  templateUrl: './pages-layout.component.html',
  styleUrl: './pages-layout.component.css'
})
export class PagesLayoutComponent implements OnInit{
  title = 'sidenav';

  isSideNavCollapsed = false;
  screenWidth = 0;
  constructor( ) {}

  ngOnInit() {


  }

  onToggleSideNav(data: SideNavToggle): void {
    this.screenWidth = data.screenWidth;
    this.isSideNavCollapsed = data.collapsed;
  }
}
