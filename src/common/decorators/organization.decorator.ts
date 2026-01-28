import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ORGANIZATION_HEADER = 'x-organization-id';

export const OrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers[ORGANIZATION_HEADER] || request.organizationId;
  },
);
