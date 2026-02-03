/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  inCountry,
  notInCountry,
  isHighRiskCountry,
} from './geolocation.operator';

describe('Geolocation Operators', () => {
  describe('inCountry', () => {
    it('should return true when country matches single value', () => {
      expect(inCountry.cb('US', 'US')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(inCountry.cb('us', 'US')).toBe(true);
      expect(inCountry.cb('US', 'us')).toBe(true);
    });

    it('should return true when country is in array', () => {
      expect(inCountry.cb('US', ['US', 'CA', 'MX'])).toBe(true);
      expect(inCountry.cb('ca', ['US', 'CA', 'MX'])).toBe(true);
    });

    it('should return false when country does not match', () => {
      expect(inCountry.cb('UK', 'US')).toBe(false);
      expect(inCountry.cb('UK', ['US', 'CA', 'MX'])).toBe(false);
    });

    it('should return false for undefined or empty country', () => {
      expect(inCountry.cb(undefined, 'US')).toBe(false);
      expect(inCountry.cb('', 'US')).toBe(false);
    });

    it('should return false for non-string compareValue', () => {
      expect(inCountry.cb('US', 123 as unknown as string)).toBe(false);
    });

    it('should have correct operator name', () => {
      expect(inCountry.name).toBe('inCountry');
    });
  });

  describe('notInCountry', () => {
    it('should return true when country does not match', () => {
      expect(notInCountry.cb('UK', 'US')).toBe(true);
    });

    it('should return false when country matches', () => {
      expect(notInCountry.cb('US', 'US')).toBe(false);
    });

    it('should return true when country is not in array', () => {
      expect(notInCountry.cb('UK', ['US', 'CA', 'MX'])).toBe(true);
    });

    it('should return false when country is in array', () => {
      expect(notInCountry.cb('US', ['US', 'CA', 'MX'])).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(notInCountry.cb('us', 'US')).toBe(false);
      expect(notInCountry.cb('uk', ['US', 'CA'])).toBe(true);
    });

    it('should return true for undefined or empty country', () => {
      expect(notInCountry.cb(undefined, 'US')).toBe(true);
      expect(notInCountry.cb('', 'US')).toBe(true);
    });

    it('should return true for non-string compareValue', () => {
      expect(notInCountry.cb('US', 123 as unknown as string)).toBe(true);
    });
  });

  describe('isHighRiskCountry', () => {
    const highRiskList = ['IR', 'KP', 'SY', 'CU'];

    it('should return true when country is in high risk list', () => {
      expect(isHighRiskCountry.cb('IR', highRiskList)).toBe(true);
      expect(isHighRiskCountry.cb('KP', highRiskList)).toBe(true);
    });

    it('should return false when country is not in high risk list', () => {
      expect(isHighRiskCountry.cb('US', highRiskList)).toBe(false);
      expect(isHighRiskCountry.cb('UK', highRiskList)).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isHighRiskCountry.cb('ir', highRiskList)).toBe(true);
      expect(isHighRiskCountry.cb('Ir', highRiskList)).toBe(true);
    });

    it('should return false for undefined country', () => {
      expect(isHighRiskCountry.cb(undefined, highRiskList)).toBe(false);
      expect(isHighRiskCountry.cb('', highRiskList)).toBe(false);
    });

    it('should return false for non-array list', () => {
      expect(isHighRiskCountry.cb('IR', 'IR' as unknown as string[])).toBe(
        false,
      );
    });

    it('should have correct operator name', () => {
      expect(isHighRiskCountry.name).toBe('isHighRiskCountry');
    });
  });
});
