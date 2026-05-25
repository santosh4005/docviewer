import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';

import { DocumentService } from '../services/document.service';
import { DocumentSummary } from '../models/document.model';

@Component({
  selector: 'app-document-index',
  standalone: true,
  imports: [RouterLink, MatCard, MatCardContent, MatProgressSpinner, MatIcon],
  templateUrl: './document-index.component.html',
  styleUrl: './document-index.component.scss',
})
export class DocumentIndexComponent implements OnInit {
  private docService = inject(DocumentService);

  documents: DocumentSummary[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.docService.listDocuments().subscribe({
      next: docs => {
        this.documents = docs;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load documents. Is the backend running?';
        this.loading = false;
      },
    });
  }
}
