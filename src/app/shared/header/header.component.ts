import {Component, Input} from '@angular/core';
import {animate, style, transition, trigger} from "@angular/animations";
import {NgClass} from "@angular/common";
import { ScreenConfig } from "../../core/utils/type";
import { APP_CONSTANTS } from '../../core/utils/constants';





@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    NgClass
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  animations: [
    trigger('dropdownAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' })),
      ]),
    ]),
  ]
})


export class HeaderComponent {
  protected readonly APP_CONSTANTS = APP_CONSTANTS;

  private readonly SCREEN_BREAKPOINTS: ScreenConfig[] = [
    { width: 768, class: 'header-trimmed' },
    { width: 0, class: 'header-md-screen' },
  ];

  @Input() collapsed: boolean = false;
  @Input() screenWidth: number = 0;


  getBodyClass(): string {
    if (!this.collapsed) return '';
    const config = this.SCREEN_BREAKPOINTS.find(config => this.screenWidth > config.width);
    return config?.class || '';
  }
}
