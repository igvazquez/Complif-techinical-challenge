/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
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
} from './aggregation.operator';

describe('Aggregation Operators', () => {
  describe('sumGreaterThan', () => {
    it('should return true when factValue > compareValue', () => {
      expect(sumGreaterThan.cb(100, 50)).toBe(true);
    });

    it('should return false when factValue <= compareValue', () => {
      expect(sumGreaterThan.cb(50, 100)).toBe(false);
      expect(sumGreaterThan.cb(100, 100)).toBe(false);
    });

    it('should return false for non-number inputs', () => {
      expect(sumGreaterThan.cb('100' as unknown as number, 50)).toBe(false);
      expect(sumGreaterThan.cb(100, '50' as unknown as number)).toBe(false);
      expect(sumGreaterThan.cb(null as unknown as number, 50)).toBe(false);
    });

    it('should have correct operator name', () => {
      expect(sumGreaterThan.name).toBe('sumGreaterThan');
    });
  });

  describe('sumGreaterThanOrEqual', () => {
    it('should return true when factValue >= compareValue', () => {
      expect(sumGreaterThanOrEqual.cb(100, 50)).toBe(true);
      expect(sumGreaterThanOrEqual.cb(100, 100)).toBe(true);
    });

    it('should return false when factValue < compareValue', () => {
      expect(sumGreaterThanOrEqual.cb(50, 100)).toBe(false);
    });

    it('should return false for non-number inputs', () => {
      expect(sumGreaterThanOrEqual.cb('100' as unknown as number, 50)).toBe(
        false,
      );
    });
  });

  describe('countGreaterThan', () => {
    it('should return true when count > threshold', () => {
      expect(countGreaterThan.cb(10, 5)).toBe(true);
    });

    it('should return false when count <= threshold', () => {
      expect(countGreaterThan.cb(5, 10)).toBe(false);
      expect(countGreaterThan.cb(5, 5)).toBe(false);
    });

    it('should handle zero correctly', () => {
      expect(countGreaterThan.cb(1, 0)).toBe(true);
      expect(countGreaterThan.cb(0, 0)).toBe(false);
    });
  });

  describe('countGreaterThanOrEqual', () => {
    it('should return true when count >= threshold', () => {
      expect(countGreaterThanOrEqual.cb(10, 5)).toBe(true);
      expect(countGreaterThanOrEqual.cb(5, 5)).toBe(true);
    });

    it('should return false when count < threshold', () => {
      expect(countGreaterThanOrEqual.cb(4, 5)).toBe(false);
    });
  });

  describe('avgGreaterThan', () => {
    it('should return true when average > compareValue', () => {
      expect(avgGreaterThan.cb(75.5, 50)).toBe(true);
    });

    it('should return false when average <= compareValue', () => {
      expect(avgGreaterThan.cb(50, 75.5)).toBe(false);
      expect(avgGreaterThan.cb(50, 50)).toBe(false);
    });

    it('should handle decimal values', () => {
      expect(avgGreaterThan.cb(50.001, 50)).toBe(true);
      expect(avgGreaterThan.cb(49.999, 50)).toBe(false);
    });
  });

  describe('avgGreaterThanOrEqual', () => {
    it('should return true when average >= compareValue', () => {
      expect(avgGreaterThanOrEqual.cb(75.5, 50)).toBe(true);
      expect(avgGreaterThanOrEqual.cb(50, 50)).toBe(true);
    });

    it('should return false when average < compareValue', () => {
      expect(avgGreaterThanOrEqual.cb(49.99, 50)).toBe(false);
    });
  });

  describe('maxGreaterThan', () => {
    it('should return true when max > compareValue', () => {
      expect(maxGreaterThan.cb(100, 50)).toBe(true);
    });

    it('should return false when max <= compareValue', () => {
      expect(maxGreaterThan.cb(50, 100)).toBe(false);
      expect(maxGreaterThan.cb(100, 100)).toBe(false);
    });

    it('should return false for non-number inputs', () => {
      expect(maxGreaterThan.cb('100' as unknown as number, 50)).toBe(false);
      expect(maxGreaterThan.cb(100, '50' as unknown as number)).toBe(false);
      expect(maxGreaterThan.cb(null as unknown as number, 50)).toBe(false);
    });

    it('should have correct operator name', () => {
      expect(maxGreaterThan.name).toBe('maxGreaterThan');
    });
  });

  describe('maxGreaterThanOrEqual', () => {
    it('should return true when max >= compareValue', () => {
      expect(maxGreaterThanOrEqual.cb(100, 50)).toBe(true);
      expect(maxGreaterThanOrEqual.cb(100, 100)).toBe(true);
    });

    it('should return false when max < compareValue', () => {
      expect(maxGreaterThanOrEqual.cb(50, 100)).toBe(false);
    });

    it('should return false for non-number inputs', () => {
      expect(maxGreaterThanOrEqual.cb('100' as unknown as number, 50)).toBe(
        false,
      );
    });
  });

  describe('minLessThan', () => {
    it('should return true when min < compareValue', () => {
      expect(minLessThan.cb(50, 100)).toBe(true);
    });

    it('should return false when min >= compareValue', () => {
      expect(minLessThan.cb(100, 50)).toBe(false);
      expect(minLessThan.cb(100, 100)).toBe(false);
    });

    it('should return false for non-number inputs', () => {
      expect(minLessThan.cb('50' as unknown as number, 100)).toBe(false);
      expect(minLessThan.cb(50, '100' as unknown as number)).toBe(false);
      expect(minLessThan.cb(null as unknown as number, 100)).toBe(false);
    });

    it('should have correct operator name', () => {
      expect(minLessThan.name).toBe('minLessThan');
    });

    it('should handle zero correctly', () => {
      expect(minLessThan.cb(0, 1)).toBe(true);
      expect(minLessThan.cb(0, 0)).toBe(false);
    });
  });

  describe('minLessThanOrEqual', () => {
    it('should return true when min <= compareValue', () => {
      expect(minLessThanOrEqual.cb(50, 100)).toBe(true);
      expect(minLessThanOrEqual.cb(100, 100)).toBe(true);
    });

    it('should return false when min > compareValue', () => {
      expect(minLessThanOrEqual.cb(100, 50)).toBe(false);
    });

    it('should return false for non-number inputs', () => {
      expect(minLessThanOrEqual.cb('50' as unknown as number, 100)).toBe(false);
    });

    it('should handle decimal values', () => {
      expect(minLessThanOrEqual.cb(49.999, 50)).toBe(true);
      expect(minLessThanOrEqual.cb(50.001, 50)).toBe(false);
    });
  });

  describe('amountBetween', () => {
    it('should return true when factValue is within range', () => {
      expect(amountBetween.cb(7500, { min: 5000, max: 10000 })).toBe(true);
    });

    it('should return true at exact boundaries', () => {
      expect(amountBetween.cb(5000, { min: 5000, max: 10000 })).toBe(true);
      expect(amountBetween.cb(10000, { min: 5000, max: 10000 })).toBe(true);
    });

    it('should return false when factValue is outside range', () => {
      expect(amountBetween.cb(4999, { min: 5000, max: 10000 })).toBe(false);
      expect(amountBetween.cb(10001, { min: 5000, max: 10000 })).toBe(false);
    });

    it('should return false for non-number factValue', () => {
      expect(
        amountBetween.cb('7500' as unknown as number, {
          min: 5000,
          max: 10000,
        }),
      ).toBe(false);
      expect(
        amountBetween.cb(null as unknown as number, {
          min: 5000,
          max: 10000,
        }),
      ).toBe(false);
    });

    it('should return false for invalid compareValue', () => {
      expect(
        amountBetween.cb(7500, null as unknown as { min: number; max: number }),
      ).toBe(false);
      expect(
        amountBetween.cb(7500, { min: 5000 } as unknown as {
          min: number;
          max: number;
        }),
      ).toBe(false);
      expect(
        amountBetween.cb(7500, { max: 10000 } as unknown as {
          min: number;
          max: number;
        }),
      ).toBe(false);
    });

    it('should have correct operator name', () => {
      expect(amountBetween.name).toBe('amountBetween');
    });
  });
});
