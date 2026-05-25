import { AfterViewChecked, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { ChatService } from '../services/chat.service';
import { ChatMessage } from '../models/document.model';

@Component({
  selector: 'app-document-chat',
  standalone: true,
  imports: [FormsModule, MatFormField, MatInput, MatIconButton, MatIcon],
  templateUrl: './document-chat.component.html',
  styleUrl: './document-chat.component.scss',
})
export class DocumentChatComponent implements AfterViewChecked, OnChanges, OnDestroy {
  @Input() filename = '';
  @ViewChild('messageList') messageList!: ElementRef<HTMLElement>;
  @ViewChild('chatInput', { read: ElementRef }) chatInput!: ElementRef<HTMLInputElement>;

  private chatService = inject(ChatService);

  messages: ChatMessage[] = [];
  inputValue = '';
  isLoading = false;
  private shouldScroll = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filename'] && !changes['filename'].firstChange) {
      this.messages = [];
      this.isLoading = false;
      this.inputValue = '';
    }
  }

  send(): void {
    const question = this.inputValue.trim();
    if (!question || this.isLoading) return;

    this.messages.push({ role: 'user', content: question });
    this.messages.push({ role: 'typing', content: '' });
    this.inputValue = '';
    this.isLoading = true;
    this.shouldScroll = true;

    this.chatService.ask(this.filename, question).subscribe({
      next: response => {
        this.replaceTyping({ role: 'assistant', content: response.answer });
        this.isLoading = false;
        this.shouldScroll = true;
        this.scheduleFocus();
      },
      error: err => {
        const text =
          err.status === 503
            ? 'AI chat is not available. Check OPENROUTER_API_KEY.'
            : "Sorry, I couldn't answer that. Please try again.";
        this.replaceTyping({ role: 'error', content: text });
        this.isLoading = false;
        this.shouldScroll = true;
        this.scheduleFocus();
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {}

  private scheduleFocus(): void {
    const el = this.chatInput?.nativeElement;
    if (el) {
      el.disabled = false;
      el.focus();
    }
  }

  private replaceTyping(msg: ChatMessage): void {
    let idx = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'typing') { idx = i; break; }
    }
    if (idx !== -1) {
      this.messages.splice(idx, 1, msg);
    } else {
      this.messages.push(msg);
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.messageList.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch { /* noop */ }
  }
}
