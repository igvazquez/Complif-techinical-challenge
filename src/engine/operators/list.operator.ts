import { Operator } from 'json-rules-engine';

export const inBlacklist = new Operator(
  'inBlacklist',
  (factValue: boolean, compareValue: boolean): boolean => {
    // factValue comes from list-lookup fact: true if value is in blacklist
    // compareValue is expected to be true (we want to match when in blacklist)
    return factValue === compareValue;
  },
);

export const notInBlacklist = new Operator(
  'notInBlacklist',
  (factValue: boolean, compareValue: boolean): boolean => {
    // factValue comes from list-lookup fact: true if value is in blacklist
    // We want to return true when factValue is false (not in blacklist)
    return factValue !== compareValue;
  },
);

export const inWhitelist = new Operator(
  'inWhitelist',
  (factValue: boolean, compareValue: boolean): boolean => {
    // factValue comes from list-lookup fact: true if value is in whitelist
    return factValue === compareValue;
  },
);

export const notInWhitelist = new Operator(
  'notInWhitelist',
  (factValue: boolean, compareValue: boolean): boolean => {
    // factValue comes from list-lookup fact: true if value is in whitelist
    return factValue !== compareValue;
  },
);

export const containsValue = new Operator(
  'containsValue',
  (factValue: unknown[], compareValue: unknown): boolean => {
    if (!Array.isArray(factValue)) {
      return false;
    }
    return factValue.includes(compareValue);
  },
);

export const notContainsValue = new Operator(
  'notContainsValue',
  (factValue: unknown[], compareValue: unknown): boolean => {
    if (!Array.isArray(factValue)) {
      return true;
    }
    return !factValue.includes(compareValue);
  },
);

export const listOperators = [
  inBlacklist,
  notInBlacklist,
  inWhitelist,
  notInWhitelist,
  containsValue,
  notContainsValue,
];
