import { Component } from '@angular/core';
import {HttpClient, HttpClientModule, HttpHeaders} from "@angular/common/http";
import {JsonPipe, NgIf} from "@angular/common";
import {environment} from "../../../../environments/environment";
import {FactureService} from "../../../core/service/facture.service";

@Component({
  selector: 'app-document-extactor',
  standalone: true,
  imports: [
    NgIf, HttpClientModule, JsonPipe
  ],
  templateUrl: './document-extactor.component.html',
  styleUrl: './document-extactor.component.css'
})
export class DocumentExtactorComponent {

  selectedFile: File | null = null;
  extractedData: any;
  endpoint = environment.endpoint;
  apiKey = environment.apiKey;
  loading = false;
  loadingMessage = 'Analyse du document en cours...';

  labels = {
    ht: ['total ht','ht','hors taxe','sous total','subtotal', 'total hors taxe'],
    ttc: ['total ttc','ttc','net à payer','montant total','total facture','total'],
    tva: ['tva','vat','tax']
  };



  constructor(private http: HttpClient,
              private factureService: FactureService) {}

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  uploadFile() {
    if (!this.selectedFile) return;

    this.loading = true;
    this.loadingMessage = 'Envoi du document...';
    const url = `${this.endpoint}formrecognizer/documentModels/prebuilt-document:analyze?api-version=2023-07-31`;

    const headers = new HttpHeaders({
      'Ocp-Apim-Subscription-Key': this.apiKey,
      'Content-Type': this.selectedFile.type,
    });

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = reader.result as ArrayBuffer;

      this.http.post(url, fileData, { headers, observe: 'response' }).subscribe({
        next: (res: any) => {
          const operationLocation = res.headers.get('operation-location');
          if (operationLocation) {
            this.loadingMessage = 'Analyse en cours ...';
            console.log('Analyse en cours, polling URL:', operationLocation);
            this.pollResult(operationLocation);
          } else {
            this.loading = false;
            console.error('Pas d\'operation-location dans la réponse !');
          }
        },
        error: (err) => {
          this.loading = false;
          console.error('Erreur Azure:', err);
        },
      });
    };
    reader.readAsArrayBuffer(this.selectedFile);
  }

// Fonction pour récupérer le JSON final
  pollResult(operationUrl: string) {
    const headers = new HttpHeaders({ 'Ocp-Apim-Subscription-Key': this.apiKey });

    const intervalId = setInterval(() => {
      this.http.get(operationUrl, { headers }).subscribe((res: any) => {
        if (res.status === 'succeeded') {
          this.extractedData = this.buildInvoiceJson(res.analyzeResult);

          this.factureService.addFacture({
            name: this.selectedFile?.name || 'inconnu',
            date: new Date(),
            data: this.extractedData
          });

          // this.extractedData = res.analyzeResult; // ✅ JSON final
          this.loading = false;
          clearInterval(intervalId);
          console.log('Extraction terminée', this.extractedData);
        } else if (res.status === 'failed') {
          this.loading = false;
          clearInterval(intervalId);
          console.error('Erreur d\'analyse Azure', res);
        }
      });
    }, 6000);
  }



  // --- Construire le JSON final
  buildInvoiceJson(analyzeResult: any) {
    const text = analyzeResult.content || '';
    const tablesText = this.extractTotalsFromTables(analyzeResult);
    const fullText = this.normalizeText(text + " " + tablesText);

    const facture: any = {
      meta: {},
      societe: {},
      client: {},
      totaux: {},
      lignes: []
    };

    // META
    facture.meta.numero = this.regex(fullText, /(facture\s*n[°º]?|num[eé]ro)\s*[:\-]?\s*([a-z0-9\/-]+)/i, 2);
    facture.meta.date = this.regex(fullText, /date\s*[:\-]?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})/i, 1);
    facture.meta.devise = (fullText.match(/\b(tnd|eur|usd|mad|dzd)\b/i) || [])[0]?.toLowerCase() || 'tnd';

    // SOCIETE
    const societeMatch = fullText.match(/(soci[eé]t[eé]\s+([\w\s]+?))(?=\s+facture|client|$)/i);
    if (societeMatch) facture.societe.nom = societeMatch[2].trim();

    const mfMatch = fullText.match(/(?:^|\s)mf\s*[:\-]?\s*([a-z0-9\/]+)/i);
    if (mfMatch) facture.societe.mf = mfMatch[1];

    // CLIENT
    facture.client = this.extractClientInfo(fullText);

    // TOTAUX
    const totals = this.buildInvoiceTotals(fullText);
    facture.totaux.ht = totals.ht;
    facture.totaux.ttc = totals.ttc;
    facture.totaux.tva = totals.tva;

    // LIGNES
    facture.lignes = this.extractLinesFromTables(analyzeResult);
    if (facture.lignes.length === 0) {
      facture.lignes = this.extractLinesFromText(fullText);
    }

    return { facture };
  }

  // --- Totaux dynamiques
  buildInvoiceTotals(fullText: string) {
    return {
      ht: this.findAmountAnywhere(fullText, this.labels.ht),
      ttc: this.findAmountAnywhere(fullText, this.labels.ttc),
      tva: this.extractTVA(fullText)
    };
  }

  // --- TVA multi-taux
  extractTVA(text: string): any[] {
    const normalized = this.normalizeText(text);
    const res: any[] = [];
    const regex = /(\d{1,2})\s*%\s*[:=]?\s*([0-9\s,.]+)/g;
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      res.push({ taux: +match[1], montant: this.toNumber(match[2]) });
    }
    return res;
  }
  extractClientInfo(text: string): any {
    const client = { nom: '', mf: '', adresse: '' };

    // Nom du client
    const nomMatch = text.match(/client\s*[:\-]?\s*\n?\s*([^\n]+?)(?=\s+mf|\s+adresse|$)/i);
    if (nomMatch) client.nom = nomMatch[1].trim();

    // MF client
    const mfMatch = text.match(/(?:mf|matricule\s+fiscal)\s*[:\-]?\s*([a-z0-9\/]+)/i);
    if (mfMatch) client.mf = mfMatch[1];

    // Adresse
    const adrMatch = text.match(/adresse?\s*[:\-]?\s*\n?\s*(.+?)(?=\s+(?:cher|devise|total|$))/i);
    if (adrMatch) client.adresse = adrMatch[1].trim();

    return client;
  }

  // --- Extraction lignes à partir des tables
  extractLinesFromTables(analyzeResult: any) {
    const lignes: any[] = [];
    analyzeResult.tables?.forEach((table: any) => {
      const rows: any = {};
      table.cells.forEach((c: any) => {
        rows[c.rowIndex] = rows[c.rowIndex] || {};
        rows[c.rowIndex][c.columnIndex] = c.content;
      });
      const header = this.findHeaderRow(rows);
      if (!header) return;
      const cols = this.detectColumns(header);
      Object.values(rows).slice(1).forEach((row: any) => {
        if (!row[cols.description]) return;
        lignes.push({
          description: row[cols.description],
          quantite: this.toNumber(row[cols.quantite]),
          prixUnitaire: this.toNumber(row[cols.prix]),
          total: this.toNumber(row[cols.total])
        });
      });
    });
    return lignes;
  }

  findHeaderRow(rows: any) {
    return Object.values(rows).find((row: any) =>
      Object.values(row).some((cell: any) => /desc|libell|designation|article|produit/i.test(cell))
    );
  }

  detectColumns(header: any) {
    const map: any = { description: null, quantite: null, prix: null, total: null };
    Object.keys(header).forEach(col => {
      const h = header[col].toLowerCase();
      if (/desc|libell|designation|article|produit/.test(h)) map.description = col;
      if (/quant|qte|qty|qté|nombre/.test(h)) map.quantite = col;
      if (/pu|prix.*unit|prix unitaire|unit.*prix|price/.test(h)) map.prix = col;
      if (/total|montant|amount|ttc/.test(h)) map.total = col;
    });
    return map;
  }

  // --- Extraction lignes si pas de table
  extractLinesFromText(text: string) {
    const lignes: any[] = [];
    const matches = [...text.matchAll(/(.+?)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)/g)];
    matches.forEach(m => {
      lignes.push({
        description: m[1],
        quantite: this.toNumber(m[2]),
        prixUnitaire: this.toNumber(m[3]),
        total: this.toNumber(m[4])
      });
    });
    return lignes;
  }

  // --- Extraire totaux des tables pour compléter HT/TTC
  extractTotalsFromTables(analyzeResult: any) {
    const arr: string[] = [];
    analyzeResult.tables?.forEach((t: any) => {
      t.cells.forEach((c: any) => arr.push(c.content));
    });
    return arr.join(' ');
  }

  // --- Recherche de montant dans le texte
  // Améliorer la méthode findAmountAnywhere :
  findAmountAnywhere(text: string, keywords: string[]): number | null {
    const normalized = this.normalizeText(text);

    for (const keyword of keywords) {
      // Regex plus précise pour capturer les montants après le mot-clé
      const patterns = [
        new RegExp(`${keyword}[\\s:]*([0-9]+[\\s.,][0-9]+)`, 'i'),
        new RegExp(`${keyword}[\\s:]*([0-9]+)`, 'i'),
        new RegExp(`([0-9]+[\\s.,][0-9]+)[\\s]*${keyword}`, 'i')
      ];

      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match) {
          return this.toNumber(match[1]);
        }
      }
    }
    return null;
  }

  // --- Regex helper
  regex(text: string, reg: RegExp, group: number = 1): string {
    const m = text.match(reg);
    return m ? m[group].trim() : '';
  }

  // --- Conversion en nombre
  toNumber(value: any): number {
    if (!value) return 0;
    const str = value.toString()
      .replace(/\s/g, '')           // supprime espaces
      .replace(/[^\d,.-]/g, '')     // garde chiffres et séparateurs
      .replace(/,/g, '.');           // remplace , par .

    // Gestion des milliers (ex: 1 820,000 -> 1820.000)
    const parts = str.split('.');
    if (parts.length > 2) {
      // Si plusieurs points, c'est probablement un séparateur de milliers
      return Number(parts.join(''));
    }
    return Number(str) || 0;
  }

  // --- Normalisation du texte
  normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/€/g, 'EUR')
      .toLowerCase()
      .trim();
  }


  downloadJson() {
    if (!this.extractedData) return;

    const dataStr = JSON.stringify(this.extractedData, null, 2);
    const blob = new Blob([dataStr], { type: 'text/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `facture_${this.extractedData.facture?.meta?.numero || 'export'}.json`;
    a.click();

    window.URL.revokeObjectURL(url);
  }

}

