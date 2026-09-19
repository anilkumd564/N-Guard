/**
 * N-Guard — SapAICoreProvider
 *
 * Implements AIProvider using SAP AI Core / Generative AI Hub.
 * Authenticates via OAuth2 client credentials, caches the token,
 * and calls the SAP AI Core harmonized inference API.
 *
 * Configuration (set in .env):
 *
 *   AI_PROVIDER=aicore
 *
 *   # OAuth2 credentials (from AI Core service key)
 *   AICORE_CLIENT_ID=sb-xxx!byyy|aicore!bzzz
 *   AICORE_CLIENT_SECRET=your-secret
 *   AICORE_AUTH_URL=https://<subaccount>.authentication.<region>.hana.ondemand.com/oauth/token
 *
 *   # AI Core API base URL (from service key)
 *   AICORE_BASE_URL=https://api.ai.prod.us-east-1.aws.ml.hana.ondemand.com/v2
 *
 *   # Resource group (default: "default")
 *   AICORE_RESOURCE_GROUP=default
 *
 *   # Model / deployment (choose one approach):
 *   # Option A — specify deployment ID directly (fastest)
 *   AICORE_DEPLOYMENT_ID=d1234abcd
 *
 *   # Option B — specify model name; provider discovers deployment automatically
 *   AICORE_MODEL_NAME=gpt-4o
 *   AICORE_EMBEDDING_MODEL=text-embedding-ada-002
 */

import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
} from './AIProvider.js';

interface TokenCache {
  accessToken : string;
  expiresAt   : number; // epoch ms
}

export class SapAICoreProvider implements AIProvider {
  readonly providerName = 'aicore';
  get modelName(): string { return this._modelName; }

  private readonly clientId      : string;
  private readonly clientSecret  : string;
  private readonly authUrl       : string;
  private readonly baseUrl       : string;
  private readonly resourceGroup : string;
  private readonly _modelName    : string;
  private readonly embedModel    : string;
  private readonly deploymentId? : string;

  private _token: TokenCache | null = null;
  // Discovered deployment IDs cached after first lookup
  private _deployId: string | null = null;
  private _embedDeployId: string | null = null;

  constructor(config?: {
    clientId?      : string;
    clientSecret?  : string;
    authUrl?       : string;
    baseUrl?       : string;
    resourceGroup? : string;
    modelName?     : string;
    embedModel?    : string;
    deploymentId?  : string;
  }) {
    this.clientId      = config?.clientId      ?? process.env['AICORE_CLIENT_ID']      ?? '';
    this.clientSecret  = config?.clientSecret  ?? process.env['AICORE_CLIENT_SECRET']  ?? '';
    this.authUrl       = config?.authUrl        ?? process.env['AICORE_AUTH_URL']       ?? '';
    this.baseUrl       = (config?.baseUrl       ?? process.env['AICORE_BASE_URL']       ?? '').replace(/\/$/, '');
    this.resourceGroup = config?.resourceGroup  ?? process.env['AICORE_RESOURCE_GROUP'] ?? 'default';
    this._modelName    = config?.modelName      ?? process.env['AICORE_MODEL_NAME']     ?? 'gpt-4o';
    this.embedModel    = config?.embedModel     ?? process.env['AICORE_EMBEDDING_MODEL']?? 'text-embedding-3-small';
    this.deploymentId  = config?.deploymentId   ?? process.env['AICORE_DEPLOYMENT_ID'];

    if (!this.clientId || !this.clientSecret || !this.authUrl || !this.baseUrl) {
      throw new Error(
        'SapAICoreProvider: missing required config.\n' +
        'Set in .env: AICORE_CLIENT_ID, AICORE_CLIENT_SECRET, AICORE_AUTH_URL, AICORE_BASE_URL\n' +
        'Also set: AI_PROVIDER=aicore'
      );
    }
  }

  // ─── Completion ─────────────────────────────────────────────────────────────

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const token    = await this._getToken();
    const deployId = await this._getDeploymentId(token, this._modelName, false);
    const url      = `${this.baseUrl}/inference/deployments/${deployId}/chat/completions`;

    const body: Record<string, unknown> = {
      model       : this._modelName,
      messages    : request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature : request.temperature ?? 0.2,
      max_tokens  : request.maxTokens   ?? 4096,
    };

    if (request.responseFormat === 'json') {
      body['response_format'] = { type: 'json_object' };
    }

    const res = await this._post(url, token, body);

    const choice  = (res['choices'] as Array<{ message: { content: string } }>)[0];
    const content = choice?.message?.content ?? '';
    const usage   = res['usage'] as { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

    return {
      content,
      model : (res['model'] as string | undefined) ?? this._modelName,
      usage : {
        promptTokens     : usage?.prompt_tokens     ?? 0,
        completionTokens : usage?.completion_tokens ?? 0,
        totalTokens      : usage?.total_tokens      ?? 0,
      },
    };
  }

  // ─── Embedding ──────────────────────────────────────────────────────────────

  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    const token    = await this._getToken();
    const deployId = await this._getDeploymentId(token, this.embedModel, true);
    const url      = `${this.baseUrl}/inference/deployments/${deployId}/embeddings`;

    const body = {
      model : this.embedModel,
      input : request.texts,
    };

    const res  = await this._post(url, token, body);
    const data = res['data'] as Array<{ embedding: number[] }>;

    return {
      embeddings : data.map(d => d.embedding),
      model      : (res['model'] as string | undefined) ?? this.embedModel,
    };
  }

  // ─── Token management ────────────────────────────────────────────────────────

  private async _getToken(): Promise<string> {
    const now = Date.now();
    if (this._token && this._token.expiresAt > now + 60_000) {
      return this._token.accessToken;
    }

    const body = new URLSearchParams({
      grant_type    : 'client_credentials',
      client_id     : this.clientId,
      client_secret : this.clientSecret,
    });

    const res = await fetch(this.authUrl, {
      method  : 'POST',
      headers : { 'Content-Type': 'application/x-www-form-urlencoded' },
      body    : body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SAP AI Core OAuth2 error ${res.status}: ${text}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    this._token = {
      accessToken : data.access_token,
      expiresAt   : now + (data.expires_in * 1000),
    };
    return this._token.accessToken;
  }

  // ─── Deployment discovery ────────────────────────────────────────────────────

  private async _getDeploymentId(token: string, modelName: string, isEmbed: boolean): Promise<string> {
    // Use explicit deployment ID if provided
    if (this.deploymentId) return this.deploymentId;

    // Use cached deployment ID
    const cached = isEmbed ? this._embedDeployId : this._deployId;
    if (cached) return cached;

    // Discover from deployments list
    const url = `${this.baseUrl}/lm/deployments`;
    const res = await fetch(url, {
      headers: {
        'Authorization'    : `Bearer ${token}`,
        'AI-Resource-Group': this.resourceGroup,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SAP AI Core deployments list error ${res.status}: ${text}`);
    }

    const data = await res.json() as { resources: Array<{ id: string; details?: { resources?: { backend_details?: { model?: { name?: string } } } }; status?: string; configurationName?: string }> };
    const deployments = data.resources ?? [];

    // Find a RUNNING deployment matching the model name
    const match = deployments.find(d => {
      if (d.status !== 'RUNNING') return false;
      const modelId = d.details?.resources?.backend_details?.model?.name ?? d.configurationName ?? '';
      return modelId.toLowerCase().includes(modelName.toLowerCase()) ||
             modelName.toLowerCase().includes(modelId.toLowerCase());
    });

    if (!match) {
      // Fall back to first RUNNING deployment
      const first = deployments.find(d => d.status === 'RUNNING');
      if (!first) {
        throw new Error(
          `SAP AI Core: No RUNNING deployment found for model "${modelName}".\n` +
          `Available: ${deployments.map(d => `${d.id}(${d.status})`).join(', ')}\n` +
          `Set AICORE_DEPLOYMENT_ID=<id> in .env to bypass auto-discovery.`
        );
      }
      const id = first.id;
      if (isEmbed) this._embedDeployId = id; else this._deployId = id;
      return id;
    }

    if (isEmbed) this._embedDeployId = match.id; else this._deployId = match.id;
    return match.id;
  }

  // ─── HTTP helper ─────────────────────────────────────────────────────────────

  private async _post(url: string, token: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(url, {
      method  : 'POST',
      headers : {
        'Content-Type'     : 'application/json',
        'Authorization'    : `Bearer ${token}`,
        'AI-Resource-Group': this.resourceGroup,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SAP AI Core API error ${res.status} at ${url}: ${text}`);
    }

    return res.json() as Promise<Record<string, unknown>>;
  }
}
