import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { validate as isValidUUID } from 'uuid';
import { ORGANIZATION_HEADER } from '../decorators/organization.decorator';

interface RequestWithOrganization extends Request {
  organizationId?: string;
}

@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOrganization>();
    const organizationId = request.headers[ORGANIZATION_HEADER] as
      | string
      | undefined;

    if (!organizationId) {
      throw new BadRequestException(
        `Missing required header: ${ORGANIZATION_HEADER}`,
      );
    }

    if (!isValidUUID(organizationId)) {
      throw new BadRequestException(
        `Invalid organization ID format. Expected UUID.`,
      );
    }

    request.organizationId = organizationId;
    return true;
  }
}
