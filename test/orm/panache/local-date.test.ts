/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { LocalDate } from '../../../src/orm/panache/local-date.js';

/**
 * A test the original does not have: `java.time.LocalDate` supplied this
 * behaviour. The ISO-8601 text is what reaches the database, the JSON payloads
 * and the GraphQL `Date` scalar, so the formatting is contractual.
 */
describe('LocalDateTest', () => {
  it('of_formatsAsIso8601WithZeroPadding', () => {
    expect(LocalDate.of(1980, 1, 1)).toBe('1980-01-01');
    expect(LocalDate.of(2025, 12, 31)).toBe('2025-12-31');
    expect(LocalDate.of(9, 2, 3)).toBe('0009-02-03');
  });

  it('of_rejectsAnOutOfRangeMonthOrDay', () => {
    expect(() => LocalDate.of(1980, 13, 1)).toThrow(RangeError);
    expect(() => LocalDate.of(1980, 0, 1)).toThrow(RangeError);
    expect(() => LocalDate.of(1980, 1, 32)).toThrow(RangeError);
  });

  it('now_isAWellFormedDate', () => {
    expect(LocalDate.now()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LocalDate.parse(LocalDate.now())).toBe(LocalDate.now());
  });

  it('parse_rejectsAnythingThatIsNotIso8601', () => {
    expect(LocalDate.parse('2021-04-28')).toBe('2021-04-28');
    expect(() => LocalDate.parse('28/04/2021')).toThrow(TypeError);
    expect(() => LocalDate.parse('2021-4-8')).toThrow(TypeError);
  });
});
