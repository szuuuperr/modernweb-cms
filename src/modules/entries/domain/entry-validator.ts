import { BadRequestException, Injectable } from '@nestjs/common';
import type { Field } from '../../../generated/prisma/client';
import { FieldTypeRegistry } from './field-type.registry';

/**
 * Validates an entry's data JSON against the collection's field definitions.
 * `partial` mode (updates) only validates the keys that are present.
 */
@Injectable()
export class EntryValidator {
  constructor(private readonly registry: FieldTypeRegistry) {}

  validate(
    fields: Field[],
    data: Record<string, unknown>,
    { partial = false }: { partial?: boolean } = {},
  ): Record<string, unknown> {
    const errors: string[] = [];
    const cleaned: Record<string, unknown> = {};
    const fieldsByKey = new Map(fields.map((f) => [f.key, f]));

    for (const key of Object.keys(data)) {
      if (!fieldsByKey.has(key)) {
        errors.push(`"${key}" is not a field of this collection`);
      }
    }

    for (const field of fields) {
      const value = data[field.key];

      if (value === undefined) {
        if (!partial && field.required) {
          errors.push(`"${field.key}" is required`);
        }
        continue;
      }

      if (value === null || value === '') {
        if (field.required) {
          errors.push(`"${field.key}" is required`);
        } else {
          cleaned[field.key] = null;
        }
        continue;
      }

      const strategy = this.registry.get(field.type);
      const error = strategy.validate(value, field);
      if (error) {
        errors.push(`"${field.key}" ${error}`);
      } else {
        cleaned[field.key] = strategy.transform(value, field);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }
    return cleaned;
  }
}
