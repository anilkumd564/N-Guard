/**
 * N-Guard — AppService Handler (Phase 1)
 *
 * Handles the minimal connectivity-test service.
 * No database access; no business logic.
 */

import cds from '@sap/cds';

export default class AppServiceHandler extends cds.ApplicationService {
  async init() {

    this.on('ping', () => ({
      pong      : true,
      timestamp : new Date().toISOString(),
    }));

    this.on('info', () => ({
      name        : 'n-guard',
      version     : process.env.npm_package_version ?? '0.1.0',
      environment : process.env.NODE_ENV ?? 'development',
      phase       : '16 — Release Readiness Report and Architecture Review',
    }));

    this.on('health', () => ({
      status    : 'ok',
      timestamp : new Date().toISOString(),
      version   : process.env.npm_package_version ?? '0.1.0',
      uptime    : process.uptime(),
    }));

    this.on('ready', () => ({
      ready  : true,
      checks : JSON.stringify({
        server : 'ok',
        env    : process.env.NODE_ENV ?? 'development',
      }),
    }));

    await super.init();
  }
}
