import { describe, it, expect } from 'vitest';
import domainUtils from './domain-uitls.js';

describe('domainUtils - Real Unit Tests', () => {
	describe('toOssDomain', () => {
		it('should add https:// prefix to domain without protocol', () => {
			expect(domainUtils.toOssDomain('example.com')).toBe('https://example.com');
		});

		it('should not add prefix if domain already has http://', () => {
			expect(domainUtils.toOssDomain('http://example.com')).toBe('http://example.com');
		});

		it('should not add prefix if domain already has https://', () => {
			expect(domainUtils.toOssDomain('https://example.com')).toBe('https://example.com');
		});

		it('should remove trailing slash', () => {
			expect(domainUtils.toOssDomain('example.com/')).toBe('https://example.com');
		});

		it('should remove trailing slash from https domain', () => {
			expect(domainUtils.toOssDomain('https://example.com/')).toBe('https://example.com');
		});

		it('should remove trailing slash from http domain', () => {
			expect(domainUtils.toOssDomain('http://example.com/')).toBe('http://example.com');
		});

		it('should handle domain with path', () => {
			expect(domainUtils.toOssDomain('example.com/path')).toBe('https://example.com/path');
		});

		it('should handle domain with path and trailing slash', () => {
			expect(domainUtils.toOssDomain('example.com/path/')).toBe('https://example.com/path');
		});

		it('should handle domain with port', () => {
			expect(domainUtils.toOssDomain('example.com:8080')).toBe('https://example.com:8080');
		});

		it('should handle domain with port and trailing slash', () => {
			expect(domainUtils.toOssDomain('example.com:8080/')).toBe('https://example.com:8080');
		});

		it('should handle subdomain', () => {
			expect(domainUtils.toOssDomain('sub.example.com')).toBe('https://sub.example.com');
		});

		it('should handle multiple subdomains', () => {
			expect(domainUtils.toOssDomain('a.b.c.example.com')).toBe('https://a.b.c.example.com');
		});

		it('should return null for null input', () => {
			expect(domainUtils.toOssDomain(null)).toBeNull();
		});

		it('should return null for undefined input', () => {
			expect(domainUtils.toOssDomain(undefined)).toBeNull();
		});

		it('should return null for empty string', () => {
			expect(domainUtils.toOssDomain('')).toBeNull();
		});

		it('should handle domain with query parameters', () => {
			expect(domainUtils.toOssDomain('example.com?key=value')).toBe('https://example.com?key=value');
		});

		it('should handle domain with fragment', () => {
			expect(domainUtils.toOssDomain('example.com#section')).toBe('https://example.com#section');
		});

		it('should handle localhost', () => {
			expect(domainUtils.toOssDomain('localhost:3000')).toBe('https://localhost:3000');
		});

		it('should handle IP address', () => {
			expect(domainUtils.toOssDomain('192.168.1.1')).toBe('https://192.168.1.1');
		});

		it('should handle IPv6 address', () => {
			expect(domainUtils.toOssDomain('[::1]')).toBe('https://[::1]');
		});

		it('should handle domain with multiple trailing slashes', () => {
			const result = domainUtils.toOssDomain('example.com//');
			expect(result).toContain('example.com');
		});

		it('should handle domain with special characters', () => {
			expect(domainUtils.toOssDomain('example-domain.com')).toBe('https://example-domain.com');
		});

		it('should handle domain with numbers', () => {
			expect(domainUtils.toOssDomain('example123.com')).toBe('https://example123.com');
		});

		it('should handle uppercase protocol', () => {
			// HTTPS:// is not recognized as a valid protocol (case-sensitive check)
			// so it will be treated as a domain and https:// will be prepended
			const result = domainUtils.toOssDomain('HTTPS://example.com');
			expect(result).toContain('example.com');
		});

		it('should handle domain with authentication', () => {
			expect(domainUtils.toOssDomain('user:pass@example.com')).toBe('https://user:pass@example.com');
		});

		it('should handle domain with https and authentication', () => {
			expect(domainUtils.toOssDomain('https://user:pass@example.com')).toBe('https://user:pass@example.com');
		});

		it('should handle very long domain', () => {
			const longDomain = 'a'.repeat(100) + '.com';
			expect(domainUtils.toOssDomain(longDomain)).toBe('https://' + longDomain);
		});

		it('should handle domain with only slash', () => {
			const result = domainUtils.toOssDomain('/');
			// '/' is treated as a domain, https:// is prepended, then trailing slash is removed
			expect(result).toBe('https://');
		});

		it('should handle domain starting with slash', () => {
			const result = domainUtils.toOssDomain('/example.com');
			expect(result).toBe('https:///example.com');
		});
	});

	describe('Edge Cases and Integration', () => {
		it('should handle consecutive operations', () => {
			const domain1 = domainUtils.toOssDomain('example.com');
			const domain2 = domainUtils.toOssDomain(domain1);

			expect(domain2).toBe('https://example.com');
		});

		it('should handle domain with complex path', () => {
			const domain = 'example.com/api/v1/users/123';
			expect(domainUtils.toOssDomain(domain)).toBe('https://example.com/api/v1/users/123');
		});

		it('should handle domain with complex query string', () => {
			const domain = 'example.com?key1=value1&key2=value2&key3=value3';
			expect(domainUtils.toOssDomain(domain)).toBe('https://example.com?key1=value1&key2=value2&key3=value3');
		});
	});
});

