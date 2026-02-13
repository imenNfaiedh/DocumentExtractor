import { Injectable } from '@angular/core';
import {ScanFacture} from "../../shared/models/ScanFacture";

@Injectable({
  providedIn: 'root'
})
export class FactureService {
  private factures: ScanFacture[] = [];

  addFacture(f: ScanFacture) {
    this.factures.push(f);
  }

  getFactures() {
    return this.factures;
  }
}
