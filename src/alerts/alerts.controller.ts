import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiParam } from '@nestjs/swagger';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { OrganizationId } from '../common/decorators/organization.decorator';
import { AlertsService } from './alerts.service';
import { AlertQueryDto, UpdateAlertStatusDto } from './dto';
import { Alert } from './entities/alert.entity';
import { PaginatedResult } from '../common/interfaces';

@ApiTags('alerts')
@Controller('alerts')
@UseGuards(OrganizationGuard)
@ApiHeader({
  name: 'x-organization-id',
  description: 'Organization UUID',
  required: true,
})
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List alerts with optional filters' })
  findAll(
    @OrganizationId() organizationId: string,
    @Query() query: AlertQueryDto,
  ): Promise<PaginatedResult<Alert>> {
    return this.alertsService.findByOrganization(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert details by ID' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  findOne(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Alert> {
    return this.alertsService.findOne(organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update alert status' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  updateStatus(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAlertStatusDto,
  ): Promise<Alert> {
    return this.alertsService.updateStatus(organizationId, id, updateDto);
  }
}
