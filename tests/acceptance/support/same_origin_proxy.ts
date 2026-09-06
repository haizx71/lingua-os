/**
 * Test-only same-origin reverse proxy for First Real Learning Loop acceptance testing.
 * Bridges browser origin to Next.js (port 3000) and FastAPI (port 8000) via /api prefix.
 * Strictly forbidden from being used in production environments.
 */

import http from 'node:http';
import { URL } from 'node:url';

export interface ProxyOptions {
  readonly port?: number;
  readonly frontendUrl?: string;
  readonly backendUrl?: string;
}

export interface RunningProxy {
  readonly server: http.Server;
  readonly port: number;
  readonly close: () => Promise<void>;
}

export function assertTestEnvironmentOnly(): void {
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
    throw new Error(
      'CRITICAL: Same-origin acceptance proxy must NEVER be executed in production environments.'
    );
  }
}

export function createSameOriginProxyServer(options: ProxyOptions = {}): http.Server {
  assertTestEnvironmentOnly();

  const frontendTarget = new URL(options.frontendUrl ?? 'http://127.0.0.1:3000');
  const backendTarget = new URL(options.backendUrl ?? 'http://127.0.0.1:8000');

  const server = http.createServer((req, res) => {
    const rawUrl = req.url ?? '/';
    const isApiRequest = rawUrl.startsWith('/api/') || rawUrl === '/api';

    const target = isApiRequest ? backendTarget : frontendTarget;
    // Strip leading '/api' prefix when forwarding to FastAPI backend
    const targetPath = isApiRequest ? (rawUrl === '/api' ? '/' : rawUrl.slice(4)) : rawUrl;

    const proxyHeaders = { ...req.headers };
    // Host header must match target
    proxyHeaders.host = target.host;
    // Add forwarded tracking headers
    proxyHeaders['x-forwarded-host'] = req.headers.host;
    proxyHeaders['x-forwarded-proto'] = 'http';

    const proxyReq = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method: req.method,
        path: targetPath,
        headers: proxyHeaders,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: {
              code: 'BAD_GATEWAY',
              message: `Proxy target unreachable: ${err.message}`,
            },
          })
        );
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  return server;
}

export async function startSameOriginProxy(options: ProxyOptions = {}): Promise<RunningProxy> {
  const server = createSameOriginProxyServer(options);
  const targetPort = options.port ?? 3005;

  await new Promise<void>((resolve, reject) => {
    server.listen(targetPort, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : targetPort;

  return {
    server,
    port: actualPort,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
