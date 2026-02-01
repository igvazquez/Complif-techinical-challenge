import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTemplateOverrideDto } from './create-template-override.dto';

export class UpdateTemplateOverrideDto extends PartialType(
  OmitType(CreateTemplateOverrideDto, ['idTemplate'] as const),
) {}
