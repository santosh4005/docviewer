import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError, Subject } from 'rxjs';

import { DocumentChatComponent } from './document-chat.component';
import { ChatService } from '../services/chat.service';
import { ChatResponse } from '../models/document.model';

async function setup(service: Partial<ChatService>) {
  await TestBed.configureTestingModule({
    imports: [DocumentChatComponent],
    providers: [
      provideAnimationsAsync(),
      { provide: ChatService, useValue: service },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<DocumentChatComponent> =
    TestBed.createComponent(DocumentChatComponent);
  fixture.componentInstance.filename = 'Test.docx';
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('DocumentChatComponent', () => {
  it('shows placeholder when no messages', async () => {
    const fixture = await setup({ ask: () => new Subject() });
    expect(fixture.nativeElement.querySelector('.placeholder')).toBeTruthy();
  });

  it('appends user bubble and AI response (of() emits synchronously)', async () => {
    // of() emits synchronously so state is fully settled after send()
    const fixture = await setup({ ask: () => of({ answer: 'Because 42.' }) });
    const comp = fixture.componentInstance;

    comp.inputValue = 'Why?';
    comp.send();
    fixture.detectChanges();

    const msgs = fixture.nativeElement.querySelectorAll('.message');
    expect(msgs.length).toBe(2);
    expect(msgs[0].classList).toContain('user');
    expect(msgs[0].textContent.trim()).toBe('Why?');
    expect(msgs[1].classList).toContain('ai');
    expect(msgs[1].textContent.trim()).toBe('Because 42.');
  });

  it('sets isLoading=true while a request is in flight and false after', async () => {
    const subject = new Subject<ChatResponse>();
    const fixture = await setup({ ask: () => subject });
    const comp = fixture.componentInstance;

    comp.inputValue = 'Pending?';
    comp.send();

    expect(comp.isLoading).toBe(true);

    subject.next({ answer: 'Done.' });
    subject.complete();

    expect(comp.isLoading).toBe(false);
  });

  it('shows error bubble on failure', async () => {
    const fixture = await setup({
      ask: () => throwError(() => ({ status: 500 })),
    });
    const comp = fixture.componentInstance;

    comp.inputValue = 'Question?';
    comp.send();
    fixture.detectChanges();

    const errorMsg = fixture.nativeElement.querySelector('.error-msg');
    expect(errorMsg).toBeTruthy();
    expect(errorMsg.textContent).toContain('Sorry');
  });

  it('does not send on empty/whitespace input', async () => {
    const askSpy = vi.fn().mockReturnValue(new Subject());
    const fixture = await setup({ ask: askSpy });

    fixture.componentInstance.inputValue = '   ';
    fixture.componentInstance.send();

    expect(askSpy).not.toHaveBeenCalled();
  });

  it('shows specific message for 503 error', async () => {
    const fixture = await setup({
      ask: () => throwError(() => ({ status: 503 })),
    });
    const comp = fixture.componentInstance;

    comp.inputValue = 'Any question';
    comp.send();
    fixture.detectChanges();

    const errorMsg = fixture.nativeElement.querySelector('.error-msg');
    expect(errorMsg.textContent).toContain('not available');
  });
});
