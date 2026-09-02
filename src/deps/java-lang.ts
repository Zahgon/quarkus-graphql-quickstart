/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * The few `java.lang` / `java.util` behaviours the application depends on that
 * JavaScript either lacks or defines differently.
 */

/** `java.lang.IllegalArgumentException`, and by extension `NumberFormatException`. */
export class IllegalArgumentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalArgumentException';
  }
}

const BASIC_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/;

/**
 * `java.util.Base64.getDecoder().decode(String)`.
 *
 * The basic decoder is strict: it accepts only the RFC 4648 alphabet and
 * rejects a malformed length, throwing `IllegalArgumentException`.
 * `Buffer.from(s, 'base64')` does neither — it silently skips characters it
 * does not recognise — so the pagination cursor `"invalid_cursor"` would decode
 * to something rather than being rejected.
 */
export function decodeBase64(text: string): Buffer {
  if (!BASIC_BASE64.test(text)) {
    throw new IllegalArgumentException(`Illegal base64 character in '${text}'`);
  }
  return Buffer.from(text, 'base64');
}

/** `java.util.Base64.getEncoder().encodeToString(byte[])`. */
export function encodeBase64(value: string | Uint8Array): string {
  return Buffer.from(value as Uint8Array).toString('base64');
}

/**
 * `java.lang.Integer.parseInt(String)` — the whole string must be an integer,
 * where `Number.parseInt` would happily stop at the first non-digit.
 */
export function parseInt10(text: string): number {
  if (!/^[+-]?\d+$/.test(text)) {
    throw new IllegalArgumentException(`For input string: "${text}"`);
  }
  return Number(text);
}
