import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { createApp } from '../server.js';

/**
 * Helper to make an HTTP request and return { statusCode, body, headers }.
 */
function request(server, path, { method = 'GET', auth } = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const headers = {};
    if (auth) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${auth.user}:${auth.pass}`).toString('base64');
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('Phase D: Basic Auth Integration', () => {
  let server;

  before((_, done) => {
    const { app } = createApp({
      host: '127.0.0.1',
      port: 0, // random available port
      autoStart: false,
      authUsername: 'testuser',
      authPassword: 'testpass123'
    });
    server = app.listen(0, '127.0.0.1', done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('should return 401 for unauthenticated GET /api/projects', async () => {
    const res = await request(server, '/api/projects');
    assert.strictEqual(res.statusCode, 401);
  });

  it('should return 401 for wrong credentials on GET /api/projects', async () => {
    const res = await request(server, '/api/projects', {
      auth: { user: 'wrong', pass: 'wrong' }
    });
    assert.strictEqual(res.statusCode, 401);
  });

  it('should return 200 for authenticated GET /api/projects', async () => {
    const res = await request(server, '/api/projects', {
      auth: { user: 'testuser', pass: 'testpass123' }
    });
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.ok(Array.isArray(data), 'Response should be an array of projects');
  });

  it('should return 401 for unauthenticated POST /api/projects/test/start', async () => {
    const res = await request(server, '/api/projects/test/start', { method: 'POST' });
    assert.strictEqual(res.statusCode, 401);
  });

  it('should return 401 for unauthenticated POST /api/projects/test/stop', async () => {
    const res = await request(server, '/api/projects/test/stop', { method: 'POST' });
    assert.strictEqual(res.statusCode, 401);
  });
});

describe('Phase D: No-Auth Mode (loopback only)', () => {
  let server;

  before((_, done) => {
    const { app } = createApp({
      host: '127.0.0.1',
      port: 0,
      autoStart: false,
      authUsername: '',
      authPassword: ''
    });
    server = app.listen(0, '127.0.0.1', done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('should return 200 for GET /api/projects without auth on loopback', async () => {
    const res = await request(server, '/api/projects');
    assert.strictEqual(res.statusCode, 200);
  });
});
