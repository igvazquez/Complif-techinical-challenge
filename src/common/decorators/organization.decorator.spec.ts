import { ORGANIZATION_HEADER, OrganizationId } from './organization.decorator';

describe('Organization Decorator', () => {
  describe('ORGANIZATION_HEADER', () => {
    it('should have correct header name', () => {
      expect(ORGANIZATION_HEADER).toBe('x-organization-id');
    });
  });

  describe('OrganizationId', () => {
    it('should be a decorator function', () => {
      expect(OrganizationId).toBeDefined();
      expect(typeof OrganizationId).toBe('function');
    });
  });
});
