import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';

import { DocumentViewComponent } from './document-view.component';
import { DocumentService } from '../services/document.service';
import { ChatService } from '../services/chat.service';
import { DocumentDetail } from '../models/document.model';

const MOCK_DOC: DocumentDetail = {
  filename: 'Test.docx',
  display_name: 'Test',
  html: '<h1>Hello</h1><p>World</p>',
};

async function setup(
  doc: ReturnType<DocumentService['getDocument']>,
  filename = 'Test.docx',
) {
  const paramMap = of({ get: (_: string) => filename } as never);

  await TestBed.configureTestingModule({
    imports: [DocumentViewComponent],
    providers: [
      provideAnimations(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap } },
      { provide: DocumentService, useValue: { getDocument: () => doc } },
      { provide: ChatService, useValue: { ask: () => new Subject() } },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<DocumentViewComponent> =
    TestBed.createComponent(DocumentViewComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('DocumentViewComponent', () => {
  it('renders document HTML from the API', async () => {
    const fixture = await setup(of(MOCK_DOC));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.doc-content')?.innerHTML).toContain('<h1>Hello</h1>');
  });

  it('shows the display_name in the header', async () => {
    const fixture = await setup(of(MOCK_DOC));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.doc-title')?.textContent?.trim()).toBe('Test');
  });

  it('shows an error message on 404', async () => {
    const fixture = await setup(throwError(() => ({ status: 404 })));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Document not found');
  });

  it('shows a generic error message on other failures', async () => {
    const fixture = await setup(throwError(() => ({ status: 500 })));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Failed to load document');
  });

  it('has a Back to Documents link', async () => {
    const fixture = await setup(of(MOCK_DOC));
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector('.back-link');
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain('Back to Documents');
  });

  it('passes the correct filename to DocumentChatComponent', async () => {
    const fixture = await setup(of(MOCK_DOC));
    const chatEl = fixture.nativeElement.querySelector('app-document-chat');
    expect(chatEl).toBeTruthy();
    expect(fixture.componentInstance.filename).toBe('Test.docx');
  });
});
