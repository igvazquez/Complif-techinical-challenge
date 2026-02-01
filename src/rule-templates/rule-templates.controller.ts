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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RuleTemplatesService } from './rule-templates.service';
import { CreateRuleTemplateDto, UpdateRuleTemplateDto } from './dto';
import { RuleTemplate } from './entities/rule-template.entity';
import { PaginationQueryDto } from '../common/dto';
import type { PaginatedResult } from '../common/interfaces';

@ApiTags('rule-templates')
@Controller('rule-templates')
export class RuleTemplatesController {
  constructor(private readonly ruleTemplatesService: RuleTemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new rule template' })
  @ApiResponse({
    status: 201,
    description: 'Rule template created successfully',
    type: RuleTemplate,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(@Body() createDto: CreateRuleTemplateDto): Promise<RuleTemplate> {
    return this.ruleTemplatesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all rule templates with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of rule templates',
  })
  findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<RuleTemplate>> {
    return this.ruleTemplatesService.findAll(query);
  }

  @Get('defaults')
  @ApiOperation({ summary: 'Get all default rule templates' })
  @ApiResponse({
    status: 200,
    description: 'List of default rule templates',
    type: [RuleTemplate],
  })
  findDefaults(): Promise<RuleTemplate[]> {
    return this.ruleTemplatesService.findDefaults();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a rule template by ID' })
  @ApiParam({ name: 'id', description: 'Rule template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Rule template found',
    type: RuleTemplate,
  })
  @ApiResponse({ status: 404, description: 'Rule template not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RuleTemplate> {
    return this.ruleTemplatesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a rule template' })
  @ApiParam({ name: 'id', description: 'Rule template UUID' })
  @ApiResponse({
    status: 200,
    description: 'Rule template updated successfully',
    type: RuleTemplate,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Rule template not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateRuleTemplateDto,
  ): Promise<RuleTemplate> {
    return this.ruleTemplatesService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a rule template' })
  @ApiParam({ name: 'id', description: 'Rule template UUID' })
  @ApiResponse({
    status: 204,
    description: 'Rule template deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Rule template not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.ruleTemplatesService.remove(id);
  }
}
