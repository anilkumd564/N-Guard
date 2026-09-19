/**
 * N-Guard — OpenAIProvider
 *
 * Implements AIProvider using the OpenAI REST API.
 * Works with:
 *  - OpenAI directly (api.openai.com)
 *  - Azure OpenAI
 *  - Any OpenAI-compatible endpoint (Ollama, LM Studio, local models, etc.)
 *
 * Configuration (set in .env):
 *
 *   AI_PROVIDER=openai
 *
 *   # Required
 *   OPENAI_API_KEY=sk-...your-key...
 *
 *   # Optional — defaults to OpenAI public API
 *   OPENAI_BASE_URL=https://api.openai.com/v1
 *
 *   # Optional — model names
 *   OPENAI_MODEL=gpt-4o
 *   OPENAI_EMBEDDING_MODEL=text-embedding-3-small
 *
 * For Azure OpenAI:
 *   OPENAI_BASE_URL=https://<your-resource>.openai.azure.com/openai/deployments/<deployment>
 *   OPENAI_API_KEY=<your-azure-key>
 *   OPENAI_API_VERSION=2024-02-01   (Azure requires api-version query param)
 *
 * For Ollama (local):
 *   OPENAI_BASE_URL=http://localhost:11434/v1
 *   OPENAI_API_KEY=ollama           (any non-empty string)
 *   OPENAI_MODEL=llama3.2
 */

import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
} from './AIProvider.js';

export class OpenAIProvider implements AIProvider {
  readonly providerName = 'openai';
  get modelName(): string { return this.model; }

  private readonly apiKey    : string;
  private readonly baseUrl   : string;
  private readonly model     : string;
  private readonly embedModel: string;
  private readonly apiVersion: string | undefined;

  constructor(config?: {
    apiKey?       : string;
    baseUrl?      : string;
    model?        : string;
    embedModel?   : string;
    apiVersion?   : string;
  }) {
    this.apiKey     = config?.apiKey     ?? process.env['OPENAI_API_KEY']         ?? '';
    this.baseUrl    = (config?.baseUrl   ?? process.env['OPENAI_BASE_URL']        ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model      = config?.model      ?? process.env['OPENAI_MODEL']           ?? 'gpt-4o';
    this.embedModel = config?.embedModel ?? process.env['OPENAI_EMBEDDING_MODEL'] ?? 'text-embedding-3-small';
    this.apiVersion = config?.apiVersion ?? process.env['OPENAI_API_VERSION'];

    if (!this.apiKey) {
      throw new Error(
        'OpenAIProvider: OPENAI_API_KEY is not set.\n' +
        'Add it to your .env file:\n  OPENAI_API_KEY=sk-...\n' +
        'Also set AI_PROVIDER=openai'
      );
    }
  }

  // ─── Completion ─────────────────────────────────────────────────────────────

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const url = this._url('/chat/completions');

    const body: Record<string, unknown> = {
      model       : this.model,
      messages    : request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature : request.temperature ?? 0.2,
      max_tokens  : request.maxTokens   ?? 4096,
    };

    if (request.responseFormat === 'json') {
      body['response_format'] = { type: 'json_object' };
    }

    const res = await this._post(url, body);

    const choice  = (res['choices'] as Array<{ message: { content: string } }>)[0];
    const content = choice?.message?.content ?? '';
    const usage   = res['usage'] as { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

    return {
      content,
      model : (res['model'] as string | undefined) ?? this.model,
      usage : {
        promptTokens     : usage?.prompt_tokens     ?? 0,
        completionTokens : usage?.completion_tokens ?? 0,
        totalTokens      : usage?.total_tokens      ?? 0,
      },
    };
  }

  // ─── Embedding ──────────────────────────────────────────────────────────────

  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    const url = this._url('/embeddings');

    const body = {
      model : this.embedModel,
      input : request.texts,
    };

    const res  = await this._post(url, body);
    const data = res['data'] as Array<{ embedding: number[] }>;

    return {
      embeddings : data.map(d => d.embedding),
      model      : (res['model'] as string | undefined) ?? this.embedModel,
    };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _url(path: string): string {
    const base = `${this.baseUrl}${path}`;
    return this.apiVersion ? `${base}?api-version=${this.apiVersion}` : base;
  }

  private async _post(url: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(url, {
      method  : 'POST',
      headers : {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<Record<string, unknown>>;
  }
}
