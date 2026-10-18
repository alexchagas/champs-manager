import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('AccessGatekeeper Safari and WebKit compatibility attributes', () => {
  const filePath = path.join(projectRoot, 'src/components/AccessGatekeeper.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Must not have global select-none on outer container
  assert.ok(
    !content.includes('<div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0c1511] text-slate-100 p-4 select-none'),
    'Outer container must not use select-none to avoid blocking input on Safari'
  );

  // Must use select-text and cursor-text on password input
  assert.ok(
    content.includes('select-text') && content.includes('cursor-text'),
    'Password input must explicitly have select-text and cursor-text'
  );

  // Must support 16px text-base on mobile to avoid Safari auto-zoom
  assert.ok(
    content.includes('text-base sm:text-sm'),
    'Password input must use text-base on mobile to prevent iOS Safari auto-zoom'
  );

  // Must have mobile Safari friendly attributes
  assert.ok(content.includes('autoComplete="current-password"'), 'Input must have autoComplete');
  assert.ok(content.includes('autoCapitalize="none"'), 'Input must disable autoCapitalize');
  assert.ok(content.includes('autoCorrect="off"'), 'Input must disable autoCorrect');

  // Must have pure JS sha256 fallback
  assert.ok(content.includes('sha256Pure'), 'Component must include sha256Pure fallback for non-secure contexts');
  assert.ok(content.includes('memoryAccessGranted'), 'Component must include in-memory access fallback for private mode');

  // Audio must not autoplay without user gesture on URL unlock
  assert.ok(content.includes('if (!fromUrl)'), 'Audio playback must only trigger on user gesture, not on fromUrl');
});

test('BugReportModal Safari input compatibility', () => {
  const filePath = path.join(projectRoot, 'src/components/BugReportModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  assert.ok(
    content.includes('select-text cursor-text'),
    'BugReportModal inputs must use select-text and cursor-text'
  );
  assert.ok(
    content.includes('text-base sm:text-sm'),
    'BugReportModal inputs must use text-base on mobile'
  );
});
