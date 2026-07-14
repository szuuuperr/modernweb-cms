import type { Field, FieldType } from '../../../../generated/prisma/client';

/**
 * Strategy pattern: one strategy per field type.
 * Adding a new field type = add a strategy + register it. No other changes.
 */
export interface FieldTypeStrategy {
  readonly type: FieldType;

  /** Returns an error message, or null when the value is valid. */
  validate(value: unknown, field: Field): string | null;

  /** Normalizes the value before it is stored in the entry data JSON. */
  transform(value: unknown, field: Field): unknown;
}
