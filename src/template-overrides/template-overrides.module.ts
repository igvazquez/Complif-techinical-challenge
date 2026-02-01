import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateOverride } from './entities/template-override.entity';
import { TemplateOverridesService } from './template-overrides.service';
import { TemplateOverridesController } from './template-overrides.controller';
import { RuleTemplatesModule } from '../rule-templates/rule-templates.module';

@Module({
  imports: [TypeOrmModule.forFeature([TemplateOverride]), RuleTemplatesModule],
  controllers: [TemplateOverridesController],
  providers: [TemplateOverridesService],
  exports: [TemplateOverridesService],
})
export class TemplateOverridesModule {}
