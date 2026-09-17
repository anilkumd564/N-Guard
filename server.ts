/**
 * N-Guard — Custom CAP Server Bootstrap
 *
 * This file is loaded by `cds-ts serve` / `cds-ts watch` as the application
 * entry point.  It hooks into the CAP bootstrap lifecycle to register
 * health and readiness endpoints before the CDS service layer starts.
 *
 * Architecture rules respected:
 *  - Health/readiness endpoints are Express-level (no database dependency)
 *  - No business logic lives here
 *  - Configuration is read from environment variables only (rule 11)
 */

import type { Application, Request, Response } from 'express';
import cds from '@sap/cds';

const SERVICE_NAME    = 'n-guard';
const SERVICE_VERSION = process.env.npm_package_version ?? '0.1.0';

// ─── Bootstrap hook ───────────────────────────────────────────────────────────

cds.on('bootstrap', (app: Application) => {

  /**
   * GET /health
   * Basic liveness probe — always returns 200 while the process is alive.
   * Does NOT check database connectivity (use /ready for that).
   */
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status    : 'UP',
      service   : SERVICE_NAME,
      version   : SERVICE_VERSION,
      timestamp : new Date().toISOString(),
    });
  });

  /**
   * GET /ready
   * Readiness probe — confirms the CDS service layer has initialised.
   * In production this would also check database connectivity.
   */
  app.get('/ready', (_req: Request, res: Response) => {
    const isServed = cds.services && Object.keys(cds.services).length > 0;
    res.status(200).json({
      status  : 'READY',
      service : SERVICE_NAME,
      served  : isServed,
    });
  });

});

// ─── Startup logging ──────────────────────────────────────────────────────────

cds.on('served', () => {
  const log = cds.log('n-guard');
  log.info(`N-Guard backend started — version ${SERVICE_VERSION}`);
  log.info(`Health:    http://localhost:${process.env.PORT ?? 4004}/health`);
  log.info(`Readiness: http://localhost:${process.env.PORT ?? 4004}/ready`);
});

// Re-export CDS server so that `cds-ts serve` picks up our hooks
export default cds.server;
