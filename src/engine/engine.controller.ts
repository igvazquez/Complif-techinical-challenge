import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiParam } from '@nestjs/swagger';
import { EngineService } from './engine.service';
import { EvaluateTransactionDto } from './dto';
import { EvaluationResult } from './interfaces';
import { OrganizationGuard } from '../common/guards';
import { OrganizationId } from '../common/decorators';

@ApiTags('engine')
@Controller('engine')
@UseGuards(OrganizationGuard)
@ApiHeader({
  name: 'x-organization-id',
  description: 'Organization ID',
  required: true,
})
export class EngineController {
  constructor(private readonly engineService: EngineService) {}

  @Post('evaluate')
  @ApiOperation({
    summary: 'Evaluate transaction against all enabled rules',
    description:
      'Evaluates the provided transaction against all enabled rules for the organization, ordered by priority. Returns triggered events and any failed rules.',
  })
  async evaluate(
    @OrganizationId() organizationId: string,
    @Body() dto: EvaluateTransactionDto,
  ): Promise<EvaluationResult> {
    return this.engineService.evaluate(organizationId, {
      transaction: {
        ...dto.transaction,
        datetime: new Date(dto.transaction.datetime),
      },
      account: dto.account,
      metadata: dto.metadata,
    });
  }

  @Post('evaluate/:ruleId')
  @ApiOperation({
    summary: 'Evaluate transaction against a specific rule',
    description:
      'Evaluates the provided transaction against a single rule. Useful for testing and debugging rules.',
  })
  @ApiParam({ name: 'ruleId', description: 'Rule ID to evaluate' })
  async evaluateRule(
    @OrganizationId() organizationId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: EvaluateTransactionDto,
  ): Promise<EvaluationResult> {
    return this.engineService.evaluateRule(organizationId, ruleId, {
      transaction: {
        ...dto.transaction,
        datetime: new Date(dto.transaction.datetime),
      },
      account: dto.account,
      metadata: dto.metadata,
    });
  }
}
