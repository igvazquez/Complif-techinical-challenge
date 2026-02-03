import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { OrganizationId } from '../common/decorators/organization.decorator';
import { ListsService } from './lists.service';
import { CreateListEntryDto, ListEntryQueryDto } from './dto';
import { ListEntry } from './entities/list-entry.entity';
import { PaginatedResult } from '../common/interfaces';

@ApiTags('lists')
@Controller('lists')
@UseGuards(OrganizationGuard)
@ApiHeader({
  name: 'x-organization-id',
  description: 'Organization UUID',
  required: true,
})
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new list entry' })
  @ApiResponse({
    status: 201,
    description: 'List entry created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Entry already exists',
  })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateListEntryDto,
  ): Promise<ListEntry> {
    return this.listsService.create(organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List entries with optional filters' })
  findAll(
    @OrganizationId() organizationId: string,
    @Query() query: ListEntryQueryDto,
  ): Promise<PaginatedResult<ListEntry>> {
    return this.listsService.findByOrganization(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get list entry by ID' })
  @ApiParam({ name: 'id', description: 'List entry UUID' })
  @ApiResponse({
    status: 200,
    description: 'List entry found',
  })
  @ApiResponse({
    status: 404,
    description: 'List entry not found',
  })
  findOne(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ListEntry> {
    return this.listsService.findOne(organizationId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a list entry' })
  @ApiParam({ name: 'id', description: 'List entry UUID' })
  @ApiResponse({
    status: 204,
    description: 'List entry deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'List entry not found',
  })
  remove(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.listsService.remove(organizationId, id);
  }
}
