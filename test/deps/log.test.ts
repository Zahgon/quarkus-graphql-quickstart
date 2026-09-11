/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/deps/log.js';

/**
 * A test the original does not have: `io.quarkus.logging.Log` supplied the
 * `printf`-style formatting and the level filtering. The port implements both,
 * and the message text is part of what an operator sees.
 */
describe('LogTest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('infof_substitutesTheConversions', () => {
    const sink = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logger('test.category').infof('bucket {%s} holds %d file(s)', 'book-cover', 10);

    expect(sink).toHaveBeenCalledWith('INFO [test.category] bucket {book-cover} holds 10 file(s)');
  });

  it('debugf_isFilteredOutBelowTheCategoryThreshold', () => {
    const sink = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logger('test.category').debugf('never seen %s', 'x');

    expect(sink).not.toHaveBeenCalled();
  });

  it('warnf_isWritten', () => {
    const sink = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger('test.category').warnf('Resource file not found: {%s}', 'missing.jpg');

    expect(sink).toHaveBeenCalledWith('WARN [test.category] Resource file not found: {missing.jpg}');
  });

  it('errorf_rendersTheTrailingExceptionAsTheCause', () => {
    const sink = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cause = new Error('boom');
    logger('test.category').errorf('Error uploading {%s} to Minio', 'a.jpg', cause);

    expect(sink).toHaveBeenCalledWith(
      'ERROR [test.category] Error uploading {a.jpg} to Minio',
      cause,
    );
  });

  it('error_acceptsANullMessage', () => {
    const sink = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logger('test.category').error(null);

    expect(sink).toHaveBeenCalledWith('ERROR [test.category] null');
  });

  it('logger_returnsTheSameInstanceForACategory', () => {
    expect(logger('test.category')).toBe(logger('test.category'));
  });
});
