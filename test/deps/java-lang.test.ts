/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import {
  decodeBase64,
  encodeBase64,
  IllegalArgumentException,
  parseInt10,
} from '../../src/deps/java-lang.js';

/**
 * A test the original does not have.
 *
 * `java.util.Base64` and `Integer.parseInt` supplied this behaviour to the
 * original, so the JDK's own test suite covered it. The port implements it,
 * and the pagination contract depends on it being *strict*: the cursor
 * `"invalid_cursor"` has to be rejected rather than decoded to something.
 */
describe('JavaLangTest', () => {
  it('decodeBase64_decodesTheBasicAlphabet', () => {
    expect(decodeBase64('MA==').toString('utf8')).toBe('0');
    expect(decodeBase64('dGVzdCBjb250ZW50').toString('utf8')).toBe('test content');
    expect(decodeBase64('').toString('utf8')).toBe('');
  });

  it('decodeBase64_rejectsCharactersOutsideTheAlphabet', () => {
    expect(() => decodeBase64('invalid_cursor')).toThrow(IllegalArgumentException);
    expect(() => decodeBase64('MA=A')).toThrow(IllegalArgumentException);
    expect(() => decodeBase64('A')).toThrow(IllegalArgumentException);
  });

  it('encodeBase64_matchesTheDecoder', () => {
    expect(encodeBase64('5')).toBe('NQ==');
    expect(decodeBase64(encodeBase64('12345')).toString('utf8')).toBe('12345');
  });

  it('parseInt10_acceptsOnlyAWholeIntegerString', () => {
    expect(parseInt10('0')).toBe(0);
    expect(parseInt10('-42')).toBe(-42);
    expect(() => parseInt10('12abc')).toThrow(IllegalArgumentException);
    expect(() => parseInt10('')).toThrow(IllegalArgumentException);
  });
});
