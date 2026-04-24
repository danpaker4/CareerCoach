# CareerCoach Chat Flow Examples

## MongoDB conversation schema

```json
{
  "userId": "uuid",
  "achievements": [
    {
      "id": "uuid",
      "name": "Built scalable Node.js API",
      "grade": 88
    }
  ],
  "messages": [
    {
      "role": "assistant",
      "content": "Hi! I already know your achievements...",
      "timestamp": "2026-04-24T20:00:00.000Z"
    },
    {
      "role": "user",
      "content": "I prefer backend jobs with Node and Python.",
      "timestamp": "2026-04-24T20:00:30.000Z"
    }
  ],
  "createdAt": "2026-04-24T20:00:00.000Z",
  "updatedAt": "2026-04-24T20:00:30.000Z"
}
```

## Angular chat service example

```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ConversationResponse {
  userId: string;
  achievements: { id: string; name: string; grade: number }[];
  messages: ChatMessage[];
}

export interface SendMessageResponse {
  reply: string;
  jobs?: { jobId: string; jobTitle: string; url: string; seniority: string; description: string }[];
}

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly baseUrl = 'http://localhost:3002';

  constructor(private readonly http: HttpClient) {}

  getConversation(userId: string): Observable<ConversationResponse> {
    return this.http.get<ConversationResponse>(`${this.baseUrl}/chat/${userId}`);
  }

  sendMessage(userId: string, message: string): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>(`${this.baseUrl}/chat/message`, { userId, message });
  }
}
```

## Angular chat component example

```ts
import { Component, OnInit } from '@angular/core';
import { ChatApiService, ChatMessage } from './chat-api.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html'
})
export class ChatComponent implements OnInit {
  messages: ChatMessage[] = [];
  input = '';
  loading = false;
  error = '';
  readonly userId = 'your-authenticated-user-id';

  constructor(private readonly chatApi: ChatApiService) {}

  ngOnInit(): void {
    this.loading = true;
    this.chatApi.getConversation(this.userId).subscribe({
      next: (conversation) => {
        this.messages = conversation.messages;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed loading conversation';
        this.loading = false;
      }
    });
  }

  sendMessage(): void {
    if (!this.input.trim() || this.loading) {
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: this.input.trim(),
      timestamp: new Date().toISOString()
    };
    this.messages = [...this.messages, userMessage];
    const currentInput = this.input.trim();
    this.input = '';
    this.loading = true;
    this.error = '';

    this.chatApi.sendMessage(this.userId, currentInput).subscribe({
      next: (response) => {
        this.messages = [
          ...this.messages,
          { role: 'assistant', content: response.reply, timestamp: new Date().toISOString() }
        ];
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed sending message';
        this.loading = false;
      }
    });
  }
}
```

```html
<section *ngIf="loading && messages.length === 0">Loading chat...</section>
<section *ngIf="error">{{ error }}</section>
<section *ngIf="!loading && messages.length === 0">No messages yet.</section>

<div *ngFor="let message of messages">
  <strong>{{ message.role }}:</strong> {{ message.content }}
</div>

<textarea [(ngModel)]="input" placeholder="Type a message"></textarea>
<button (click)="sendMessage()" [disabled]="loading || !input.trim()">Send</button>
```

## Validation middleware example

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';

export const validateJobIdsMiddleware = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const responseBody = request.body as { reply?: string; jobs?: { jobId: string }[]; recommendedJobIds?: string[] } | null;
  const availableIds = new Set((responseBody?.jobs || []).map((job) => job.jobId));
  const requestedIds = responseBody?.recommendedJobIds || [];
  const hasInvalidId = requestedIds.some((jobId) => !availableIds.has(jobId));

  if (hasInvalidId) {
    reply.code(422).send({ error: 'Invalid jobId in LLM response' });
  }
};
```
