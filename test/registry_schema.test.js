import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createApp } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase E: Registry Schema Validation', () => {
  it('should accept all valid projects from the current registry', () => {
    const { projects, validationErrors } = createApp({
      host: '127.0.0.1',
      port: 0,
      autoStart: false,
      authUsername: '',
      authPassword: ''
    });

    assert.strictEqual(validationErrors.length, 0,
      `Expected no validation errors, got: ${validationErrors.join('; ')}`);
    assert.ok(projects.length > 0, 'Should have at least one valid project');
  });

  it('should reject a dynamic project without exposure field', () => {
    const tmpRegistry = path.join(os.tmpdir(), `test_registry_${Date.now()}.json`);
    fs.writeFileSync(tmpRegistry, JSON.stringify({
      projects: [{
        name: 'bad_project',
        type: 'python-fastapi',
        local_path: '/tmp/fake',
        run_command: 'python main.py --host {host} --port {port}',
        always_on: false
        // missing exposure
      }]
    }));

    try {
      const { projects, validationErrors } = createApp({
        host: '127.0.0.1',
        port: 0,
        autoStart: false,
        authUsername: '',
        authPassword: '',
        registryPath: tmpRegistry
      });

      assert.strictEqual(projects.length, 0, 'Invalid project should be filtered out');
      assert.strictEqual(validationErrors.length, 1);
      assert.ok(validationErrors[0].includes('exposure'), 'Error should mention exposure');
    } finally {
      fs.unlinkSync(tmpRegistry);
    }
  });

  it('should reject a dynamic project without {host} in run_command', () => {
    const tmpRegistry = path.join(os.tmpdir(), `test_registry_${Date.now()}.json`);
    fs.writeFileSync(tmpRegistry, JSON.stringify({
      projects: [{
        name: 'no_host_project',
        type: 'python-fastapi',
        local_path: '/tmp/fake',
        run_command: 'python main.py --port {port}',
        always_on: false,
        exposure: 'loopback'
        // missing {host} in run_command
      }]
    }));

    try {
      const { projects, validationErrors } = createApp({
        host: '127.0.0.1',
        port: 0,
        autoStart: false,
        authUsername: '',
        authPassword: '',
        registryPath: tmpRegistry
      });

      assert.strictEqual(projects.length, 0);
      assert.ok(validationErrors[0].includes('{host}'));
    } finally {
      fs.unlinkSync(tmpRegistry);
    }
  });

  it('should reject a static-html project without access_url and entry_point', () => {
    const tmpRegistry = path.join(os.tmpdir(), `test_registry_${Date.now()}.json`);
    fs.writeFileSync(tmpRegistry, JSON.stringify({
      projects: [{
        name: 'empty_static',
        type: 'static-html',
        local_path: '/tmp/fake',
        run_command: '',
        always_on: false
        // no access_url and no entry_point
      }]
    }));

    try {
      const { projects, validationErrors } = createApp({
        host: '127.0.0.1',
        port: 0,
        autoStart: false,
        authUsername: '',
        authPassword: '',
        registryPath: tmpRegistry
      });

      assert.strictEqual(projects.length, 0);
      assert.ok(validationErrors[0].includes('access_url') || validationErrors[0].includes('entry_point'));
    } finally {
      fs.unlinkSync(tmpRegistry);
    }
  });

  it('should accept a static-html project with access_url', () => {
    const tmpRegistry = path.join(os.tmpdir(), `test_registry_${Date.now()}.json`);
    fs.writeFileSync(tmpRegistry, JSON.stringify({
      projects: [{
        name: 'good_static',
        type: 'static-html',
        access_url: 'https://example.com',
        local_path: '/tmp/fake',
        run_command: '',
        always_on: false,
        status: 'deployed'
      }]
    }));

    try {
      const { projects, validationErrors } = createApp({
        host: '127.0.0.1',
        port: 0,
        autoStart: false,
        authUsername: '',
        authPassword: '',
        registryPath: tmpRegistry
      });

      assert.strictEqual(projects.length, 1);
      assert.strictEqual(validationErrors.length, 0);
    } finally {
      fs.unlinkSync(tmpRegistry);
    }
  });

  it('should reject a project without a name', () => {
    const tmpRegistry = path.join(os.tmpdir(), `test_registry_${Date.now()}.json`);
    fs.writeFileSync(tmpRegistry, JSON.stringify({
      projects: [{
        type: 'python-fastapi',
        local_path: '/tmp/fake',
        run_command: 'python main.py --host {host}',
        always_on: false,
        exposure: 'loopback'
      }]
    }));

    try {
      const { projects, validationErrors } = createApp({
        host: '127.0.0.1',
        port: 0,
        autoStart: false,
        authUsername: '',
        authPassword: '',
        registryPath: tmpRegistry
      });

      assert.strictEqual(projects.length, 0);
      assert.ok(validationErrors[0].includes('name'));
    } finally {
      fs.unlinkSync(tmpRegistry);
    }
  });
});
