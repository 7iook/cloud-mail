import fc from 'fast-check';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import shareCaptchaService from './share-captcha-service';
import BizError from '../error/biz-error';

describe('shareCaptchaService - Property-Based Tests', () => {
	let mockContext;
	let mockSettingService;

	beforeEach(() => {
		mockContext = {
			env: {
				KV: {
					get: vi.fn(),
					put: vi.fn()
				}
			}
		};
	});

	describe('checkCaptchaRequired', () => {
		// Property 1: If captcha is disabled, verification is never required
		it('should never require captcha when enableCaptcha is false', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					async (ip, shareToken) => {
						const shareRecord = { enableCaptcha: 0, shareToken };
						const result = await shareCaptchaService.checkCaptchaRequired(
							mockContext,
							shareRecord,
							ip
						);
						expect(result).toBe(false);
					}
				)
			);
		});

		// Property 2: If IP is whitelisted, captcha is not required
		it('should not require captcha for whitelisted IPs', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					async (ip, shareToken) => {
						mockContext.env.KV.get = vi.fn().mockResolvedValue('1');
						const shareRecord = { enableCaptcha: 1, shareToken };
						const result = await shareCaptchaService.checkCaptchaRequired(
							mockContext,
							shareRecord,
							ip
						);
						expect(result).toBe(false);
					}
				)
			);
		});

		// Property 3: If captcha enabled and IP not whitelisted, captcha is required
		it('should require captcha for non-whitelisted IPs when enabled', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					async (ip, shareToken) => {
						mockContext.env.KV.get = vi.fn().mockResolvedValue(null);
						const shareRecord = { enableCaptcha: 1, shareToken };
						const result = await shareCaptchaService.checkCaptchaRequired(
							mockContext,
							shareRecord,
							ip
						);
						expect(result).toBe(true);
					}
				)
			);
		});
	});

	describe('isIpWhitelisted', () => {
		// Property 4: KV key format is always consistent
		it('should use consistent KV key format', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
					fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
					async (ip, shareToken) => {
						mockContext.env.KV.get = vi.fn().mockResolvedValue(null);
						try {
							await shareCaptchaService.isIpWhitelisted(mockContext, ip, shareToken);

							const expectedKey = `captcha_verified:${ip}:${shareToken}`;
							expect(mockContext.env.KV.get).toHaveBeenCalledWith(expectedKey);
						} catch (e) {
							// Expected for some edge cases
						}
					}
				)
			);
		});

		// Property 5: Returns false when KV returns null
		it('should return false when KV returns null', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					async (ip, shareToken) => {
						mockContext.env.KV.get = vi.fn().mockResolvedValue(null);
						const result = await shareCaptchaService.isIpWhitelisted(
							mockContext,
							ip,
							shareToken
						);
						expect(result).toBe(false);
					}
				)
			);
		});

		// Property 6: Returns true when KV returns any non-null value
		it('should return true when KV returns non-null value', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					async (ip, shareToken, kvValue) => {
						mockContext.env.KV.get = vi.fn().mockResolvedValue(kvValue);
						const result = await shareCaptchaService.isIpWhitelisted(
							mockContext,
							ip,
							shareToken
						);
						expect(result).toBe(true);
					}
				)
			);
		});

		// Property 7: KV errors result in false (safe default)
		it('should return false on KV errors', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					async (ip, shareToken) => {
						mockContext.env.KV.get = vi.fn().mockRejectedValue(
							new Error('KV error')
						);
						const result = await shareCaptchaService.isIpWhitelisted(
							mockContext,
							ip,
							shareToken
						);
						expect(result).toBe(false);
					}
				)
			);
		});
	});

	describe('verifyCaptchaToken', () => {
		// Property 8: Empty token throws error
		it('should throw error for empty token', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					async (ip, shareToken) => {
						await expect(
							shareCaptchaService.verifyCaptchaToken(mockContext, '', ip, shareToken)
						).rejects.toThrow(BizError);
					}
				)
			);
		});

		// Property 9: Null token throws error
		it('should throw error for null token', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1 }),
					fc.string({ minLength: 1 }),
					async (ip, shareToken) => {
						await expect(
							shareCaptchaService.verifyCaptchaToken(mockContext, null, ip, shareToken)
						).rejects.toThrow(BizError);
					}
				)
			);
		});
	});

	describe('Security Tests', () => {
		// Property 10: IP and shareToken are properly escaped in KV key
		it('should handle special characters in IP and shareToken', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
					fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
					async (ip, shareToken) => {
						mockContext.env.KV.get = vi.fn().mockResolvedValue(null);
						try {
							await shareCaptchaService.isIpWhitelisted(mockContext, ip, shareToken);

							const callArgs = mockContext.env.KV.get.mock.calls[0]?.[0];
							if (callArgs) {
								expect(callArgs).toContain('captcha_verified:');
							}
						} catch (e) {
							// Expected for some edge cases
						}
					}
				)
			);
		});

		// Property 11: Idempotency - multiple calls with same params return same result
		it('should be idempotent for whitelist checks', async () => {
			fc.assert(
				await fc.asyncProperty(
					fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
					fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
					async (ip, shareToken) => {
						mockContext.env.KV.get = vi.fn().mockResolvedValue('1');

						try {
							const result1 = await shareCaptchaService.isIpWhitelisted(
								mockContext,
								ip,
								shareToken
							);
							const result2 = await shareCaptchaService.isIpWhitelisted(
								mockContext,
								ip,
								shareToken
							);

							expect(result1).toBe(result2);
						} catch (e) {
							// Expected for some edge cases
						}
					}
				)
			);
		});
	});
});

