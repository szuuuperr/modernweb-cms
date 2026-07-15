import { FieldType } from '../../../../generated/prisma/client';
import { FieldDefinition, FieldTypeStrategy } from './field-type.strategy';

export class SelectStrategy implements FieldTypeStrategy {
  readonly type = FieldType.SELECT;

  validate(value: unknown, field: FieldDefinition): string | null {
    if (typeof value !== 'string') return 'must be a string';
    const options = (field.options ?? {}) as { choices?: string[] };
    const choices = options.choices ?? [];
    if (choices.length > 0 && !choices.includes(value)) {
      return `must be one of: ${choices.join(', ')}`;
    }
    return null;
  }

  transform(value: unknown): unknown {
    return value;
  }
}

/** Stores a Media id (or array of ids when options.multiple is true). */
export class MediaStrategy implements FieldTypeStrategy {
  readonly type = FieldType.MEDIA;

  validate(value: unknown, field: FieldDefinition): string | null {
    const options = (field.options ?? {}) as { multiple?: boolean };
    if (options.multiple) {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return 'must be an array of media ids';
      }
      return null;
    }
    return typeof value === 'string' && value.length > 0
      ? null
      : 'must be a media id';
  }

  transform(value: unknown): unknown {
    return value;
  }
}

/** Stores an Entry id referencing another collection's entry. */
export class RelationStrategy implements FieldTypeStrategy {
  readonly type = FieldType.RELATION;

  validate(value: unknown, field: FieldDefinition): string | null {
    const options = (field.options ?? {}) as { multiple?: boolean };
    if (options.multiple) {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return 'must be an array of entry ids';
      }
      return null;
    }
    return typeof value === 'string' && value.length > 0
      ? null
      : 'must be an entry id';
  }

  transform(value: unknown): unknown {
    return value;
  }
}
