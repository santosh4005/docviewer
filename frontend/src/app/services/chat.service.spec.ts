import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ChatService } from './chat.service';
import { ChatResponse } from '../models/document.model';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('ask() sends POST /api/chat with correct body', () => {
    const mock: ChatResponse = { answer: 'The answer is 42.' };

    let result: ChatResponse | undefined;
    service.ask('Report.docx', 'What is the answer?').subscribe(r => (result = r));

    const req = httpMock.expectOne('/api/chat');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      filename: 'Report.docx',
      question: 'What is the answer?',
    });
    req.flush(mock);
    expect(result?.answer).toBe('The answer is 42.');
  });

  it('ask() propagates 503 errors', () => {
    let error: { status: number } | undefined;
    service.ask('Report.docx', 'anything').subscribe({ error: err => (error = err) });

    httpMock.expectOne('/api/chat').flush(
      { detail: 'not configured' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    expect(error?.status).toBe(503);
  });
});
