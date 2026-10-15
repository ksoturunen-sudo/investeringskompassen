// Kör testerna i Node (används av GitHub Actions): node tests/run-node.mjs
import { runAll } from './suites.js';

const results = await runAll();
for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} godkända, ${failed} underkända`);
process.exit(failed ? 1 : 0);
