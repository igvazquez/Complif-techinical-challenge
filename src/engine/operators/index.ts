import { Engine } from 'json-rules-engine';
import { aggregationOperators } from './aggregation.operator';
import { listOperators } from './list.operator';
import { geolocationOperators } from './geolocation.operator';

export * from './aggregation.operator';
export * from './list.operator';
export * from './geolocation.operator';

export function registerAllOperators(engine: Engine): void {
  // Register aggregation operators
  for (const operator of aggregationOperators) {
    engine.addOperator(operator);
  }

  // Register list operators
  for (const operator of listOperators) {
    engine.addOperator(operator);
  }

  // Register geolocation operators
  for (const operator of geolocationOperators) {
    engine.addOperator(operator);
  }
}

export const allOperators = [
  ...aggregationOperators,
  ...listOperators,
  ...geolocationOperators,
];
