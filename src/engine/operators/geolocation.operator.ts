import { Operator } from 'json-rules-engine';

export const inCountry = new Operator(
  'inCountry',
  (factValue: string | undefined, compareValue: string | string[]): boolean => {
    if (typeof factValue !== 'string' || !factValue) {
      return false;
    }

    const normalizedFact = factValue.toUpperCase();

    if (Array.isArray(compareValue)) {
      return compareValue
        .map((c) => (typeof c === 'string' ? c.toUpperCase() : ''))
        .includes(normalizedFact);
    }

    if (typeof compareValue !== 'string') {
      return false;
    }

    return normalizedFact === compareValue.toUpperCase();
  },
);

export const notInCountry = new Operator(
  'notInCountry',
  (factValue: string | undefined, compareValue: string | string[]): boolean => {
    if (typeof factValue !== 'string' || !factValue) {
      return true; // If no country, consider not in list
    }

    const normalizedFact = factValue.toUpperCase();

    if (Array.isArray(compareValue)) {
      return !compareValue
        .map((c) => (typeof c === 'string' ? c.toUpperCase() : ''))
        .includes(normalizedFact);
    }

    if (typeof compareValue !== 'string') {
      return true;
    }

    return normalizedFact !== compareValue.toUpperCase();
  },
);

export const isHighRiskCountry = new Operator(
  'isHighRiskCountry',
  (factValue: string | undefined, highRiskList: string[]): boolean => {
    if (typeof factValue !== 'string' || !factValue) {
      return false;
    }

    if (!Array.isArray(highRiskList)) {
      return false;
    }

    const normalizedFact = factValue.toUpperCase();
    return highRiskList
      .map((c) => (typeof c === 'string' ? c.toUpperCase() : ''))
      .includes(normalizedFact);
  },
);

export const geolocationOperators = [
  inCountry,
  notInCountry,
  isHighRiskCountry,
];
