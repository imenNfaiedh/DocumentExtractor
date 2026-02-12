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
    ht: ['total ht','ht','hors taxe','sous total','subtotal'],
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



  buildInvoiceJson(analyzeResult: any) {

    const text = analyzeResult.content || '';

    const facture: any = {
      meta: {},
      societe: {},
      client: {},
      totaux: {
        tva: []
      },
      lignes: []
    };


    // META
    facture.meta.numero =
      this.regex(text,
        /(num[eé]ro\s*(de)?\s*facture|invoice\s*no|facture\s*n[°º]?)\s*[:\-]?\s*([A-Z0-9\/\-]+)/i,
        3
      );

    facture.meta.date =
      this.regex(text,
        /(date\s*(de\s*facturation)?)\s*[:\-]?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})/i,
        3
      );

    facture.meta.devise =
      (text.match(/\b(TND|EUR|USD|MAD|DZD)\b/) || [])[0] || '';

    // SOCIETE
    facture.societe.nom =
      this.regex(text, /soci[eé]t[eé]\s*\n\s*(.+)/i);
    facture.societe.mf =
      this.regex(text, /mf\s*\n\s*(\S+)/i);

    // CLIENT
    facture.client.nom =
      this.regex(text, /client\s*:\s*\n\s*(.+)/i);

    // TOTAUX
    const fullText = this.normalizeText(text + " " + this.extractTotalsFromTables(analyzeResult));
    facture.totaux.ht = this.findAmountAnywhere(fullText, this.labels.ht.map(l => l.toLowerCase()));
    facture.totaux.ttc = this.findAmountAnywhere(fullText, this.labels.ttc.map(l => l.toLowerCase()));


    facture.totaux.timbre = this.toNumber(this.regex(text, /timbre\s*([\d\s,\.]+)/i));

    // TVA (multi taux)
    facture.totaux.tva = this.extractTVA(fullText);

    // LIGNES
    facture.lignes = this.extractLinesFromTables(analyzeResult);
    if (facture.lignes.length === 0) {
      facture.lignes = this.extractLinesFromText(fullText);
    }

    return { facture };
  }
  extractLinesFromTables(analyzeResult:any) {
    const lignes:any[]=[];

    analyzeResult.tables?.forEach((table:any)=>{
      const rows:any={};

      table.cells.forEach((c:any)=>{
        rows[c.rowIndex]=rows[c.rowIndex]||{};
        rows[c.rowIndex][c.columnIndex]=c.content;
      });

      const header=this.findHeaderRow(rows);
      if(!header) return;

      const cols=this.detectColumns(header);

      Object.values(rows).slice(1).forEach((row:any)=>{
        if(!row[cols.description]) return;
        lignes.push({
          description:row[cols.description],
          quantite:this.toNumber(row[cols.quantite]),
          prixUnitaire:this.toNumber(row[cols.prix]),
          total:this.toNumber(row[cols.total])
        });
      });
    });

    return lignes;
  }

  findHeaderRow(rows:any){
    return Object.values(rows).find((row:any)=>
      Object.values(row).some((cell:any)=>
        /desc|libell|designation|article|produit/i.test(cell)
      )
    );
  }


  regex(text: string, reg: RegExp, group: number = 1): string {
    const m = text.match(reg);
    return m ? m[group].trim() : '';
  }
  detectColumns(header:any){
    const map:any={};
    Object.keys(header).forEach(col=>{
      const h=header[col].toLowerCase();
      if(/desc|libell|designation|article|produit/.test(h)) map.description=col;
      if(/quant|qte|qty|nombre/.test(h)) map.quantite=col;
      if(/pu|prix.*unit|unit.*prix|price/.test(h)) map.prix=col;
      if(/total|montant|amount|ttc/.test(h)) map.total=col;
    });
    return map;
  }

  toNumber(value: any): number {
    if (!value) return 0;
    return Number(
      value.toString()
        .replace(/\s/g,'')          // supprime tous les espaces
        .replace(/[^\d,.-]/g, '')   // supprime tout sauf chiffres, points et virgules
        .replace(',', '.')
    );
  }
  findAmountAnywhere(text: string, keywords: string[]) {

    const tokens = text.split(' ');

    for (let i = 0; i < tokens.length; i++) {

      for (let word of keywords) {

        // --- cas 1 : mot collé au nombre
        const regInline = new RegExp(
          `${word}.{0,40}?([0-9][0-9\\s.,]+)`,
          'i'
        );
        const inline = text.match(regInline);
        if (inline) {
          const v = this.toNumber(inline[1]);
          if (v > 0) return v;
        }

        // --- cas 2 : mot seul → nombre dans les 6 tokens suivants
        if (tokens[i].includes(word)) {
          for (let j = i + 1; j <= i + 6 && j < tokens.length; j++) {
            const num = this.toNumber(tokens[j]);
            if (num > 0) return num;
          }
        }

        // --- cas 3 : nombre avant mot
        const regReverse = new RegExp(
          `([0-9][0-9\\s.,]+).{0,20}?${word}`,
          'i'
        );
        const rev = text.match(regReverse);
        if (rev) {
          const v = this.toNumber(rev[1]);
          if (v > 0) return v;
        }
      }
    }
    return null;
  }

  extractTVA(text:string){
    const res:any[]=[];
    const matches=[...text.matchAll(/(\d{1,2})\s*%[^0-9]{0,10}([\d\s,.]+)/g)];
    matches.forEach(m=>{
      res.push({ taux:+m[1], montant:this.toNumber(m[2]) });
    });
    return res;
  }
  extractTotalsFromTables(analyzeResult:any){
    const arr:string[]=[];
    analyzeResult.tables?.forEach((t:any)=>{
      t.cells.forEach((c:any)=>{
        // si la cellule contient 'ttc' ou 'ht', ajoute le contenu de la cellule voisine
        arr.push(c.content);
      });
    });
    return arr.join(' ');
  }
  normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')        // remplace toutes les lignes et espaces multiples par un espace
      .replace(/\u00A0/g, ' ')     // remplace les espaces insécables
      .toLowerCase();              // tout en minuscules
  }

  extractLinesFromText(text:string){
    const lignes:any[]=[];
    const matches=[...text.matchAll(/(.+?)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)/g)];
    matches.forEach(m=>{
      lignes.push({
        description:m[1],
        quantite:this.toNumber(m[2]),
        prixUnitaire:this.toNumber(m[3]),
        total:this.toNumber(m[4])
      });
    });
    return lignes;
  }





}


