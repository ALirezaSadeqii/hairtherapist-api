import { BadRequestException } from '@nestjs/common';

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Validates and parses a calendar date string (YYYY-MM-DD) into a UTC midnight Date.
 * Rejects invalid dates such as February 30th or April 31st, taking leap years into account.
 */
export function parseCalendarDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr)) {
    throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD.');
  }

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed (1-12)
  const day = parseInt(dayStr, 10);

  // Validate days in that specific month and year (leap year aware)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) {
    throw new BadRequestException(
      `Invalid calendar date: ${dateStr}. Month ${month} only has ${daysInMonth} days in year ${year}.`,
    );
  }

  // Construct UTC midnight date for date-only database semantics
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Formats a Date object or ISO string to a calendar date string (YYYY-MM-DD) using UTC values.
 * Prevents any timezone shift from altering the calendar date.
 */
export function formatCalendarDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    throw new BadRequestException('Invalid date provided for formatting.');
  }
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ParsedMonth {
  year: number;
  month: number;
  monthString: string;
  daysInMonth: number;
  startDate: Date;
  endDate: Date;
  allDays: string[];
}

/**
 * Validates and parses a month string (YYYY-MM) and computes boundaries and date list.
 */
export function parseMonth(monthStr: string): ParsedMonth {
  if (!monthStr || typeof monthStr !== 'string' || !MONTH_REGEX.test(monthStr)) {
    throw new BadRequestException('Invalid month format. Expected YYYY-MM (e.g. 2026-10).');
  }

  const [yearStr, monthStrNum] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStrNum, 10); // 1-indexed

  // Days in month: passing month 0 of next month returns last day of current month in UTC
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 0, 0, 0, 0));

  const allDays: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    allDays.push(`${yearStr}-${monthStrNum}-${dayStr}`);
  }

  return {
    year,
    month,
    monthString: monthStr,
    daysInMonth,
    startDate,
    endDate,
    allDays,
  };
}
