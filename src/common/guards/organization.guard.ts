import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
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

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(organizationId)) {
      throw new BadRequestException(
        `Invalid organization ID format. Expected UUID.`,
      );
    }

    request.organizationId = organizationId;
    return true;
  }
}
