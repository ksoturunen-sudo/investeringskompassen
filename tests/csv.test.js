import { test, assertEqual, assertThrows } from './harness.js';
import { parseCsv, parseSwedishNumber } from '../src/core/csv.js';

test('CSV: semikolon, citattecken och BOM', () => {
  const rows = parseCsv('﻿a;b\n"x;y";"he ""sa"""\r\n\n1;2');
  assertEqual(rows, [['a', 'b'], ['x;y', 'he "sa"'], ['1', '2']]);
});

test('Svenska tal', () => {
  assertEqual(parseSwedishNumber('1 234,56'), 1234.56);
  assertEqual(parseSwedishNumber('-12,5'), -12.5);
  assertEqual(parseSwedishNumber(''), 0);
  assertEqual(parseSwedishNumber('-'), 0);
  assertThrows(() => parseSwedishNumber('abc'));
});
