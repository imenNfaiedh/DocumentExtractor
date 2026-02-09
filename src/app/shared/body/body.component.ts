import {Component, Input} from '@angular/core';
import {NgClass} from "@angular/common";
import {RouterOutlet} from "@angular/router";

@Component({
  selector: 'app-body',
  standalone: true,
  imports: [
    NgClass,
    RouterOutlet
  ],
  templateUrl: './body.component.html',
  styleUrl: './body.component.css'
})
export class BodyComponent {

  @Input() collapsed = false;
  @Input() screenWidth = 0;

  getBodyClass(): string {
    if (!this.collapsed) return '';

    return this.screenWidth > 768
      ? 'body-trimmed'
      : this.screenWidth > 0
        ? 'body-md-screen'
        : '';
  }

}
