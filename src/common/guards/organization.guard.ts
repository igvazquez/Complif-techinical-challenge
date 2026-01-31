import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { validate as isValidUUID } from 'uuid';
import { ORGANIZATION_HEADER } from '../decorators/organization.decorator';

@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const organizationId = request.headers[ORGANIZATION_HEADER];

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
