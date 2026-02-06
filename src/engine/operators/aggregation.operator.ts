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

export const maxGreaterThan = new Operator(
  'maxGreaterThan',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue > compareValue;
  },
);

export const maxGreaterThanOrEqual = new Operator(
  'maxGreaterThanOrEqual',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue >= compareValue;
  },
);

export const minLessThan = new Operator(
  'minLessThan',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue < compareValue;
  },
);

export const minLessThanOrEqual = new Operator(
  'minLessThanOrEqual',
  (factValue: number, compareValue: number): boolean => {
    if (typeof factValue !== 'number' || typeof compareValue !== 'number') {
      return false;
    }
    return factValue <= compareValue;
  },
);

export const amountBetween = new Operator(
  'amountBetween',
  (factValue: number, compareValue: { min: number; max: number }): boolean => {
    if (
      typeof factValue !== 'number' ||
      !compareValue ||
      typeof compareValue.min !== 'number' ||
      typeof compareValue.max !== 'number'
    ) {
      return false;
    }
    return factValue >= compareValue.min && factValue <= compareValue.max;
  },
);

export const aggregationOperators = [
  sumGreaterThan,
  sumGreaterThanOrEqual,
  countGreaterThan,
  countGreaterThanOrEqual,
  avgGreaterThan,
  avgGreaterThanOrEqual,
  maxGreaterThan,
  maxGreaterThanOrEqual,
  minLessThan,
  minLessThanOrEqual,
  amountBetween,
];
