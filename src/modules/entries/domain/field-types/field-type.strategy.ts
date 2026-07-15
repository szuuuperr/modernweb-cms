import type { Field, FieldType } from '../../../../generated/prisma/client';

/**
 * The parts of a field that validation actually needs.
 *
 * Deliberately structural rather than the Prisma `Field` row, so the same
 * strategies validate collection entries (Field rows) and form submissions
 * (field definitions stored as JSON) without a second validator.
 */
export type FieldDefinition = Pick<
  Field,
  'key' | 'type' | 'required' | 'options'
>;

/**
 * Strategy pattern: one strategy per field type.
 * Adding a new field type = add a strategy + register it. No other changes.
 */
export interface FieldTypeStrategy {
  readonly type: FieldType;

  /** Returns an error message, or null when the value is valid. */
  validate(value: unknown, field: FieldDefinition): string | null;

  /** Normalizes the value before it is stored in the entry data JSON. */
  transform(value: unknown, field: FieldDefinition): unknown;
}
