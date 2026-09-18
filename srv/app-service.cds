/**
 * N-Guard — Application Service (Phase 1)
 *
 * Minimal service providing:
 *  - /api/v1/app/ping  — connectivity test; no database required
 *  - /api/v1/app/info  — application metadata
 *
 * This service has NO database entities and NO business logic.
 * It exists solely to prove frontend-to-backend connectivity
 * and to carry application metadata.
 *
 * Business-capable services (NGuardService, AdminService) are
 * defined in nguard-service.cds and become active in Phase 2+
 * when a database adapter is configured.
 */

@path: '/api/v1/app'
@protocol: 'rest'
@impl: './dist/handlers/app-service.js'
service AppService {

  /** Connectivity test — always returns { pong: true } */
  function ping() returns { pong: Boolean; timestamp: String; };

  /** Application metadata — name, version, environment */
  function info() returns {
    name        : String;
    version     : String;
    environment : String;
    phase       : String;
  };

  /**
   * Health check — used by BTP load balancer and application router.
   * Returns status 'ok' and uptime in seconds when the service is healthy.
   */
  function health() returns {
    status    : String;
    timestamp : String;
    version   : String;
    uptime    : Decimal;
  };

  /**
   * Readiness probe — indicates application has completed startup.
   * Distinct from health (liveness probe).
   * Returns ready: true + a JSON-serialized checks object.
   */
  function ready() returns {
    ready  : Boolean;
    checks : LargeString;
  };

}
