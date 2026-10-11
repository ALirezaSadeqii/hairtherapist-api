import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class MonthQueryDto {
  @ApiProperty({
    description: 'Year and month in YYYY-MM format',
    example: '2026-10',
  })
  @IsNotEmpty({ message: 'The month query parameter is required.' })
  @IsString({ message: 'The month query parameter must be a string.' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'The month query parameter must be in YYYY-MM format (e.g. 2026-10).',
  })
  month!: string;
}
