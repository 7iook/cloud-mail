import { describe, it, expect } from 'vitest';
import verifyUtils from './verify-utils';

/**
 * 真实的单元测试 - verify-utils
 * 测试邮箱和域名验证函数
 */

describe('verifyUtils - Real Unit Tests', () => {
	describe('isEmail', () => {
		// ✅ 测试 1：有效的邮箱地址
		it('should accept valid email addresses', () => {
			const validEmails = [
				'user@example.com',
				'test.user@example.com',
				'user+tag@example.co.uk',
				'user_name@example.org',
				'123@example.com',
				'a@b.co',
				'user@subdomain.example.com',
				'user!#$%&\'*+/=?^_`{|}~@example.com'
			];
			
			validEmails.forEach(email => {
				expect(verifyUtils.isEmail(email)).toBe(true);
			});
		});

		// ✅ 测试 2：无效的邮箱地址 - 缺少 @
		it('should reject email without @', () => {
			const invalidEmails = [
				'notanemail',
				'user.example.com',
				'userexample.com'
			];
			
			invalidEmails.forEach(email => {
				expect(verifyUtils.isEmail(email)).toBe(false);
			});
		});

		// ✅ 测试 3：无效的邮箱地址 - 缺少域名
		it('should reject email without domain', () => {
			const invalidEmails = [
				'user@',
				'@example.com',
				'user@.',
				'user@.com'
			];
			
			invalidEmails.forEach(email => {
				expect(verifyUtils.isEmail(email)).toBe(false);
			});
		});

		// ✅ 测试 4：无效的邮箱地址 - 缺少 TLD
		it('should reject email without TLD', () => {
			const invalidEmails = [
				'user@example',
				'user@localhost',
				'user@192.168.1.1'
			];
			
			invalidEmails.forEach(email => {
				expect(verifyUtils.isEmail(email)).toBe(false);
			});
		});

		// ✅ 测试 5：无效的邮箱地址 - 空格
		it('should reject email with spaces', () => {
			const invalidEmails = [
				'user @example.com',
				'user@ example.com',
				'user @example .com',
				' user@example.com',
				'user@example.com '
			];
			
			invalidEmails.forEach(email => {
				expect(verifyUtils.isEmail(email)).toBe(false);
			});
		});

		// ✅ 测试 6：无效的邮箱地址 - 多个 @
		it('should reject email with multiple @', () => {
			const invalidEmails = [
				'user@@example.com',
				'user@exam@ple.com',
				'user@example@com'
			];
			
			invalidEmails.forEach(email => {
				expect(verifyUtils.isEmail(email)).toBe(false);
			});
		});

		// ✅ 测试 7：空字符串
		it('should reject empty string', () => {
			expect(verifyUtils.isEmail('')).toBe(false);
		});

		// ✅ 测试 8：特殊情况 - 只有 @
		it('should reject just @', () => {
			expect(verifyUtils.isEmail('@')).toBe(false);
		});

		// ✅ 测试 9：邮箱地址区分大小写（应该接受）
		it('should accept uppercase letters', () => {
			const emails = [
				'User@Example.com',
				'USER@EXAMPLE.COM',
				'User@example.COM'
			];
			
			emails.forEach(email => {
				expect(verifyUtils.isEmail(email)).toBe(true);
			});
		});

		// ✅ 测试 10：数字域名
		it('should accept numeric domains', () => {
			expect(verifyUtils.isEmail('user@123.com')).toBe(true);
			expect(verifyUtils.isEmail('user@123-456.com')).toBe(true);
		});
	});

	describe('isDomain', () => {
		// ✅ 测试 11：有效的域名
		it('should accept valid domain names', () => {
			const validDomains = [
				'example.com',
				'subdomain.example.com',
				'sub.subdomain.example.com',
				'example.co.uk',
				'example-domain.com',
				'123.com',
				'a.co'
			];
			
			validDomains.forEach(domain => {
				expect(verifyUtils.isDomain(domain)).toBe(true);
			});
		});

		// ✅ 测试 12：无效的域名 - 缺少 TLD
		it('should reject domain without TLD', () => {
			const invalidDomains = [
				'example',
				'localhost',
				'example.',
				'.example'
			];
			
			invalidDomains.forEach(domain => {
				expect(verifyUtils.isDomain(domain)).toBe(false);
			});
		});

		// ✅ 测试 13：无效的域名 - 包含协议
		it('should reject domain with protocol', () => {
			const invalidDomains = [
				'http://example.com',
				'https://example.com',
				'ftp://example.com',
				'://example.com'
			];
			
			invalidDomains.forEach(domain => {
				expect(verifyUtils.isDomain(domain)).toBe(false);
			});
		});

		// ✅ 测试 14：无效的域名 - 包含路径
		it('should reject domain with path', () => {
			const invalidDomains = [
				'example.com/',
				'example.com/path',
				'example.com/path/to/page'
			];
			
			invalidDomains.forEach(domain => {
				expect(verifyUtils.isDomain(domain)).toBe(false);
			});
		});

		// ✅ 测试 15：无效的域名 - 包含端口
		it('should reject domain with port', () => {
			const invalidDomains = [
				'example.com:8080',
				'example.com:3000',
				'localhost:3000'
			];
			
			invalidDomains.forEach(domain => {
				expect(verifyUtils.isDomain(domain)).toBe(false);
			});
		});

		// ✅ 测试 16：无效的域名 - 包含 @
		it('should reject domain with @', () => {
			const invalidDomains = [
				'user@example.com',
				'@example.com',
				'example@com'
			];
			
			invalidDomains.forEach(domain => {
				expect(verifyUtils.isDomain(domain)).toBe(false);
			});
		});

		// ✅ 测试 17：无效的域名 - 包含空格
		it('should reject domain with spaces', () => {
			const invalidDomains = [
				'example .com',
				' example.com',
				'example.com ',
				'exam ple.com'
			];
			
			invalidDomains.forEach(domain => {
				expect(verifyUtils.isDomain(domain)).toBe(false);
			});
		});

		// ✅ 测试 18：空字符串
		it('should reject empty string', () => {
			expect(verifyUtils.isDomain('')).toBe(false);
		});

		// ✅ 测试 19：只有点
		it('should reject just dots', () => {
			expect(verifyUtils.isDomain('.')).toBe(false);
			expect(verifyUtils.isDomain('..')).toBe(false);
			expect(verifyUtils.isDomain('...')).toBe(false);
		});

		// ✅ 测试 20：域名区分大小写（应该接受）
		it('should accept uppercase letters', () => {
			const domains = [
				'Example.com',
				'EXAMPLE.COM',
				'Example.COM'
			];
			
			domains.forEach(domain => {
				expect(verifyUtils.isDomain(domain)).toBe(true);
			});
		});

		// ✅ 测试 21：连字符处理
		it('should accept hyphens in domain', () => {
			expect(verifyUtils.isDomain('my-domain.com')).toBe(true);
			expect(verifyUtils.isDomain('my-sub-domain.example.com')).toBe(true);
		});

		// ✅ 测试 22：连字符不能在开头或结尾
		it('should reject hyphen at start or end', () => {
			expect(verifyUtils.isDomain('-example.com')).toBe(false);
			expect(verifyUtils.isDomain('example-.com')).toBe(false);
			expect(verifyUtils.isDomain('example.-com')).toBe(false);
		});
	});

	describe('Edge Cases', () => {
		// ✅ 测试 23：非字符串输入 - isEmail
		it('should handle non-string input for isEmail', () => {
			// 这些应该返回 false 或抛出错误
			expect(() => verifyUtils.isEmail(null)).not.toThrow();
			expect(() => verifyUtils.isEmail(undefined)).not.toThrow();
			expect(() => verifyUtils.isEmail(123)).not.toThrow();
		});

		// ✅ 测试 24：非字符串输入 - isDomain
		it('should handle non-string input for isDomain', () => {
			expect(() => verifyUtils.isDomain(null)).not.toThrow();
			expect(() => verifyUtils.isDomain(undefined)).not.toThrow();
			expect(() => verifyUtils.isDomain(123)).not.toThrow();
		});

		// ✅ 测试 25：非常长的邮箱地址
		it('should handle very long email addresses', () => {
			const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com';
			// 应该能处理，不管是否有效
			expect(() => verifyUtils.isEmail(longEmail)).not.toThrow();
		});

		// ✅ 测试 26：非常长的域名
		it('should handle very long domain names', () => {
			const longDomain = 'a'.repeat(100) + '.' + 'b'.repeat(100) + '.com';
			expect(() => verifyUtils.isDomain(longDomain)).not.toThrow();
		});
	});
});

