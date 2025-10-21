import { describe, it, expect, beforeEach } from 'vitest';
import { formatDetailDate, toUtc } from './date-uitil.js';

describe('dateUtil - Real Unit Tests', () => {
	describe('formatDetailDate', () => {
		it('should format timestamp to YYYY-MM-DD HH:mm:ss', () => {
			const timestamp = new Date('2025-01-15T14:30:45Z').getTime();
			const result = formatDetailDate(timestamp);

			expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
			expect(result).toBe('2025-01-15 14:30:45');
		});

		it('should format ISO string correctly', () => {
			const isoString = '2025-01-15T14:30:45Z';
			const result = formatDetailDate(isoString);

			expect(result).toBe('2025-01-15 14:30:45');
		});

		it('should format date object correctly', () => {
			const date = new Date('2025-06-20T09:15:30Z');
			const result = formatDetailDate(date);

			expect(result).toBe('2025-06-20 09:15:30');
		});

		it('should handle current date', () => {
			const now = new Date();
			const result = formatDetailDate(now);
			
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
		});

		it('should handle date string', () => {
			const result = formatDetailDate('2025-12-25');
			
			expect(result).toContain('2025-12-25');
		});

		it('should handle different months', () => {
			const dates = [
				{ input: '2025-01-01', expected: '2025-01-01' },
				{ input: '2025-06-15', expected: '2025-06-15' },
				{ input: '2025-12-31', expected: '2025-12-31' }
			];

			dates.forEach(({ input, expected }) => {
				const result = formatDetailDate(input);
				expect(result).toContain(expected);
			});
		});

		it('should handle different times', () => {
			const times = [
				{ input: '2025-01-01T00:00:00Z', expected: '2025-01-01 00:00:00' },
				{ input: '2025-06-15T12:30:45Z', expected: '2025-06-15 12:30:45' },
				{ input: '2025-12-31T23:59:59Z', expected: '2025-12-31 23:59:59' }
			];

			times.forEach(({ input, expected }) => {
				const result = formatDetailDate(input);
				expect(result).toBe(expected);
			});
		});

		it('should maintain consistent format', () => {
			const date1 = formatDetailDate('2025-01-15T14:30:45Z');
			const date2 = formatDetailDate('2025-06-20T09:15:30Z');
			
			// Both should have the same format structure
			expect(date1).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
			expect(date2).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
		});
	});

	describe('toUtc', () => {
		it('should convert timestamp to UTC', () => {
			const timestamp = new Date('2025-01-15T14:30:45Z').getTime();
			const result = toUtc(timestamp);
			
			expect(result).toBeDefined();
			expect(result.isUTC()).toBe(true);
		});

		it('should convert ISO string to UTC', () => {
			const isoString = '2025-01-15T14:30:45Z';
			const result = toUtc(isoString);
			
			expect(result).toBeDefined();
			expect(result.isUTC()).toBe(true);
		});

		it('should convert date object to UTC', () => {
			const date = new Date('2025-01-15T14:30:45Z');
			const result = toUtc(date);
			
			expect(result).toBeDefined();
			expect(result.isUTC()).toBe(true);
		});

		it('should use current time when no argument provided', () => {
			const result = toUtc();
			
			expect(result).toBeDefined();
			expect(result.isUTC()).toBe(true);
		});

		it('should use current time when null is provided', () => {
			const result = toUtc(null);
			
			expect(result).toBeDefined();
			expect(result.isUTC()).toBe(true);
		});

		it('should use current time when undefined is provided', () => {
			const result = toUtc(undefined);
			
			expect(result).toBeDefined();
			expect(result.isUTC()).toBe(true);
		});

		it('should preserve date values in UTC', () => {
			const isoString = '2025-06-20T14:30:45Z';
			const result = toUtc(isoString);
			
			expect(result.year()).toBe(2025);
			expect(result.month()).toBe(5); // dayjs uses 0-based months
			expect(result.date()).toBe(20);
		});

		it('should preserve time values in UTC', () => {
			const isoString = '2025-01-15T14:30:45Z';
			const result = toUtc(isoString);
			
			expect(result.hour()).toBe(14);
			expect(result.minute()).toBe(30);
			expect(result.second()).toBe(45);
		});

		it('should handle different date formats', () => {
			const dates = [
				'2025-01-01',
				'2025-01-01T00:00:00Z',
				new Date('2025-01-01'),
				new Date('2025-01-01').getTime()
			];

			dates.forEach(date => {
				const result = toUtc(date);
				expect(result).toBeDefined();
				expect(result.isUTC()).toBe(true);
			});
		});

		it('should return dayjs object with UTC methods', () => {
			const result = toUtc('2025-01-15T14:30:45Z');
			
			expect(result.format).toBeDefined();
			expect(result.year).toBeDefined();
			expect(result.month).toBeDefined();
			expect(result.date).toBeDefined();
			expect(result.hour).toBeDefined();
			expect(result.minute).toBeDefined();
			expect(result.second).toBeDefined();
		});
	});

	describe('Integration Tests', () => {
		it('should format UTC date correctly', () => {
			const utcDate = toUtc('2025-01-15T14:30:45Z');
			const formatted = formatDetailDate(utcDate);
			
			expect(formatted).toContain('2025-01-15');
			expect(formatted).toContain('14:30:45');
		});

		it('should handle round-trip conversion', () => {
			const originalDate = '2025-06-20T09:15:30Z';
			const utcDate = toUtc(originalDate);
			const formatted = formatDetailDate(utcDate);
			
			expect(formatted).toContain('2025-06-20');
			expect(formatted).toContain('09:15:30');
		});

		it('should maintain consistency across multiple conversions', () => {
			const date = '2025-01-15T14:30:45Z';
			const utc1 = toUtc(date);
			const utc2 = toUtc(date);
			
			const formatted1 = formatDetailDate(utc1);
			const formatted2 = formatDetailDate(utc2);
			
			expect(formatted1).toBe(formatted2);
		});
	});

	describe('Edge Cases', () => {
		it('should handle leap year dates', () => {
			const leapDate = '2024-02-29T12:00:00Z';
			const result = formatDetailDate(leapDate);
			
			expect(result).toContain('2024-02-29');
		});

		it('should handle year boundaries', () => {
			const dates = [
				'2024-12-31T23:59:59Z',
				'2025-01-01T00:00:00Z'
			];

			dates.forEach(date => {
				const result = formatDetailDate(date);
				expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
			});
		});

		it('should handle very old dates', () => {
			const oldDate = '1970-01-01T00:00:00Z';
			const result = formatDetailDate(oldDate);
			
			expect(result).toContain('1970-01-01');
		});

		it('should handle future dates', () => {
			const futureDate = '2050-06-15T12:30:45Z';
			const result = formatDetailDate(futureDate);

			expect(result).toBe('2050-06-15 12:30:45');
		});
	});
});

