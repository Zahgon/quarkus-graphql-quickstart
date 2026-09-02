/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { CustomInfoContributor } from '../../../src/info/contributor/custom-info-contributor.js';

/**
 * A test the original does not have. The contributor's name and payload are
 * part of the `/q/info` contract, and nothing else in the suite reaches them.
 */
describe('CustomInfoContributorTest', () => {
  it('name_isAppDetailInfo', () => {
    expect(new CustomInfoContributor().name()).toBe('app-detail-info');
  });

  it('data_reportsTheFeatureFlagsAndTheMinioStatus', () => {
    const data = new CustomInfoContributor().data();

    expect(data['feature-flags']).toEqual({ 'nuova-dashboard-abilitata': true });
    expect(data['minio']).toEqual({ status: 'UP' });
  });
});
