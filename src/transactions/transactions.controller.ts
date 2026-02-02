import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, TransactionResponseDto } from './dto';
import { Transaction } from './entities/transaction.entity';
import { PaginationQueryDto } from '../common/dto';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { OrganizationId } from '../common/decorators/organization.decorator';
import type { PaginatedResult } from '../common/interfaces';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(OrganizationGuard)
@ApiHeader({
  name: 'x-organization-id',
  description: 'Organization UUID',
  required: true,
})
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and evaluate a transaction' })
  @ApiResponse({
    status: 201,
    description: 'Transaction created and evaluated successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(
    @OrganizationId() organizationId: string,
    @Body() createDto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.createAndEvaluate(
      organizationId,
      createDto,
      'api',
    );
  }

  @Get()
  @ApiOperation({ summary: 'List transactions for organization' })
  @ApiResponse({
    status: 200,
    description: 'List of transactions',
  })
  findAll(
    @OrganizationId() organizationId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<Transaction>> {
    return this.transactionsService.findByOrganization(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction found',
    type: Transaction,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(
    @OrganizationId() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Transaction> {
    return this.transactionsService.findOne(organizationId, id);
  }
}
