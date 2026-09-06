import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import http from 'node:http';
import {
  createSameOriginProxyServer,
  startSameOriginProxy,
  assertTestEnvironmentOnly,
  RunningProxy,
} from './same_origin_proxy';

describe('FRLL Test-Only Same-Origin Proxy', () => {
  let backendServer: http.Server;
  let frontendServer: http.Server;
  let proxy: RunningProxy;
  let backendPort: number;
  let frontendPort: number;

  beforeAll(async () => {
    // Spin up mock backend server
    backendServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ target: 'backend', path: req.url, method: req.method }));
    });
    await new Promise<void>((resolve) => backendServer.listen(0, '127.0.0.1', () => resolve()));
    backendPort = (backendServer.address() as { port: number }).port;

    // Spin up mock frontend server
    frontendServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ target: 'frontend', path: req.url, method: req.method }));
    });
    await new Promise<void>((resolve) => frontendServer.listen(0, '127.0.0.1', () => resolve()));
    frontendPort = (frontendServer.address() as { port: number }).port;

    // Start proxy on dynamic port
    proxy = await startSameOriginProxy({
      port: 0,
      backendUrl: `http://127.0.0.1:${backendPort}`,
      frontendUrl: `http://127.0.0.1:${frontendPort}`,
    });
  });

  afterAll(async () => {
    await proxy?.close();
    await new Promise<void>((resolve) => backendServer.close(() => resolve()));
    await new Promise<void>((resolve) => frontendServer.close(() => resolve()));
  });

  it('proves proxy cannot be initialized under production environment', () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => assertTestEnvironmentOnly()).toThrow(/production/i);
      expect(() => createSameOriginProxyServer()).toThrow(/production/i);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('routes /api/* requests to the backend server with /api prefix stripped', async () => {
    const res = await fetch(`http://127.0.0.1:${proxy.port}/api/v1/me`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { target: string; path: string };
    expect(body.target).toBe('backend');
    expect(body.path).toBe('/v1/me');
  });

  it('preserves query parameters accurately when forwarding /api requests to backend', async () => {
    const res = await fetch(
      `http://127.0.0.1:${proxy.port}/api/v1/today?languageProfileId=123&date=2026-09-06`
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { target: string; path: string };
    expect(body.target).toBe('backend');
    expect(body.path).toBe('/v1/today?languageProfileId=123&date=2026-09-06');
  });

  it('routes root /api and /api/ to backend root /', async () => {
    const res1 = await fetch(`http://127.0.0.1:${proxy.port}/api`);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { target: string; path: string };
    expect(body1.target).toBe('backend');
    expect(body1.path).toBe('/');

    const res2 = await fetch(`http://127.0.0.1:${proxy.port}/api/`);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { target: string; path: string };
    expect(body2.target).toBe('backend');
    expect(body2.path).toBe('/');
  });

  it('routes non-api requests to the frontend server with path preserved', async () => {
    const res = await fetch(`http://127.0.0.1:${proxy.port}/today`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { target: string; path: string };
    expect(body.target).toBe('frontend');
    expect(body.path).toBe('/today');
  });
});
