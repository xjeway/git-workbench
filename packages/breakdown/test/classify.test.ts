import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPath } from '../src/classify.ts';

test('classifies documentation, source, tests, configuration, generated, and other paths', () => {
  assert.equal(classifyPath('README.md'), 'documentation');
  assert.equal(classifyPath('src/index.ts'), 'code');
  assert.equal(classifyPath('src/index.test.ts'), 'tests');
  assert.equal(classifyPath('config/app.yaml'), 'configuration');
  assert.equal(classifyPath('src/generated/client.ts'), 'generated');
  assert.equal(classifyPath('assets/logo.png'), 'other');
});

test('test and generated path rules take precedence over source extensions', () => {
  assert.equal(classifyPath('test/fixtures/generated/output.ts'), 'tests');
  assert.equal(classifyPath('dist/client.js'), 'generated');
});
