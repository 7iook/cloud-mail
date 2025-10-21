import { describe, it, expect, beforeEach, vi } from 'vitest';
import reqUtils from './req-utils.js';

describe('reqUtils - Real Unit Tests', () => {
	let mockContext;

	beforeEach(() => {
		mockContext = {
			req: {
				header: vi.fn()
			}
		};
	});

	describe('getIp', () => {
		it('should return CF-Connecting-IP header if available', () => {
			mockContext.req.header.mockImplementation((name) => {
				if (name === 'CF-Connecting-IP') return '192.168.1.1';
				return null;
			});

			const result = reqUtils.getIp(mockContext);
			expect(result).toBe('192.168.1.1');
		});

		it('should return X-Forwarded-For header if CF-Connecting-IP is not available', () => {
			mockContext.req.header.mockImplementation((name) => {
				if (name === 'X-Forwarded-For') return '10.0.0.1';
				return null;
			});

			const result = reqUtils.getIp(mockContext);
			expect(result).toBe('10.0.0.1');
		});

		it('should return Unknown if no IP headers are available', () => {
			mockContext.req.header.mockReturnValue(null);

			const result = reqUtils.getIp(mockContext);
			expect(result).toBe('Unknown');
		});

		it('should prioritize CF-Connecting-IP over X-Forwarded-For', () => {
			mockContext.req.header.mockImplementation((name) => {
				if (name === 'CF-Connecting-IP') return '192.168.1.1';
				if (name === 'X-Forwarded-For') return '10.0.0.1';
				return null;
			});

			const result = reqUtils.getIp(mockContext);
			expect(result).toBe('192.168.1.1');
		});

		it('should handle IPv6 addresses', () => {
			mockContext.req.header.mockImplementation((name) => {
				if (name === 'CF-Connecting-IP') return '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
				return null;
			});

			const result = reqUtils.getIp(mockContext);
			expect(result).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
		});

		it('should handle multiple IPs in X-Forwarded-For', () => {
			mockContext.req.header.mockImplementation((name) => {
				if (name === 'X-Forwarded-For') return '192.168.1.1, 10.0.0.1, 172.16.0.1';
				return null;
			});

			const result = reqUtils.getIp(mockContext);
			expect(result).toBe('192.168.1.1, 10.0.0.1, 172.16.0.1');
		});
	});

	describe('getUserAgent', () => {
		it('should parse Chrome browser', () => {
			const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
			mockContext.req.header.mockReturnValue(chromeUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toContain('Chrome');
			expect(result.os).toContain('Windows');
			expect(result.device).toBe('Desktop');
		});

		it('should parse Firefox browser', () => {
			const firefoxUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
			mockContext.req.header.mockReturnValue(firefoxUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toContain('Firefox');
			expect(result.os).toContain('Windows');
		});

		it('should parse Safari browser', () => {
			const safariUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
			mockContext.req.header.mockReturnValue(safariUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toContain('Safari');
			expect(result.os).toContain('macOS');
		});

		it('should parse mobile device', () => {
			const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1';
			mockContext.req.header.mockReturnValue(mobileUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toContain('Safari');
			expect(result.os).toContain('iOS');
			expect(result.device).not.toBe('Desktop');
		});

		it('should parse Android device', () => {
			const androidUA = 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';
			mockContext.req.header.mockReturnValue(androidUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toContain('Chrome');
			expect(result.os).toContain('Android');
		});

		it('should handle empty user agent', () => {
			mockContext.req.header.mockReturnValue('');

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toBe('');
			expect(result.device).toBe('Desktop');
			expect(result.os).toBe('');
		});

		it('should handle null user agent', () => {
			mockContext.req.header.mockReturnValue(null);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toBe('');
			expect(result.device).toBe('Desktop');
			expect(result.os).toBe('');
		});

		it('should return object with required properties', () => {
			mockContext.req.header.mockReturnValue('Mozilla/5.0');

			const result = reqUtils.getUserAgent(mockContext);

			expect(result).toHaveProperty('browser');
			expect(result).toHaveProperty('device');
			expect(result).toHaveProperty('os');
		});

		it('should handle bot user agents', () => {
			const botUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
			mockContext.req.header.mockReturnValue(botUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toBe('');
			expect(result.device).toBe('Desktop');
		});

		it('should parse tablet device', () => {
			const tabletUA = 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1';
			mockContext.req.header.mockReturnValue(tabletUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.os).toContain('iOS');
			expect(result.device).not.toBe('Desktop');
		});

		it('should handle Edge browser', () => {
			const edgeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
			mockContext.req.header.mockReturnValue(edgeUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toContain('Edge');
			expect(result.os).toContain('Windows');
		});

		it('should handle Opera browser', () => {
			const operaUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 OPR/77.0.4054.254';
			mockContext.req.header.mockReturnValue(operaUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.browser).toContain('Opera');
		});

		it('should handle Linux OS', () => {
			const linuxUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
			mockContext.req.header.mockReturnValue(linuxUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result.os).toContain('Linux');
		});

		it('should handle very long user agent string', () => {
			const longUA = 'Mozilla/5.0 ' + 'x'.repeat(1000);
			mockContext.req.header.mockReturnValue(longUA);

			const result = reqUtils.getUserAgent(mockContext);

			expect(result).toHaveProperty('browser');
			expect(result).toHaveProperty('device');
			expect(result).toHaveProperty('os');
		});
	});

	describe('Integration Tests', () => {
		it('should handle complete request context', () => {
			mockContext.req.header.mockImplementation((name) => {
				const headers = {
					'CF-Connecting-IP': '203.0.113.1',
					'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124 Safari/537.36'
				};
				return headers[name] || null;
			});

			const ip = reqUtils.getIp(mockContext);
			const ua = reqUtils.getUserAgent(mockContext);

			expect(ip).toBe('203.0.113.1');
			expect(ua.browser).toContain('Chrome');
			expect(ua.os).toContain('Windows');
		});
	});
});

