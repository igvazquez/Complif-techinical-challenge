import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AlertStatus } from '../entities/alert.entity';

export class UpdateAlertStatusDto {
  @ApiProperty({
    description: 'New status for the alert',
    enum: AlertStatus,
    example: AlertStatus.ACKNOWLEDGED,
  })
  @IsEnum(AlertStatus)
  status: AlertStatus;
}
