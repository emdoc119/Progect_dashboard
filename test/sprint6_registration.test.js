import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createApp } from '../server.js';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMockReqRes(method, url, body = {}, params = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.path = url.split('?')[0];
  req.headers = { 'content-type': 'application/json' };
  req.body = body;
  req.params = params;

  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.body = null;

  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.getHeader = (k) => res.headers[k.toLowerCase()];
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => {
    res.body = data;
    res.emit('finish');
    return res;
  };
  res.send = (data) => {
    res.body = data;
    res.emit('finish');
    return res;
  };
  res.end = () => {
    res.emit('finish');
  };

  return { req, res };
}

describe('Sprint 6: New Project Registration & Quick Links', () => {
  let tmpDir;
  let tmpRegistryPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-test-'));
    tmpRegistryPath = path.join(tmpDir, 'projects.json');
    fs.writeFileSync(tmpRegistryPath, JSON.stringify({
      projects: [
        {
          name: 'existing_app',
          category: 'trading',
          type: 'python-streamlit',
          local_path: tmpDir,
          run_command: 'streamlit run app.py --server.address {host} --server.port {port}',
          always_on: false,
          exposure: 'loopback',
          status: 'stopped'
        }
      ]
    }, null, 2));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should register a new dynamic project and update projects.json', async () => {
    const { app } = createApp({
      host: '127.0.0.1',
      registryPath: tmpRegistryPath,
      autoStart: false,
      authUsername: null,
      authPassword: null
    });

    const { req, res } = createMockReqRes('POST', '/api/projects', {
      name: 'new_test_project',
      category: 'research',
      type: 'node-nextjs',
      local_path: tmpDir,
      run_command: 'npm run dev -- -H {host} -p {port}',
      always_on: true,
      exposure: 'loopback',
      notes: 'Test notes',
      quick_links: [{ label: 'Docs', url: 'https://example.com/docs' }]
    });

    const done = new Promise(resolve => res.on('finish', resolve));
    app(req, res);
    await done;

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.project.name, 'new_test_project');
    assert.strictEqual(res.body.project.always_on, true);

    const savedFile = JSON.parse(fs.readFileSync(tmpRegistryPath, 'utf8'));
    assert.strictEqual(savedFile.projects.length, 2);
    assert.strictEqual(savedFile.projects[1].name, 'new_test_project');
  });

  it('should reject duplicate project name', async () => {
    const { app } = createApp({
      host: '127.0.0.1',
      registryPath: tmpRegistryPath,
      autoStart: false,
      authUsername: null,
      authPassword: null
    });

    const { req, res } = createMockReqRes('POST', '/api/projects', {
      name: 'existing_app',
      type: 'python-streamlit',
      run_command: 'streamlit run main.py --server.address {host}'
    });

    const done = new Promise(resolve => res.on('finish', resolve));
    app(req, res);
    await done;

    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.error.includes('already exists'));
  });

  it('should add a quick link to an existing project', async () => {
    const { app } = createApp({
      host: '127.0.0.1',
      registryPath: tmpRegistryPath,
      autoStart: false,
      authUsername: null,
      authPassword: null
    });

    const { req, res } = createMockReqRes('POST', '/api/projects/existing_app/quick-links', {
      label: 'GitHub',
      url: 'https://github.com/test/repo'
    });

    const done = new Promise(resolve => res.on('finish', resolve));
    app(req, res);
    await done;

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.quick_links.length, 1);
    assert.strictEqual(res.body.quick_links[0].label, 'GitHub');

    const savedFile = JSON.parse(fs.readFileSync(tmpRegistryPath, 'utf8'));
    assert.strictEqual(savedFile.projects[0].quick_links[0].label, 'GitHub');
  });
});
