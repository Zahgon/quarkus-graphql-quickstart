/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Editor } from '../../../src/orm/panache/entity/editor.js';
import {
  currentEntityManager,
  entityManager as em,
  runInSession,
  transactional,
} from '../../../src/orm/panache/session.js';

/**
 * A test the original does not have: CDI scoped the `EntityManager` to the
 * request and `@Transactional` opened and closed the JTA transaction. The port
 * does both, so the propagation rules it implements are asserted here.
 */
describe('SessionTest', () => {
  it('currentEntityManager_refusesToWorkOutsideASession', async () => {
    await expect(currentEntityManager()).rejects.toThrow('No persistence session is active');
  });

  it('runInSession_joinsAnAlreadyOpenSession', async () => {
    await runInSession(async () => {
      const outer = await currentEntityManager();
      await runInSession(async () => {
        expect(await currentEntityManager()).toBe(outer);
      });
    });
  });

  it('transactional_joinsTheCallersTransaction', async () => {
    await transactional(async () => {
      const outer = await currentEntityManager();
      const editor = new Editor();
      editor.name = 'Nested propagation';
      await em.persist(editor);

      await transactional(async () => {
        // REQUIRED propagation: the same context, not a second one.
        expect(await currentEntityManager()).toBe(outer);
        await em.flush();
      });

      expect((await em.find<Editor>(Editor, editor.id))?.name).toBe('Nested propagation');
    });
  });

  it('transactional_startsOneInsideAPlainSession', async () => {
    await runInSession(async () => {
      const editor = await transactional(async () => {
        const created = new Editor();
        created.name = 'Session then transaction';
        await em.persist(created);
        return created;
      });

      await transactional(async () => {
        expect((await em.find<Editor>(Editor, editor.id))?.name).toBe(
          'Session then transaction',
        );
      });
    });
  });

  it('transactional_serialisesOverlappingTransactions', async () => {
    const order: string[] = [];

    await Promise.all([
      transactional(async () => {
        order.push('first:begin');
        await new Promise((resolve) => setTimeout(resolve, 10));
        order.push('first:end');
      }),
      transactional(() => {
        order.push('second:begin');
        order.push('second:end');
      }),
    ]);

    expect(order).toEqual(['first:begin', 'first:end', 'second:begin', 'second:end']);
  });
});
