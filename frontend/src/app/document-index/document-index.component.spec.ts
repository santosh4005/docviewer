import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';

import { DocumentIndexComponent } from './document-index.component';
import { DocumentService } from '../services/document.service';

function makeService(docs: object[] = [], fail = false) {
  return {
    listDocuments: () =>
      fail ? throwError(() => ({ status: 500 })) : of(docs),
  } as unknown as DocumentService;
}

describe('DocumentIndexComponent', () => {
  async function setup(docs: object[] = [], fail = false) {
    const service = makeService(docs, fail);
    await TestBed.configureTestingModule({
      imports: [DocumentIndexComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: DocumentService, useValue: service },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<DocumentIndexComponent> =
      TestBed.createComponent(DocumentIndexComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows document cards when documents are returned', async () => {
    const fixture = await setup([
      { filename: 'A.docx', display_name: 'A' },
      { filename: 'B.docx', display_name: 'B' },
    ]);
    const cards = fixture.nativeElement.querySelectorAll('mat-card');
    expect(cards.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('A');
    expect(fixture.nativeElement.textContent).toContain('B');
  });

  it('shows empty state when no documents are returned', async () => {
    const fixture = await setup([]);
    expect(fixture.nativeElement.textContent).toContain('No documents found');
  });

  it('shows error message on failure', async () => {
    const fixture = await setup([], true);
    expect(fixture.nativeElement.textContent).toContain('Failed to load');
  });
});
