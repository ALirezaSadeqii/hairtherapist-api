import { BadRequestException } from '@nestjs/common';
import {
  formatCalendarDate,
  parseCalendarDate,
  parseMonth,
} from './date.util';

describe('date.util', () => {
  describe('parseCalendarDate', () => {
    it('should parse valid YYYY-MM-DD calendar dates', () => {
      const date = parseCalendarDate('2026-10-15');
      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(9); // 0-indexed (October = 9)
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
    });

    it('should reject malformed date strings', () => {
      expect(() => parseCalendarDate('15-10-2026')).toThrow(BadRequestException);
      expect(() => parseCalendarDate('2026/10/15')).toThrow(BadRequestException);
      expect(() => parseCalendarDate('2026-1-5')).toThrow(BadRequestException);
      expect(() => parseCalendarDate('invalid-date')).toThrow(BadRequestException);
      expect(() => parseCalendarDate('')).toThrow(BadRequestException);
    });

    it('should reject invalid calendar dates like April 31st', () => {
      expect(() => parseCalendarDate('2026-04-31')).toThrow(BadRequestException);
    });

    it('should reject February 29th on a non-leap year', () => {
      expect(() => parseCalendarDate('2025-02-29')).toThrow(BadRequestException);
      expect(() => parseCalendarDate('2026-02-29')).toThrow(BadRequestException);
    });

    it('should accept February 29th on leap years', () => {
      const leapDate2024 = parseCalendarDate('2024-02-29');
      expect(leapDate2024.getUTCDate()).toBe(29);

      const leapDate2028 = parseCalendarDate('2028-02-29');
      expect(leapDate2028.getUTCDate()).toBe(29);
    });
  });

  describe('formatCalendarDate', () => {
    it('should format a UTC midnight date to YYYY-MM-DD string', () => {
      const date = new Date(Date.UTC(2026, 9, 15, 0, 0, 0));
      expect(formatCalendarDate(date)).toBe('2026-10-15');
    });

    it('should preserve UTC date regardless of time of day', () => {
      const date = new Date(Date.UTC(2026, 9, 15, 23, 59, 59));
      expect(formatCalendarDate(date)).toBe('2026-10-15');
    });

    it('should format ISO string without timezone shift', () => {
      expect(formatCalendarDate('2026-10-15T00:00:00.000Z')).toBe('2026-10-15');
    });
  });

  describe('parseMonth', () => {
    it('should parse 31-day months correctly', () => {
      const parsed = parseMonth('2026-10');
      expect(parsed.year).toBe(2026);
      expect(parsed.month).toBe(10);
      expect(parsed.daysInMonth).toBe(31);
      expect(parsed.allDays.length).toBe(31);
      expect(parsed.allDays[0]).toBe('2026-10-01');
      expect(parsed.allDays[30]).toBe('2026-10-31');
      expect(formatCalendarDate(parsed.startDate)).toBe('2026-10-01');
      expect(formatCalendarDate(parsed.endDate)).toBe('2026-10-31');
    });

    it('should parse 30-day months correctly', () => {
      const parsed = parseMonth('2026-04');
      expect(parsed.daysInMonth).toBe(30);
      expect(parsed.allDays.length).toBe(30);
      expect(parsed.allDays[29]).toBe('2026-04-30');
    });

    it('should parse February in a non-leap year (28 days)', () => {
      const parsed = parseMonth('2026-02');
      expect(parsed.daysInMonth).toBe(28);
      expect(parsed.allDays.length).toBe(28);
    });

    it('should parse February in a leap year (29 days)', () => {
      const parsed = parseMonth('2024-02');
      expect(parsed.daysInMonth).toBe(29);
      expect(parsed.allDays.length).toBe(29);
    });

    it('should reject invalid month formats', () => {
      expect(() => parseMonth('2026-13')).toThrow(BadRequestException);
      expect(() => parseMonth('2026-00')).toThrow(BadRequestException);
      expect(() => parseMonth('2026/10')).toThrow(BadRequestException);
      expect(() => parseMonth('October 2026')).toThrow(BadRequestException);
    });
  });
});
