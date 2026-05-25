import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DocumentDetail, DocumentSummary } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private http = inject(HttpClient);

  listDocuments(): Observable<DocumentSummary[]> {
    return this.http.get<DocumentSummary[]>('/api/documents');
  }

  getDocument(filename: string): Observable<DocumentDetail> {
    return this.http.get<DocumentDetail>(`/api/documents/${encodeURIComponent(filename)}`);
  }
}
