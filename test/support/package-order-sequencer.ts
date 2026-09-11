import { BaseSequencer } from 'vitest/node';
import type { TestSpecification } from 'vitest/node';

/**
 * Runs the test files in path order.
 *
 * The original suite shares one database across every test class, so the order
 * the classes run in is part of its behaviour: `BookGraphQLIntegrationTest`
 * reads book 5's seeded authors, and `BookResourceIntegrationTest` later
 * replaces them. The JVM ordered those classes by their package path; the
 * TypeScript files mirror that layout, so sorting by path reproduces it.
 *
 * Vitest's default sequencer orders by file size to spread work across
 * workers, which would shuffle them.
 */
export class PackageOrderSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((left, right) => left.moduleId.localeCompare(right.moduleId));
  }
}
