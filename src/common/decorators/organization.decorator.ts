import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const ORGANIZATION_HEADER = 'x-organization-id';

interface RequestWithOrganization extends Request {
  organizationId?: string;
}

export const OrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithOrganization>();
    return (
      (request.headers[ORGANIZATION_HEADER] as string) ||
      request.organizationId ||
      ''
    );
  },
);
