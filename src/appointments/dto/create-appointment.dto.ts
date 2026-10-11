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

  @ApiProperty({
    description: 'Customer contact email address',
    example: 'alice@example.com',
  })
  @IsEmail({}, { message: 'A valid email address is required.' })
  @IsNotEmpty({ message: 'Email is required.' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiPropertyOptional({
    description: 'Optional phone number',
    example: '+1 (555) 123-4567',
  })
  @IsOptional()
  @IsString({ message: 'Phone must be a string if provided.' })
  @MaxLength(30, { message: 'Phone cannot exceed 30 characters.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null,
  )
  phone?: string | null;

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
