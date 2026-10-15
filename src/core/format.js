// Svensk formatering av belopp, procent och datum.

const sek = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 });
const sekExact = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 4 });
const pct = new Intl.NumberFormat('sv-SE', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' });

export const formatSek = (v) => sek.format(v);
export const formatSekExact = (v) => sekExact.format(v);
export const formatNumber = (v) => num.format(v);
export const formatPct = (v) => pct.format(v);
export const formatSignedSek = (v) => (v > 0 ? '+' : '') + sek.format(v);
export const trend = (v) => (v > 0.5 ? 'up' : v < -0.5 ? 'down' : 'flat');
