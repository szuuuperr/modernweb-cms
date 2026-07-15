import { FieldType } from '../../../../generated/prisma/client';
import { FieldDefinition, FieldTypeStrategy } from './field-type.strategy';

export class NumberStrategy implements FieldTypeStrategy {
  readonly type = FieldType.NUMBER;

  validate(value: unknown, field: FieldDefinition): string | null {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 'must be a number';
    }
    const options = (field.options ?? {}) as { min?: number; max?: number };
    if (options.min !== undefined && value < options.min) {
      return `must be >= ${options.min}`;
    }
    if (options.max !== undefined && value > options.max) {
      return `must be <= ${options.max}`;
    }
    return null;
  }

  transform(value: unknown): unknown {
    return value;
  }
}

export class BooleanStrategy implements FieldTypeStrategy {
  readonly type = FieldType.BOOLEAN;

  validate(value: unknown): string | null {
    return typeof value === 'boolean' ? null : 'must be a boolean';
  }

  transform(value: unknown): unknown {
    return value;
  }
}

export class DateStrategy implements FieldTypeStrategy {
  readonly type = FieldType.DATE;

  validate(value: unknown): string | null {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      return 'must be an ISO 8601 date string';
    }
    return null;
  }

  transform(value: unknown): unknown {
    return new Date(value as string).toISOString();
  }
}

export class JsonStrategy implements FieldTypeStrategy {
  readonly type = FieldType.JSON;

  validate(value: unknown): string | null {
    return value === undefined ? 'must be a JSON value' : null;
  }

  transform(value: unknown): unknown {
    return value;
  }
}
