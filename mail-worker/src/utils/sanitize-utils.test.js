import { describe, it, expect } from 'vitest';
import sanitizeUtils from './sanitize-utils.js';

describe('sanitizeUtils - Real Unit Tests', () => {
	describe('escapeHtml', () => {
		it('should escape ampersand', () => {
			const result = sanitizeUtils.escapeHtml('Tom & Jerry');
			expect(result).toBe('Tom &amp; Jerry');
		});

		it('should escape less than', () => {
			const result = sanitizeUtils.escapeHtml('<script>');
			expect(result).toBe('&lt;script&gt;');
		});

		it('should escape greater than', () => {
			const result = sanitizeUtils.escapeHtml('a > b');
			expect(result).toBe('a &gt; b');
		});

		it('should escape double quotes', () => {
			const result = sanitizeUtils.escapeHtml('He said "hello"');
			expect(result).toBe('He said &quot;hello&quot;');
		});

		it('should escape single quotes', () => {
			const result = sanitizeUtils.escapeHtml("It's a test");
			expect(result).toBe('It&#x27;s a test');
		});

		it('should escape forward slash', () => {
			const result = sanitizeUtils.escapeHtml('path/to/file');
			expect(result).toBe('path&#x2F;to&#x2F;file');
		});

		it('should escape multiple special characters', () => {
			const result = sanitizeUtils.escapeHtml('<img src="x" onerror="alert(\'xss\')">');
			expect(result).toBe('&lt;img src=&quot;x&quot; onerror=&quot;alert(&#x27;xss&#x27;)&quot;&gt;');
		});

		it('should return non-string input as-is', () => {
			expect(sanitizeUtils.escapeHtml(123)).toBe(123);
			expect(sanitizeUtils.escapeHtml(null)).toBe(null);
			expect(sanitizeUtils.escapeHtml(undefined)).toBe(undefined);
		});

		it('should handle empty string', () => {
			const result = sanitizeUtils.escapeHtml('');
			expect(result).toBe('');
		});

		it('should handle string with no special characters', () => {
			const result = sanitizeUtils.escapeHtml('Hello World');
			expect(result).toBe('Hello World');
		});
	});

	describe('sanitizeInput', () => {
		it('should remove control characters', () => {
			const result = sanitizeUtils.sanitizeInput('Hello\x00World');
			expect(result).not.toContain('\x00');
		});

		it('should remove zero-width characters', () => {
			const result = sanitizeUtils.sanitizeInput('Hello\u200BWorld');
			expect(result).toBe('HelloWorld');
		});

		it('should escape HTML', () => {
			const result = sanitizeUtils.sanitizeInput('<script>alert("xss")</script>');
			expect(result).toContain('&lt;script&gt;');
		});

		it('should trim whitespace', () => {
			const result = sanitizeUtils.sanitizeInput('  Hello World  ');
			expect(result).toBe('Hello World');
		});

		it('should enforce max length', () => {
			const result = sanitizeUtils.sanitizeInput('a'.repeat(1000), 100);
			expect(result.length).toBe(100);
		});

		it('should use default max length of 500', () => {
			const result = sanitizeUtils.sanitizeInput('a'.repeat(1000));
			expect(result.length).toBe(500);
		});

		it('should return empty string for non-string input', () => {
			expect(sanitizeUtils.sanitizeInput(123)).toBe('');
			expect(sanitizeUtils.sanitizeInput(null)).toBe('');
			expect(sanitizeUtils.sanitizeInput(undefined)).toBe('');
		});

		it('should handle empty string', () => {
			const result = sanitizeUtils.sanitizeInput('');
			expect(result).toBe('');
		});

		it('should handle string with only whitespace', () => {
			const result = sanitizeUtils.sanitizeInput('   ');
			expect(result).toBe('');
		});

		it('should combine multiple sanitization steps', () => {
			const result = sanitizeUtils.sanitizeInput('  <img src="x" onerror="alert(\'xss\')">\u200B  ');
			expect(result).not.toContain('<');
			expect(result).not.toContain('>');
			expect(result).not.toContain('\u200B');
			expect(result).toBe(result.trim());
		});
	});

	describe('sanitizeEmail', () => {
		it('should convert to lowercase', () => {
			const result = sanitizeUtils.sanitizeEmail('Test@Example.COM');
			expect(result).toBe('test@example.com');
		});

		it('should trim whitespace', () => {
			const result = sanitizeUtils.sanitizeEmail('  test@example.com  ');
			expect(result).toBe('test@example.com');
		});

		it('should return empty string for non-string input', () => {
			expect(sanitizeUtils.sanitizeEmail(123)).toBe('');
			expect(sanitizeUtils.sanitizeEmail(null)).toBe('');
			expect(sanitizeUtils.sanitizeEmail(undefined)).toBe('');
		});

		it('should handle empty string', () => {
			const result = sanitizeUtils.sanitizeEmail('');
			expect(result).toBe('');
		});

		it('should handle email with special characters', () => {
			const result = sanitizeUtils.sanitizeEmail('  Test+Tag@Example.COM  ');
			expect(result).toBe('test+tag@example.com');
		});

		it('should preserve email structure', () => {
			const result = sanitizeUtils.sanitizeEmail('User.Name@Sub.Domain.COM');
			expect(result).toBe('user.name@sub.domain.com');
		});
	});

	describe('XSS Prevention', () => {
		it('should prevent script injection', () => {
			const malicious = '<script>alert("xss")</script>';
			const result = sanitizeUtils.sanitizeInput(malicious);
			expect(result).not.toContain('<script>');
			expect(result).not.toContain('</script>');
		});

		it('should prevent event handler injection', () => {
			const malicious = '<img src="x" onerror="alert(\'xss\')">';
			const result = sanitizeUtils.sanitizeInput(malicious);
			// The onerror attribute is escaped, so it's safe
			expect(result).not.toContain('<img');
			expect(result).toContain('&lt;img');
		});

		it('should prevent iframe injection', () => {
			const malicious = '<iframe src="http://evil.com"></iframe>';
			const result = sanitizeUtils.sanitizeInput(malicious);
			expect(result).not.toContain('<iframe');
			expect(result).toContain('&lt;iframe');
		});

		it('should prevent data URI injection', () => {
			const malicious = '<a href="data:text/html,<script>alert(\'xss\')</script>">click</a>';
			const result = sanitizeUtils.sanitizeInput(malicious);
			// The data: URI is escaped, so it's safe
			expect(result).not.toContain('<a');
			expect(result).toContain('&lt;a');
		});
	});

	describe('Edge Cases', () => {
		it('should handle very long input', () => {
			const longInput = 'a'.repeat(10000);
			const result = sanitizeUtils.sanitizeInput(longInput, 100);
			expect(result.length).toBe(100);
		});

		it('should handle input with only special characters', () => {
			const result = sanitizeUtils.sanitizeInput('<>&"\'/', 100);
			expect(result).toBe('&lt;&gt;&amp;&quot;&#x27;&#x2F;');
		});

		it('should handle mixed content', () => {
			const result = sanitizeUtils.sanitizeInput('Hello <b>World</b> & Friends');
			expect(result).toContain('Hello');
			expect(result).toContain('World');
			expect(result).toContain('Friends');
			expect(result).not.toContain('<b>');
		});

		it('should handle unicode characters', () => {
			const result = sanitizeUtils.sanitizeInput('Hello 世界 🌍');
			expect(result).toContain('Hello');
			expect(result).toContain('世界');
			expect(result).toContain('🌍');
		});
	});
});

