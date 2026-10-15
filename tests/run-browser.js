import { runAll } from './suites.js';

const results = await runAll();
const failed = results.filter((r) => !r.ok).length;
document.getElementById('out').textContent = results
  .map((r) => `${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`)
  .join('\n') + `\n\n${results.length - failed} godkända, ${failed} underkända`;
document.title = failed ? `✘ ${failed} underkända` : '✔ Alla godkända';
