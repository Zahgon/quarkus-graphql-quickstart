/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { EntityMetadata } from '../metadata.js';
import { registerEntity } from '../metadata.js';
import { PanacheEntity } from '../panache-entity.js';
import type { PanacheQuery } from '../panache-query.js';
import { Book } from './book.js';

/** `@Entity(name = "editor")`. */
export class Editor extends PanacheEntity {
  static readonly metadata: EntityMetadata = registerEntity({
    name: 'editor',
    table: 'editor',
    sequence: 'editor_seq',
    newInstance: (): object => new Editor(),
    columns: [{ property: 'name', column: 'name', type: 'string', nullable: true }],
    elementCollections: [],
    manyToOne: [],
    manyToMany: [],
    inverse: [
      { property: 'books', mappedBy: 'editor', target: () => Book.metadata, jsonBackReference: true },
    ],
  });

  name: string | null = null;

  /** `@OneToMany(mappedBy = "editor")` `@JsonBackReference`. */
  books: Book[] | null = null;

  /**
   * Finds all editors.
   *
   * @returns a list of all editors.
   */
  static findAllEditors(): PanacheQuery<Editor> {
    return Editor.findAll();
  }

  /**
   * Finds an editor by their ID.
   *
   * @param id the ID of the editor to find.
   * @returns the editor with the specified ID, or null if no such editor exists.
   */
  static async findEditorById(id: number | null): Promise<Editor | null> {
    return await Editor.findById(id);
  }

  /**
   * Finds all editors.
   *
   * @returns a list of all editors.
   */
  static async listAllEditors(): Promise<Editor[]> {
    return await Editor.listAll();
  }
}
