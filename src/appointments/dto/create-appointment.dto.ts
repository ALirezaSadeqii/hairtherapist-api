import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'Full name of the customer',
    example: 'Alice Smith',
    maxLength: 100,
  })
  @IsString({ message: 'Customer name must be a string.' })
  @IsNotEmpty({ message: 'Customer name is required.' })
  @MaxLength(100, { message: 'Customer name cannot exceed 100 characters.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  customerName!: string;

  @ApiPropertyOptional({
    description: 'Optional customer contact email address',
    example: 'alice@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'A valid email address is required if provided.' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim().toLowerCase()
      : null,
  )
  email?: string | null;

  @ApiProperty({
    description: 'Mandatory customer phone number (format: 523 434 1223)',
    example: '523 434 1223',
  })
  @IsNotEmpty({ message: 'Phone number is required.' })
  @IsString({ message: 'Phone number must be a string.' })
  @Matches(/^\d{3} \d{3} \d{4}$/, {
    message: 'Phone number must follow the format 523 434 1223.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  phone!: string;

  @ApiProperty({
    description: 'Appointment calendar date (YYYY-MM-DD)',
    example: '2026-10-15',
  })
  @IsNotEmpty({ message: 'Appointment date is required.' })
  @IsString({ message: 'Appointment date must be a string in YYYY-MM-DD format.' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'Date must be a valid calendar date in YYYY-MM-DD format.',
  })
  date!: string;
}
