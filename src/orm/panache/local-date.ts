/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * `java.time.LocalDate` — a date with no time-of-day and no time zone.
 *
 * Represented as its ISO-8601 text, `YYYY-MM-DD`, which is exactly what
 * Hibernate stores, what Jackson emits, and what the GraphQL `Date` scalar
 * renders. Keeping the wire form as the in-memory form means equality,
 * ordering and serialisation all behave the way the original does without a
 * wrapper object in between.
 */
export type LocalDate = string;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export const LocalDate = {
  /** `LocalDate.of(1980, 1, 1)` → `'1980-01-01'`. Month is 1-based, as in Java. */
  of(year: number, month: number, dayOfMonth: number): LocalDate {
    if (month < 1 || month > 12) {
      throw new RangeError(`Invalid value for MonthOfYear (valid values 1 - 12): ${month}`);
    }
    if (dayOfMonth < 1 || dayOfMonth > 31) {
      throw new RangeError(
        `Invalid value for DayOfMonth (valid values 1 - 28/31): ${dayOfMonth}`,
      );
    }
    return `${pad(year, 4)}-${pad(month, 2)}-${pad(dayOfMonth, 2)}`;
  },

  /** The current date in the system default zone, as `LocalDate.now()` does. */
  now(): LocalDate {
    const now = new Date();
    return LocalDate.of(now.getFullYear(), now.getMonth() + 1, now.getDate());
  },

  /** Parses ISO-8601 text, rejecting anything else the way `LocalDate.parse` does. */
  parse(text: string): LocalDate {
    if (!/^-?\d{4,}-\d{2}-\d{2}$/.test(text)) {
      throw new TypeError(`Text '${text}' could not be parsed as a LocalDate`);
    }
    return text;
  },
};
