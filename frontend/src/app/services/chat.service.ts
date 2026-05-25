import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatResponse } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);

  ask(filename: string, question: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>('/api/chat', { filename, question });
  }
}
