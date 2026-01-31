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
import { RulesService } from './rules.service';
import { CreateRuleDto, UpdateRuleDto } from './dto';
import { Rule } from './entities/rule.entity';
import { PaginationQueryDto } from '../common/dto';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { OrganizationId } from '../common/decorators/organization.decorator';
import type { PaginatedResult } from '../common/interfaces';

@ApiTags('rules')
@Controller('rules')
@UseGuards(OrganizationGuard)
@ApiHeader({
  name: 'x-organization-id',
  description: 'Organization UUID',
  required: true,
})
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new rule' })
  @ApiResponse({
    status: 201,
    description: 'Rule created successfully',
    type: Rule,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(
    @OrganizationId() organizationId: string,
    @Body() createDto: CreateRuleDto,
  ): Promise<Rule> {
    return this.rulesService.create(organizationId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all rules for organization' })
  @ApiResponse({
    status: 200,
    description: 'List of rules',
  })
  findAll(
    @OrganizationId() organizationId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<Rule>> {
    return this.rulesService.findAll(organizationId, query);
  }

  @Get('enabled')
  @ApiOperation({ summary: 'Get all enabled rules sorted by priority' })
  @ApiResponse({
    status: 200,
    description: 'List of enabled rules sorted by priority',
    type: [Rule],
  })
  findEnabledByPriority(
    @OrganizationId() organizationId: string,
  ): Promise<Rule[]> {
    return this.rulesService.findEnabledByPriority(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a rule by ID' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Rule found',
    type: Rule,
  })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  findOne(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Rule> {
    return this.rulesService.findOne(organizationId, id);
  }

  @Get(':id/effective-config')
  @ApiOperation({
    summary:
      'Get effective config for a rule (merged with template and overrides)',
  })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Effective rule configuration',
  })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  getEffectiveConfig(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Record<string, unknown>> {
    return this.rulesService.getEffectiveConfigById(organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Rule updated successfully',
    type: Rule,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  update(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateRuleDto,
  ): Promise<Rule> {
    return this.rulesService.update(organizationId, id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({
    status: 204,
    description: 'Rule deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  remove(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.rulesService.remove(organizationId, id);
  }
}
