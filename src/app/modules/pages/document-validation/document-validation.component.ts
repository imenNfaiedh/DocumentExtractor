import {Component, OnInit} from '@angular/core';
import {FactureService} from "../../../core/service/facture.service";
import {DatePipe, NgForOf, NgIf} from "@angular/common";

@Component({
  selector: 'app-document-validation',
  standalone: true,
  imports: [
    DatePipe,
    NgForOf,
    NgIf
  ],
  templateUrl: './document-validation.component.html',
  styleUrl: './document-validation.component.css'
})
export class DocumentValidationComponent implements OnInit{

  factures: any[] = [];

  constructor(private factureService: FactureService) {}

  ngOnInit() {
    this.factures = this.factureService.getFactures();
  }



}
