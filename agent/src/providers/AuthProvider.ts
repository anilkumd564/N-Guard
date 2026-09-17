/**
 * N-Guard — AuthProvider Abstraction
 *
 * Decouples N-Guard's identity and authorisation logic from any specific
 * authentication framework (XSUAA on BTP, local mock, future OIDC).
 *
 * Architecture rules:
 *  - Rule 10: All security decisions must respect tenant_id and project_id.
 *  - Rule 13: Core application code must not import @sap/xssec or any BTP
 *             library directly; those are wired up via the AuthProvider adapter.
 *  - Rule 14: The resolved principal must be stateless / serialisable so it
 *             can be passed across stateless process boundaries.
 *
 * Concrete implementations (future phases):
 *  - MockAuthProvider   (Phase 0 dev — returns a hardcoded principal)
 *  - XsuaaAuthProvider  (Phase N — SAP BTP XSUAA / @sap/xssec)
 *  - OidcAuthProvider   (Phase N — generic OIDC for VM/on-prem deployments)
 */

// ─── Principal ────────────────────────────────────────────────────────────────

/**
 * A resolved, validated identity.
 * Carries the minimum claims that N-Guard needs for authorisation and auditing.
 */
export interface NGuardPrincipal {
  /** Subject identifier from the token (unique per user). */
  userId        : string;

  /** Human-readable display name. */
  displayName?  : string;

  /** Email address — may be absent if the IdP does not issue it. */
  email?        : string;

  /**
   * The tenant this user belongs to.
   * Mandatory — every request must be associated with a tenant (rule 10).
   */
  tenantId      : string;

  /**
   * Granted scopes / roles within N-Guard.
   * e.g. ['nguard.architect', 'nguard.reviewer', 'nguard.admin']
   */
  scopes        : string[];

  /** ISO 8601 token expiry time. */
  expiresAt?    : string;

  /** Raw claims map for provider-specific extensions. */
  claims?       : Record<string, unknown>;
}

// ─── Token Verification ───────────────────────────────────────────────────────

export interface TokenVerificationOptions {
  /** Raw bearer token string (without 'Bearer ' prefix). */
  token         : string;
  /** Expected audience, if the IdP enforces audience validation. */
  audience?     : string;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

/**
 * AuthProvider validates incoming tokens and resolves the caller's identity.
 * Inject this interface into middleware or use-case handlers.
 */
export interface AuthProvider {
  /** Human-readable provider name, e.g. 'mock', 'xsuaa', 'oidc'. */
  readonly providerName : string;

  /**
   * Verify a bearer token and return the resolved principal.
   * Throws an error if the token is invalid, expired, or untrusted.
   */
  verify(options: TokenVerificationOptions): Promise<NGuardPrincipal>;

  /**
   * Check whether the principal holds the required scope.
   * Returns true if authorised, false otherwise.
   */
  hasScope(principal: NGuardPrincipal, requiredScope: string): boolean;
}
