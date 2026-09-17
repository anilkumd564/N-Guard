/**
 * N-Guard — IntegrationProvider Abstraction
 *
 * Provides a typed boundary for all outbound integrations to external systems.
 * In production this is backed by SAP BTP Destination Service + Connectivity
 * Service. Locally it is backed by a mock or a direct HTTP adapter.
 *
 * Architecture rules:
 *  - Rule 13: Core application code must not import @sap/connectivity or any
 *             BTP library directly. All outbound calls go through this interface.
 *  - Rule 14: Integration calls must be stateless; no connection pools are
 *             cached across requests.
 *  - Rule 15: Do NOT invent integration capabilities. Only model what real
 *             SAP BTP / S/4HANA APIs actually provide.
 *
 * Supported integration targets (future phases):
 *  - SAP S/4HANA OData APIs (via BTP Destination Service)
 *  - SAP AI Core / Generative AI Hub (proxied through BTP destination)
 *  - SAP Document Management Service
 *  - Custom RFC / BAPI destinations via Cloud Connector
 *
 * Concrete implementations (future phases):
 *  - MockIntegrationProvider     (Phase 0 dev — returns hardcoded stubs)
 *  - BTPDestinationProvider      (Phase N — @sap/connectivity + destinations)
 *  - DirectHttpProvider          (Phase N — for local VM without BTP)
 */

// ─── Integration Target ───────────────────────────────────────────────────────

/**
 * Logical name of an integration target.
 * Maps to a BTP Destination name in production, or a local config entry in dev.
 */
export type IntegrationTarget = string;

// ─── HTTP Invocation ──────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface IntegrationRequest {
  /** Logical destination name. */
  target      : IntegrationTarget;

  /** HTTP method. */
  method      : HttpMethod;

  /** Path relative to the destination's base URL. */
  path        : string;

  /** Query parameters. */
  params?     : Record<string, string>;

  /** Request body (will be JSON-serialised). */
  body?       : unknown;

  /** Additional headers to merge with destination defaults. */
  headers?    : Record<string, string>;

  /** Request timeout in milliseconds. Default: 30 000. */
  timeoutMs?  : number;
}

export interface IntegrationResponse<T = unknown> {
  /** HTTP status code. */
  statusCode  : number;
  /** Parsed response body. */
  data        : T;
  /** Response headers. */
  headers     : Record<string, string>;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

/**
 * IntegrationProvider is the single gateway for all outbound HTTP calls.
 * Inject this interface; never use `fetch` or `axios` directly in domain code.
 */
export interface IntegrationProvider {
  /** Human-readable provider name, e.g. 'mock', 'btp-destination', 'direct-http'. */
  readonly providerName : string;

  /**
   * Invoke an outbound integration call.
   * The provider resolves the destination URL, attaches credentials, and handles
   * retries according to its configuration.
   */
  invoke<T = unknown>(request: IntegrationRequest): Promise<IntegrationResponse<T>>;

  /**
   * Check whether a named destination is reachable.
   * Useful for health checks and startup validation.
   */
  ping(target: IntegrationTarget): Promise<boolean>;
}
