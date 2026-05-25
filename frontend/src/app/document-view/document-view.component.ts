import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { DocumentService } from '../services/document.service';
import { DocumentChatComponent } from '../document-chat/document-chat.component';

@Component({
  selector: 'app-document-view',
  standalone: true,
  imports: [RouterLink, MatProgressSpinner, MatButton, MatIconButton, MatIcon, DocumentChatComponent],
  templateUrl: './document-view.component.html',
  styleUrl: './document-view.component.scss',
})
export class DocumentViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private docService = inject(DocumentService);
  private sanitizer = inject(DomSanitizer);

  filename = '';
  displayName = '';
  safeHtml: SafeHtml | null = null;
  loading = true;
  error = '';
  chatOpen = false;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.filename = params.get('filename') ?? '';
      this.displayName = this.filename.replace(/\.docx$/i, '');
      this.loading = true;
      this.error = '';
      this.safeHtml = null;
      this.chatOpen = false;

      this.docService.getDocument(this.filename).subscribe({
        next: doc => {
          this.displayName = doc.display_name;
          this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(doc.html);
          this.loading = false;
        },
        error: err => {
          this.error = err.status === 404 ? 'Document not found.' : 'Failed to load document.';
          this.loading = false;
        },
      });
    });
  }

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;
  }
}
