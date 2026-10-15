// Generell CSV-tolkare (RFC 4180-kompatibel: citattecken, dubblerade citattecken, radbrytning i fält).
// Ren funktion utan beroenden – kan testas i både webbläsare och Node.

/**
 * @param {string} text
 * @param {string} delimiter
 * @returns {string[][]}
 */
export function parseCsv(text, delimiter = ';') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // ta bort BOM

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

/** Svenskt talformat: "1 234,56", "-12,5", "" → 0. */
export function parseSwedishNumber(value) {
  if (value == null) return 0;
  const cleaned = String(value).replace(/[\s ]/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-') return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new Error(`Ogiltigt tal: "${value}"`);
  return n;
}
