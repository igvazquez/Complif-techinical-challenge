import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { TemplateOverridesService } from './template-overrides.service';
import { CreateTemplateOverrideDto, UpdateTemplateOverrideDto } from './dto';
import { TemplateOverride } from './entities/template-override.entity';
import { PaginationQueryDto } from '../common/dto';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { OrganizationId } from '../common/decorators/organization.decorator';
import type { PaginatedResult } from '../common/interfaces';

@ApiTags('template-overrides')
@Controller('template-overrides')
@UseGuards(OrganizationGuard)
@ApiHeader({
  name: 'x-organization-id',
  description: 'Organization UUID',
  required: true,
})
export class TemplateOverridesController {
  constructor(
    private readonly templateOverridesService: TemplateOverridesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new template override' })
  @ApiResponse({
    status: 201,
    description: 'Template override created successfully',
    type: TemplateOverride,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({
    status: 409,
    description: 'Override for this template already exists',
  })
  create(
    @OrganizationId() organizationId: string,
    @Body() createDto: CreateTemplateOverrideDto,
  ): Promise<TemplateOverride> {
    return this.templateOverridesService.create(organizationId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all template overrides for organization' })
  @ApiResponse({
    status: 200,
    description: 'List of template overrides',
  })
  findAll(
    @OrganizationId() organizationId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<TemplateOverride>> {
    return this.templateOverridesService.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template override by ID' })
  @ApiParam({ name: 'id', description: 'Template override UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template override found',
    type: TemplateOverride,
  })
  @ApiResponse({ status: 404, description: 'Template override not found' })
  findOne(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TemplateOverride> {
    return this.templateOverridesService.findOne(organizationId, id);
  }

  @Get('template/:templateId/merged-config')
  @ApiOperation({ summary: 'Get merged config for a template with overrides' })
  @ApiParam({ name: 'templateId', description: 'Rule template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Merged configuration',
  })
  @ApiResponse({ status: 404, description: 'Template not found' })
  getMergedConfig(
    @OrganizationId() organizationId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ): Promise<Record<string, unknown>> {
    return this.templateOverridesService.getMergedConfig(
      organizationId,
      templateId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a template override' })
  @ApiParam({ name: 'id', description: 'Template override UUID' })
  @ApiResponse({
    status: 200,
    description: 'Template override updated successfully',
    type: TemplateOverride,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Template override not found' })
  update(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTemplateOverrideDto,
  ): Promise<TemplateOverride> {
    return this.templateOverridesService.update(organizationId, id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a template override' })
  @ApiParam({ name: 'id', description: 'Template override UUID' })
  @ApiResponse({
    status: 204,
    description: 'Template override deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Template override not found' })
  remove(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.templateOverridesService.remove(organizationId, id);
  }
}
