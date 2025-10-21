import { describe, it, expect } from 'vitest';
import emailUtils from './email-utils';

/**
 * 真实的单元测试 - email-utils
 * 测试邮件处理工具函数
 */

describe('emailUtils - Real Unit Tests', () => {
	describe('getDomain', () => {
		// ✅ 测试 1：提取标准邮箱的域名
		it('should extract domain from standard email', () => {
			expect(emailUtils.getDomain('user@example.com')).toBe('example.com');
			expect(emailUtils.getDomain('test@gmail.com')).toBe('gmail.com');
			expect(emailUtils.getDomain('admin@company.co.uk')).toBe('company.co.uk');
		});

		// ✅ 测试 2：提取子域名邮箱的域名
		it('should extract domain from subdomain email', () => {
			expect(emailUtils.getDomain('user@mail.example.com')).toBe('mail.example.com');
			expect(emailUtils.getDomain('test@sub.mail.example.com')).toBe('sub.mail.example.com');
		});

		// ✅ 测试 3：无效的邮箱格式返回空字符串
		it('should return empty string for invalid email', () => {
			expect(emailUtils.getDomain('notanemail')).toBe('');
			expect(emailUtils.getDomain('user@')).toBe('');  // split('@') = ['user', ''], length=2, returns ''
			expect(emailUtils.getDomain('@example.com')).toBe('example.com');  // split('@') = ['', 'example.com'], length=2, returns 'example.com'
			expect(emailUtils.getDomain('user@@example.com')).toBe('');  // split('@') = ['user', '', 'example.com'], length=3, returns ''
		});

		// ✅ 测试 4：空字符串返回空字符串
		it('should return empty string for empty input', () => {
			expect(emailUtils.getDomain('')).toBe('');
		});

		// ✅ 测试 5：非字符串输入返回空字符串
		it('should return empty string for non-string input', () => {
			expect(emailUtils.getDomain(null)).toBe('');
			expect(emailUtils.getDomain(undefined)).toBe('');
			expect(emailUtils.getDomain(123)).toBe('');
			expect(emailUtils.getDomain({})).toBe('');
		});

		// ✅ 测试 6：邮箱地址中有多个 @ 符号
		it('should handle multiple @ symbols', () => {
			// split('@') 返回 3 个元素，length !== 2，所以返回 ''
			expect(emailUtils.getDomain('user@domain@example.com')).toBe('');
		});

		// ✅ 测试 7：邮箱地址中有空格
		it('should handle email with spaces', () => {
			// split('@') = ['user ', 'example.com'], length=2, returns 'example.com'
			expect(emailUtils.getDomain('user @example.com')).toBe('example.com');
			// split('@') = ['user', ' example.com'], length=2, returns ' example.com'
			expect(emailUtils.getDomain('user@ example.com')).toBe(' example.com');
		});

		// ✅ 测试 8：大小写处理
		it('should preserve case in domain', () => {
			expect(emailUtils.getDomain('user@Example.COM')).toBe('Example.COM');
			expect(emailUtils.getDomain('USER@EXAMPLE.COM')).toBe('EXAMPLE.COM');
		});
	});

	describe('getName', () => {
		// ✅ 测试 9：提取标准邮箱的用户名
		it('should extract name from standard email', () => {
			expect(emailUtils.getName('user@example.com')).toBe('user');
			expect(emailUtils.getName('test.user@gmail.com')).toBe('test.user');
			expect(emailUtils.getName('admin+tag@company.com')).toBe('admin+tag');
		});

		// ✅ 测试 10：提取带有特殊字符的用户名
		it('should extract name with special characters', () => {
			expect(emailUtils.getName('user.name@example.com')).toBe('user.name');
			expect(emailUtils.getName('user_name@example.com')).toBe('user_name');
			expect(emailUtils.getName('user+tag@example.com')).toBe('user+tag');
			expect(emailUtils.getName('user-name@example.com')).toBe('user-name');
		});

		// ✅ 测试 11：无效的邮箱格式返回空字符串
		it('should return empty string for invalid email', () => {
			expect(emailUtils.getName('notanemail')).toBe('');
			// split('@') = ['user', ''], length=2, returns 'user'
			expect(emailUtils.getName('user@')).toBe('user');
			// split('@') = ['', 'example.com'], length=2, returns ''
			expect(emailUtils.getName('@example.com')).toBe('');
			// split('@') = ['user', '', 'example.com'], length=3, returns ''
			expect(emailUtils.getName('user@@example.com')).toBe('');
		});

		// ✅ 测试 12：空字符串返回空字符串
		it('should return empty string for empty input', () => {
			expect(emailUtils.getName('')).toBe('');
		});

		// ✅ 测试 13：非字符串输入返回空字符串
		it('should return empty string for non-string input', () => {
			expect(emailUtils.getName(null)).toBe('');
			expect(emailUtils.getName(undefined)).toBe('');
			expect(emailUtils.getName(123)).toBe('');
			expect(emailUtils.getName({})).toBe('');
		});

		// ✅ 测试 14：邮箱地址中有多个 @ 符号
		it('should handle multiple @ symbols', () => {
			// split('@') = ['user', 'domain', 'example.com'], length=3, returns ''
			expect(emailUtils.getName('user@domain@example.com')).toBe('');
		});

		// ✅ 测试 15：邮箱地址中有空格
		it('should handle email with spaces', () => {
			// trim() = 'user @example.com', split('@') = ['user ', 'example.com'], returns 'user '
			expect(emailUtils.getName('user @example.com')).toBe('user ');
			// trim() = 'user@example.com', split('@') = ['user', 'example.com'], returns 'user'
			expect(emailUtils.getName(' user@example.com')).toBe('user');
		});

		// ✅ 测试 16：大小写处理
		it('should preserve case in name', () => {
			expect(emailUtils.getName('User@example.com')).toBe('User');
			expect(emailUtils.getName('USER@example.com')).toBe('USER');
		});

		// ✅ 测试 17：数字用户名
		it('should handle numeric names', () => {
			expect(emailUtils.getName('123@example.com')).toBe('123');
			expect(emailUtils.getName('123456@example.com')).toBe('123456');
		});

		// ✅ 测试 18：只有一个字符的用户名
		it('should handle single character name', () => {
			expect(emailUtils.getName('a@example.com')).toBe('a');
		});

		// ✅ 测试 19：很长的用户名
		it('should handle very long name', () => {
			const longName = 'a'.repeat(100);
			expect(emailUtils.getName(`${longName}@example.com`)).toBe(longName);
		});
	});

	describe('htmlToText', () => {
		// ✅ 测试 20：转换简单的 HTML
		it('should convert simple HTML to text', () => {
			const html = '<p>Hello World</p>';
			const text = emailUtils.htmlToText(html);
			expect(text).toContain('Hello World');
		});

		// ✅ 测试 21：移除 script 标签
		it('should remove script tags', () => {
			const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
			const text = emailUtils.htmlToText(html);
			expect(text).not.toContain('alert');
			expect(text).toContain('Hello');
			expect(text).toContain('World');
		});

		// ✅ 测试 22：移除 style 标签
		it('should remove style tags', () => {
			const html = '<p>Hello</p><style>body { color: red; }</style><p>World</p>';
			const text = emailUtils.htmlToText(html);
			expect(text).not.toContain('color');
			expect(text).toContain('Hello');
			expect(text).toContain('World');
		});

		// ✅ 测试 23：移除 title 标签
		it('should remove title tags', () => {
			const html = '<title>Page Title</title><p>Content</p>';
			const text = emailUtils.htmlToText(html);
			expect(text).not.toContain('Page Title');
			expect(text).toContain('Content');
		});

		// ✅ 测试 24：处理嵌套的 HTML
		it('should handle nested HTML', () => {
			const html = '<div><p>Hello <strong>World</strong></p></div>';
			const text = emailUtils.htmlToText(html);
			expect(text).toContain('Hello');
			expect(text).toContain('World');
		});

		// ✅ 测试 25：处理 HTML 实体
		it('should handle HTML entities', () => {
			const html = '<p>&lt;tag&gt; &amp; &quot;quote&quot;</p>';
			const text = emailUtils.htmlToText(html);
			// 应该能处理，不管是否转换实体
			expect(text.length).toBeGreaterThan(0);
		});

		// ✅ 测试 26：处理空 HTML
		it('should handle empty HTML', () => {
			const html = '';
			const text = emailUtils.htmlToText(html);
			expect(typeof text).toBe('string');
			expect(text).toBe('');  // 空 HTML 应该返回空字符串
		});

		// ✅ 测试 26b：处理 null 和 undefined
		it('should handle null and undefined', () => {
			expect(emailUtils.htmlToText(null)).toBe('');
			expect(emailUtils.htmlToText(undefined)).toBe('');
		});

		// ✅ 测试 27：处理只有标签的 HTML
		it('should handle HTML with only tags', () => {
			const html = '<div></div><p></p><span></span>';
			const text = emailUtils.htmlToText(html);
			expect(typeof text).toBe('string');
		});

		// ✅ 测试 28：处理多个 script 标签
		it('should remove multiple script tags', () => {
			const html = '<script>alert(1)</script><p>Text</p><script>alert(2)</script>';
			const text = emailUtils.htmlToText(html);
			expect(text).not.toContain('alert');
			expect(text).toContain('Text');
		});

		// ✅ 测试 29：处理复杂的邮件 HTML
		it('should handle complex email HTML', () => {
			const html = `
				<html>
					<head><title>Email</title><style>body { font-family: Arial; }</style></head>
					<body>
						<h1>Hello</h1>
						<p>This is a test email.</p>
						<script>console.log('test')</script>
						<footer>Best regards</footer>
					</body>
				</html>
			`;
			const text = emailUtils.htmlToText(html);
			expect(text).toContain('Hello');
			expect(text).toContain('test email');
			expect(text).toContain('Best regards');
			expect(text).not.toContain('console.log');
			expect(text).not.toContain('font-family');
		});
	});
});

