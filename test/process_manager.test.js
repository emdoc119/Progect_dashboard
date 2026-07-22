import { describe, it } from 'node:test';
import assert from 'node:assert';
import { maskSecretData } from '../server.js';

describe('Phase C: Error Masking and ProcessManager Logic', () => {
  it('should mask passwords in URLs', () => {
    const errorMsg = 'Failed to connect to postgresql://admin:supersecret123@localhost:5432/mydb';
    const masked = maskSecretData(errorMsg);
    assert.strictEqual(masked, 'Failed to connect to postgresql://***:***@localhost:5432/mydb');
  });

  it('should mask token and key values in error strings', () => {
    const errorMsg = 'Invalid configuration: token="abcdef12345" and api_key=xyz987';
    const masked = maskSecretData(errorMsg);
    assert.strictEqual(masked, 'Invalid configuration: token=*** and api_key=***');
  });

  it('should mask passwords in generic key=value pairs', () => {
    const errorMsg = 'Exception: DB_PASSWORD=my_db_pass connection refused';
    const masked = maskSecretData(errorMsg);
    assert.strictEqual(masked, 'Exception: DB_PASSWORD=*** connection refused');
  });

  it('should not modify safe error messages', () => {
    const errorMsg = 'Module not found: react-dom';
    const masked = maskSecretData(errorMsg);
    assert.strictEqual(masked, errorMsg);
  });

  it('should mask double-quoted token values', () => {
    const errorMsg = 'Auth failed: token="abcdef12345" expired';
    const masked = maskSecretData(errorMsg);
    assert.strictEqual(masked, 'Auth failed: token=*** expired');
  });

  it('should mask single-quoted secret values', () => {
    const errorMsg = "Config error: secret='my_super_secret'";
    const masked = maskSecretData(errorMsg);
    assert.strictEqual(masked, 'Config error: secret=***');
  });

  it('should mask multiple secrets in one string', () => {
    const errorMsg = 'Err: password=abc123 token=xyz789 key=def456';
    const masked = maskSecretData(errorMsg);
    assert.strictEqual(masked, 'Err: password=*** token=*** key=***');
  });

  it('should handle null and undefined gracefully', () => {
    assert.strictEqual(maskSecretData(null), null);
    assert.strictEqual(maskSecretData(undefined), undefined);
    assert.strictEqual(maskSecretData(''), '');
  });
});
