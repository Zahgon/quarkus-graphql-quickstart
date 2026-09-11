/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { applicationProperties } from '../config/application-properties.js';

/**
 * Reimplementation of `io.quarkus.logging.Log`.
 *
 * The original is a static façade over JBoss Logging whose category is the
 * calling class. Only three of its behaviours are observable and therefore
 * reproduced here: the `printf`-style `*f` variants, the level filtering driven
 * by `quarkus.log.category."…".level`, and the fact that an exception passed as
 * the trailing argument is rendered after the message.
 */

const LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
export type Level = (typeof LEVELS)[number];

/** `%s`, `%d` and `%%` are the only conversions the original call sites use. */
function format(pattern: string, args: readonly unknown[]): string {
  let index = 0;
  return pattern.replace(/%[sd%]/g, (match) => {
    if (match === '%%') {
      return '%';
    }
    const value = args[index++];
    return value === null || value === undefined ? String(value) : String(value);
  });
}

export class Logger {
  constructor(private readonly category: string) {}

  private get threshold(): number {
    const configured = applicationProperties.log.categories.get(this.category);
    const level = (configured as Level | undefined) ?? 'INFO';
    return LEVELS.indexOf(level);
  }

  private write(level: Level, message: string, error?: unknown): void {
    if (LEVELS.indexOf(level) < this.threshold) {
      return;
    }
    const line = `${level} [${this.category}] ${message}`;
    const sink = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    if (error === undefined) {
      sink(line);
    } else {
      sink(line, error);
    }
  }

  debugf(pattern: string, ...args: unknown[]): void {
    this.write('DEBUG', format(pattern, args));
  }

  infof(pattern: string, ...args: unknown[]): void {
    this.write('INFO', format(pattern, args));
  }

  warnf(pattern: string, ...args: unknown[]): void {
    this.write('WARN', format(pattern, args));
  }

  /**
   * Mirrors `Log.errorf(String, Object...)`. The original call sites pass the
   * exception as one argument past the last conversion, where JBoss Logging
   * renders it as the cause rather than substituting it.
   */
  errorf(pattern: string, ...args: unknown[]): void {
    const conversions = (pattern.match(/%[sd]/g) ?? []).length;
    const substitutions = args.slice(0, conversions);
    const cause = args.length > conversions ? args[conversions] : undefined;
    this.write('ERROR', format(pattern, substitutions), cause);
  }

  error(message: string | undefined | null, error?: unknown): void {
    this.write('ERROR', message ?? 'null', error);
  }
}

const loggers = new Map<string, Logger>();

/** `Log` resolves its category from the calling class; here it is passed in. */
export function logger(category: string): Logger {
  let existing = loggers.get(category);
  if (existing === undefined) {
    existing = new Logger(category);
    loggers.set(category, existing);
  }
  return existing;
}
