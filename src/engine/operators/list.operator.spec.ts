/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  inBlacklist,
  notInBlacklist,
  inWhitelist,
  notInWhitelist,
  containsValue,
  notContainsValue,
} from './list.operator';

describe('List Operators', () => {
  describe('inBlacklist', () => {
    it('should return true when factValue matches compareValue', () => {
      expect(inBlacklist.cb(true, true)).toBe(true);
      expect(inBlacklist.cb(false, false)).toBe(true);
    });

    it('should return false when factValue does not match compareValue', () => {
      expect(inBlacklist.cb(false, true)).toBe(false);
      expect(inBlacklist.cb(true, false)).toBe(false);
    });

    it('should have correct operator name', () => {
      expect(inBlacklist.name).toBe('inBlacklist');
    });
  });

  describe('notInBlacklist', () => {
    it('should return true when factValue differs from compareValue', () => {
      expect(notInBlacklist.cb(false, true)).toBe(true);
      expect(notInBlacklist.cb(true, false)).toBe(true);
    });

    it('should return false when factValue matches compareValue', () => {
      expect(notInBlacklist.cb(true, true)).toBe(false);
      expect(notInBlacklist.cb(false, false)).toBe(false);
    });
  });

  describe('inWhitelist', () => {
    it('should return true when factValue matches compareValue', () => {
      expect(inWhitelist.cb(true, true)).toBe(true);
    });

    it('should return false when factValue does not match compareValue', () => {
      expect(inWhitelist.cb(false, true)).toBe(false);
    });
  });

  describe('notInWhitelist', () => {
    it('should return true when factValue differs from compareValue', () => {
      expect(notInWhitelist.cb(false, true)).toBe(true);
    });

    it('should return false when factValue matches compareValue', () => {
      expect(notInWhitelist.cb(true, true)).toBe(false);
    });
  });

  describe('containsValue', () => {
    it('should return true when array contains value', () => {
      expect(containsValue.cb(['a', 'b', 'c'], 'b')).toBe(true);
      expect(containsValue.cb([1, 2, 3], 2)).toBe(true);
    });

    it('should return false when array does not contain value', () => {
      expect(containsValue.cb(['a', 'b', 'c'], 'd')).toBe(false);
      expect(containsValue.cb([1, 2, 3], 4)).toBe(false);
    });

    it('should return false for non-array factValue', () => {
      expect(containsValue.cb('abc' as unknown as unknown[], 'a')).toBe(false);
      expect(containsValue.cb(null as unknown as unknown[], 'a')).toBe(false);
    });

    it('should handle empty arrays', () => {
      expect(containsValue.cb([], 'a')).toBe(false);
    });

    it('should have correct operator name', () => {
      expect(containsValue.name).toBe('containsValue');
    });
  });

  describe('notContainsValue', () => {
    it('should return true when array does not contain value', () => {
      expect(notContainsValue.cb(['a', 'b', 'c'], 'd')).toBe(true);
    });

    it('should return false when array contains value', () => {
      expect(notContainsValue.cb(['a', 'b', 'c'], 'b')).toBe(false);
    });

    it('should return true for non-array factValue', () => {
      expect(notContainsValue.cb('abc' as unknown as unknown[], 'a')).toBe(
        true,
      );
      expect(notContainsValue.cb(null as unknown as unknown[], 'a')).toBe(true);
    });

    it('should return true for empty arrays', () => {
      expect(notContainsValue.cb([], 'a')).toBe(true);
    });
  });
});
