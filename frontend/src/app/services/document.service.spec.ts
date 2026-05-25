import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DocumentService } from './document.service';
import { DocumentDetail, DocumentSummary } from '../models/document.model';

describe('DocumentService', () => {
  let service: DocumentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DocumentService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocumentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listDocuments() sends GET /api/documents and maps the response', () => {
    const mock: DocumentSummary[] = [
      { filename: 'Report.docx', display_name: 'Report' },
    ];

    let result: DocumentSummary[] | undefined;
    service.listDocuments().subscribe(docs => (result = docs));

    const req = httpMock.expectOne('/api/documents');
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    expect(result).toEqual(mock);
  });

  it('listDocuments() returns empty array when backend returns []', () => {
    let result: DocumentSummary[] | undefined;
    service.listDocuments().subscribe(docs => (result = docs));

    httpMock.expectOne('/api/documents').flush([]);
    expect(result).toEqual([]);
  });

  it('getDocument() URL-encodes filenames with spaces', () => {
    const mock: DocumentDetail = {
      filename: 'My Doc.docx',
      display_name: 'My Doc',
      html: '<p>content</p>',
    };

    let result: DocumentDetail | undefined;
    service.getDocument('My Doc.docx').subscribe(d => (result = d));

    const req = httpMock.expectOne('/api/documents/My%20Doc.docx');
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    expect(result?.html).toBe('<p>content</p>');
  });

  it('getDocument() propagates 404 errors', () => {
    let error: { status: number } | undefined;
    service.getDocument('missing.docx').subscribe({
      error: err => (error = err),
    });

    httpMock.expectOne('/api/documents/missing.docx').flush(
      { detail: 'not found' },
      { status: 404, statusText: 'Not Found' },
    );
    expect(error?.status).toBe(404);
  });
});
