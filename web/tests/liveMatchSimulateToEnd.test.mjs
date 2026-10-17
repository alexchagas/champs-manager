import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readLive = () => fs.readFileSync(path.join(__dirname, '../src/components/LiveMatchScreen.tsx'), 'utf8');

test('LiveMatchScreen offers "Simular até o fim" using the engine fast_forward command', () => {
  const content = readLive();
  assert.ok(content.includes('data-testid="simulate-to-end-btn"'), 'Has the new button');
  assert.ok(content.includes('onClick={simulateToEnd}'), 'Button uses simulateToEnd');
  const handler = content.match(/const simulateToEnd = \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(handler, 'simulateToEnd is defined');
  assert.ok(handler[0].includes("dispatchMatch({ type: 'fast_forward' })"), 'Sends the engine fast_forward command');
  assert.ok(content.includes('Simular até o fim'), 'Visible label');
});

test('LiveMatchScreen keeps the original "Simular" (stops at decisions) alongside', () => {
  const content = readLive();
  assert.ok(content.includes("onClick={() => dispatchMatch({ type: 'finish' })}"), 'Original button still sends finish');
  assert.ok(content.includes('Simular até a próxima decisão ou o intervalo'), 'Original button explains it stops');
});

test('"Simular até o fim" skips replaying past moments (penalty animations, sound cascade)', () => {
  const content = readLive();
  const handler = content.match(/const simulateToEnd = \(\) => \{[\s\S]*?\n  \};/)[0];
  assert.ok(handler.indexOf('skipPresentationRef.current = true') < handler.indexOf("type: 'fast_forward'"), 'Flags before dispatching');
  assert.ok(content.includes('if (skipPresentationRef.current) {'), 'Events effect honours the flag');
  assert.ok(content.includes('skipPresentationRef.current = false;'), 'Flag is consumed once');
});
