import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rule } from './entities/rule.entity';
import { RulesService } from './rules.service';
import { RulesController } from './rules.controller';
import { TemplateOverridesModule } from '../template-overrides/template-overrides.module';

@Module({
  imports: [TypeOrmModule.forFeature([Rule]), TemplateOverridesModule],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
