import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuleTemplate } from './entities/rule-template.entity';
import { RuleTemplatesService } from './rule-templates.service';
import { RuleTemplatesController } from './rule-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RuleTemplate])],
  controllers: [RuleTemplatesController],
  providers: [RuleTemplatesService],
  exports: [RuleTemplatesService],
})
export class RuleTemplatesModule {}
