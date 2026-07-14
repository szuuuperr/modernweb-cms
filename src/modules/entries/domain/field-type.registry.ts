import { Injectable } from '@nestjs/common';
import { FieldType } from '../../../generated/prisma/client';
import { FieldTypeStrategy } from './field-types/field-type.strategy';
import {
  BooleanStrategy,
  DateStrategy,
  JsonStrategy,
  NumberStrategy,
} from './field-types/primitive.strategies';
import {
  MediaStrategy,
  RelationStrategy,
  SelectStrategy,
} from './field-types/reference.strategies';
import {
  RichtextStrategy,
  TextStrategy,
  TextareaStrategy,
} from './field-types/string.strategies';

/** Factory pattern: resolves the right strategy for a field type. */
@Injectable()
export class FieldTypeRegistry {
  private readonly strategies = new Map<FieldType, FieldTypeStrategy>();

  constructor() {
    const all: FieldTypeStrategy[] = [
      new TextStrategy(),
      new TextareaStrategy(),
      new RichtextStrategy(),
      new NumberStrategy(),
      new BooleanStrategy(),
      new DateStrategy(),
      new SelectStrategy(),
      new MediaStrategy(),
      new RelationStrategy(),
      new JsonStrategy(),
    ];
    for (const strategy of all) {
      this.strategies.set(strategy.type, strategy);
    }
  }

  get(type: FieldType): FieldTypeStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`No field type strategy registered for ${type}`);
    }
    return strategy;
  }
}
