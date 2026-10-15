// Minimal testram som fungerar både i webbläsaren (tests/run.html) och i Node (tests/run-node.mjs).
export const tests = [];
export const test = (name, fn) => tests.push({ name, fn });

export function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} förväntade ${e}, fick ${a}`);
}
export function assertClose(actual, expected, msg = '', eps = 1e-6) {
  if (Math.abs(actual - expected) > eps) throw new Error(`${msg} förväntade ≈${expected}, fick ${actual}`);
}
export function assertThrows(fn, msg = '') {
  try { fn(); } catch { return; }
  throw new Error(`${msg} förväntade ett fel`);
}

export async function runAll() {
  const results = [];
  for (const t of tests) {
    try { await t.fn(); results.push({ name: t.name, ok: true }); }
    catch (e) { results.push({ name: t.name, ok: false, error: e.message }); }
  }
  return results;
}
