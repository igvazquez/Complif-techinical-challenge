/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  sumGreaterThan,
  sumGreaterThanOrEqual,
  countGreaterThan,
  countGreaterThanOrEqual,
  avgGreaterThan,
  avgGreaterThanOrEqual,
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
});
