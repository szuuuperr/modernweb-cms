import { Field, FieldType } from '../../../../generated/prisma/client';
import { FieldTypeStrategy } from './field-type.strategy';

abstract class StringLikeStrategy implements FieldTypeStrategy {
  abstract readonly type: FieldType;

  validate(value: unknown, field: Field): string | null {
    if (typeof value !== 'string') return 'must be a string';
    const options = (field.options ?? {}) as { maxLength?: number };
    if (options.maxLength && value.length > options.maxLength) {
      return `must be at most ${options.maxLength} characters`;
    }
    return null;
  }

  transform(value: unknown): unknown {
    return typeof value === 'string' ? value.trim() : value;
  }
}

export class TextStrategy extends StringLikeStrategy {
  readonly type = FieldType.TEXT;
}

export class TextareaStrategy extends StringLikeStrategy {
  readonly type = FieldType.TEXTAREA;
}

export class RichtextStrategy extends StringLikeStrategy {
  readonly type = FieldType.RICHTEXT;

  // Rich text keeps whitespace as authored by the editor.
  transform(value: unknown): unknown {
    return value;
  }
}
