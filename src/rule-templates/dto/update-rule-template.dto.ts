import { PartialType } from '@nestjs/swagger';
import { CreateRuleTemplateDto } from './create-rule-template.dto';

export class UpdateRuleTemplateDto extends PartialType(CreateRuleTemplateDto) {}
