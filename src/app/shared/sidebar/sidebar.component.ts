import {Component, EventEmitter, HostListener, OnInit, Output} from '@angular/core';
import {RouterLink, RouterLinkActive} from "@angular/router";
import {NgClass, NgForOf, NgIf} from "@angular/common";
import {animate, style, transition, trigger} from "@angular/animations";
import {SideNavToggle} from "../../core/utils/type";
import {NAV_BAR_ITEMS} from "../../core/utils/navbar-items";
import {MOBILE_BREAKPOINT} from "../../core/utils/constants";

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    NgClass,
    NgIf,
    NgForOf
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('350ms', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        style({ opacity: 1 }),
        animate('350ms', style({ opacity: 0 })),
      ]),
    ]),
  ],
})


export class SidebarComponent implements  OnInit{
  @Output() toggleSideNav = new EventEmitter<SideNavToggle>();

  public collapsed = false; //sidebar est repliée
  public screenWidth = 0; // largeur de l’écran
  public readonly navItems = NAV_BAR_ITEMS; //liste des liens de navigation

  ngOnInit(): void {
    this.updateScreenWidth();
    this.handleScreenResize();
  }

  //Écoute du redimensionnement d’écran
  @HostListener('window:resize')
  private onResize(): void {
    this.updateScreenWidth();
    this.handleScreenResize();
  }

  public toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.emitSideNavState();
  }

  public closeSidenav(): void {
    this.collapsed = false;
    this.emitSideNavState();
  }

  public selectItem(): void {
    if (this.isMobileView()) {
      this.collapsed = false;
      this.emitSideNavState();
    }
  }

  private updateScreenWidth(): void {
    this.screenWidth = window.innerWidth;
  }

  private handleScreenResize(): void {
    this.collapsed = !this.isMobileView();
    this.emitSideNavState();
  }

  private isMobileView(): boolean {
    return this.screenWidth <= MOBILE_BREAKPOINT;
  }
  //Envoie l’état de la sidebar vers un composant parent (via @Output()).
  private emitSideNavState(): void {
    this.toggleSideNav.emit({
      collapsed: this.collapsed,
      screenWidth: this.screenWidth,
    });
  }


}


