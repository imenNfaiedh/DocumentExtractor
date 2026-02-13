import { Component } from '@angular/core';
import {HttpClient, HttpClientModule, HttpHeaders} from "@angular/common/http";
import {JsonPipe, NgIf} from "@angular/common";
import {environment} from "../../../../environments/environment";

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



  constructor(private http: HttpClient) {}

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
    }, 5000);
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

    // --- META
    facture.meta.numero = this.regex(fullText, /(num[eé]ro\s*(de)?\s*facture|invoice\s*no|facture\s*n[°º]?)\s*[:\-]?\s*([A-Z0-9\/\-]+)/i, 3);
    facture.meta.date = this.regex(fullText, /(date\s*(de\s*facturation)?)\s*[:\-]?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})/i, 3);
    facture.meta.devise = (fullText.match(/\b(tnd|eur|usd|mad|dzd)\b/) || [])[0] || '';

    // --- SOCIETE
    facture.societe.nom = this.regex(fullText, /soci[eé]t[eé]\s*\n\s*(.+)/i);
    facture.societe.mf = this.regex(fullText, /mf\s*\n\s*(\S+)/i);

    // --- CLIENT
    facture.client.nom = this.regex(fullText, /client\s*[:\-]?\s*\n?\s*(.+)/i);

    // --- TOTAUX
    const totals = this.buildInvoiceTotals(fullText);
    facture.totaux.ht = totals.ht;
    facture.totaux.ttc = totals.ttc;
    facture.totaux.tva = totals.tva;

    // --- LIGNES
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
  findAmountAnywhere(text: string, keywords: string[]): number | null {
    const normalized = this.normalizeText(text);
    const tokens = normalized.split(' ');

    for (let i = 0; i < tokens.length; i++) {
      for (const word of keywords) {

        // 1) mot collé au nombre
        const regInline = new RegExp(`${word}.{0,40}?([0-9][0-9\\s.,]+)`, 'i');
        const inline = normalized.match(regInline);
        if (inline) return this.toNumber(inline[1]);

        // 2) mot seul → nombre dans les 6 tokens suivants
        if (tokens[i].includes(word)) {
          for (let j = i + 1; j <= i + 6 && j < tokens.length; j++) {
            const num = this.toNumber(tokens[j]);
            if (num > 0) return num;
          }
        }

        // 3) nombre avant mot
        const regReverse = new RegExp(`([0-9][0-9\\s.,]+).{0,20}?${word}`, 'i');
        const rev = normalized.match(regReverse);
        if (rev) return this.toNumber(rev[1]);
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
    return Number(
      value.toString()
        .replace(/\s/g, '')          // supprime espaces
        .replace(/[^\d,.-]/g, '')   // supprime tout sauf chiffres
        .replace(',', '.')
    );
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
}


