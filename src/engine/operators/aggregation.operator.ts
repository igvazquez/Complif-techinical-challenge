import { Operator } from 'json-rules-engine';

export const sumGreaterThan = new Operator(
  'sumGreaterThan',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue > compareValue;
  },
);

export const sumGreaterThanOrEqual = new Operator(
  'sumGreaterThanOrEqual',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue >= compareValue;
  },
);

export const countGreaterThan = new Operator(
  'countGreaterThan',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue > compareValue;
  },
);

export const countGreaterThanOrEqual = new Operator(
  'countGreaterThanOrEqual',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue >= compareValue;
  },
);

export const avgGreaterThan = new Operator(
  'avgGreaterThan',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue > compareValue;
  },
);

export const avgGreaterThanOrEqual = new Operator(
  'avgGreaterThanOrEqual',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue >= compareValue;
  },
);

export const aggregationOperators = [
  sumGreaterThan,
  sumGreaterThanOrEqual,
  countGreaterThan,
  countGreaterThanOrEqual,
  avgGreaterThan,
  avgGreaterThanOrEqual,
];
