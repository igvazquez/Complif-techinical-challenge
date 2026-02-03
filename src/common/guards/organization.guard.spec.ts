import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { OrganizationGuard } from './organization.guard';
import { ORGANIZATION_HEADER } from '../decorators/organization.decorator';

describe('OrganizationGuard', () => {
  let guard: OrganizationGuard;

  beforeEach(() => {
    guard = new OrganizationGuard();
  });

  const createMockExecutionContext = (
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const mockRequest = {
      headers,
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true and set organizationId for valid UUID', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const mockRequest: {
        headers: Record<string, string>;
        organizationId?: string;
      } = {
        headers: { [ORGANIZATION_HEADER]: validUUID },
      };
      const context = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.organizationId).toBe(validUUID);
    });

    it('should throw BadRequestException when header is missing', () => {
      const context = createMockExecutionContext({});

      expect(() => guard.canActivate(context)).toThrow(BadRequestException);
      expect(() => guard.canActivate(context)).toThrow(
        `Missing required header: ${ORGANIZATION_HEADER}`,
      );
    });

    it('should throw BadRequestException for invalid UUID format', () => {
      const context = createMockExecutionContext({
        [ORGANIZATION_HEADER]: 'invalid-uuid',
      });

      expect(() => guard.canActivate(context)).toThrow(BadRequestException);
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid organization ID format. Expected UUID.',
      );
    });

    it('should throw BadRequestException for empty string', () => {
      const context = createMockExecutionContext({
        [ORGANIZATION_HEADER]: '',
      });

      expect(() => guard.canActivate(context)).toThrow(BadRequestException);
    });
  });
});
