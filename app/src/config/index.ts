/**
 * N-Guard Frontend — Global Configuration
 *
 * All configurable values are sourced from Vite environment variables
 * (import.meta.env) so they can be overridden at build time without
 * changing source code.
 *
 * Environment variables must be prefixed with VITE_ to be exposed
 * to the client bundle (Vite requirement).
 *
 * In development the Vite proxy (vite.config.ts) forwards /api → :4004
 * so VITE_API_BASE_URL defaults to '' (relative URL).
 */

export interface AppConfig {
  /** Base URL for all backend API calls. Empty string = use Vite proxy. */
  apiBaseUrl   : string;
  /** Application display name. */
  appName      : string;
  /** Application version from package.json (injected by Vite). */
  appVersion   : string;
  /** Current environment label. */
  environment  : string;
  /** Backend health-check endpoint. */
  healthUrl    : string;
  /** Backend connectivity-test endpoint. */
  pingUrl      : string;
}

const config: AppConfig = {
  apiBaseUrl  : import.meta.env.VITE_API_BASE_URL  ?? '',
  appName     : import.meta.env.VITE_APP_NAME      ?? 'N-Guard',
  appVersion  : import.meta.env.VITE_APP_VERSION   ?? '0.1.0',
  environment : import.meta.env.MODE               ?? 'development',
  healthUrl   : (import.meta.env.VITE_API_BASE_URL ?? '') + '/health',
  pingUrl     : (import.meta.env.VITE_API_BASE_URL ?? '') + '/api/v1/app/ping',
};

export default config;
