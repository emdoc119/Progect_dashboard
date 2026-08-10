import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const registryPath = path.join(__dirname, '../projects.json');
const projects = JSON.parse(fs.readFileSync(registryPath, 'utf8')).projects;

describe('Phase B: Registry Security Validation', () => {
  it('should ensure all dynamic projects use exposure: loopback', () => {
    for (const project of projects) {
      if (project.type !== 'static-html' && project.runtime !== 'remote' && project.service_kind !== 'remote') {
        assert.strictEqual(project.exposure, 'loopback', `Project ${project.name} must have exposure set to 'loopback'`);
      }
    }
  });

  it('should ensure all dynamic projects use {host} placeholder or docker compose in run_command', () => {
    for (const project of projects) {
      if (project.type !== 'static-html' && project.runtime !== 'remote' && project.service_kind !== 'remote') {
        const isDocker = project.run_command.includes('docker compose');
        const hasHost = project.run_command.includes('{host}');
        assert.ok(hasHost || isDocker, `Project ${project.name} run_command must include '{host}' placeholder or docker compose`);
      }
    }
  });

  it('should ensure no dynamic project uses 0.0.0.0 or hardcoded 127.0.0.1 for host binding', () => {
    for (const project of projects) {
      if (project.type !== 'static-html' && project.runtime !== 'remote' && project.service_kind !== 'remote') {
        assert.ok(!project.run_command.includes('0.0.0.0'), `Project ${project.name} must not use 0.0.0.0`);
        assert.ok(!project.run_command.includes('127.0.0.1'), `Project ${project.name} must not use hardcoded 127.0.0.1, use {host} instead`);
      }
    }
  });
});
