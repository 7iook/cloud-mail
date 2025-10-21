import { describe, it, expect, beforeEach } from 'vitest';
import cryptoUtils from './crypto-utils';

/**
 * 真实的单元测试 - crypto-utils
 * 测试密码学相关的工具函数
 */

describe('cryptoUtils - Real Unit Tests', () => {
	describe('generateSalt', () => {
		// ✅ 测试 1：生成的 salt 是字符串
		it('should generate salt as string', () => {
			const salt = cryptoUtils.generateSalt();
			expect(typeof salt).toBe('string');
			expect(salt.length).toBeGreaterThan(0);
		});

		// ✅ 测试 2：不同调用生成不同的 salt
		it('should generate different salts on each call', () => {
			const salt1 = cryptoUtils.generateSalt();
			const salt2 = cryptoUtils.generateSalt();
			expect(salt1).not.toBe(salt2);
		});

		// ✅ 测试 3：salt 长度可配置
		it('should respect custom salt length', () => {
			const salt16 = cryptoUtils.generateSalt(16);
			const salt32 = cryptoUtils.generateSalt(32);
			
			// Base64 编码后的长度会不同
			expect(salt32.length).toBeGreaterThan(salt16.length);
		});

		// ✅ 测试 4：salt 是有效的 Base64
		it('should generate valid Base64 salt', () => {
			const salt = cryptoUtils.generateSalt();
			// Base64 只包含特定字符
			expect(salt).toMatch(/^[A-Za-z0-9+/=]*$/);
		});
	});

	describe('genRandomStr', () => {
		// ✅ 测试 5：生成的字符串是指定长度
		it('should generate string with specified length', () => {
			const str10 = cryptoUtils.genRandomStr(10);
			const str32 = cryptoUtils.genRandomStr(32);
			const str64 = cryptoUtils.genRandomStr(64);
			
			expect(str10.length).toBe(10);
			expect(str32.length).toBe(32);
			expect(str64.length).toBe(64);
		});

		// ✅ 测试 6：生成的字符串只包含允许的字符
		it('should only contain alphanumeric characters', () => {
			for (let i = 0; i < 100; i++) {
				const str = cryptoUtils.genRandomStr(32);
				expect(str).toMatch(/^[A-Za-z0-9]+$/);
			}
		});

		// ✅ 测试 7：不同调用生成不同的字符串
		it('should generate different strings on each call', () => {
			const strings = new Set();
			for (let i = 0; i < 100; i++) {
				strings.add(cryptoUtils.genRandomStr(32));
			}
			// 所有字符串都应该不同
			expect(strings.size).toBe(100);
		});

		// ✅ 测试 8：默认长度是 32
		it('should use default length of 32', () => {
			const str = cryptoUtils.genRandomStr();
			expect(str.length).toBe(32);
		});

		// ✅ 测试 9：生成的字符串有足够的熵
		it('should have sufficient entropy', () => {
			const str = cryptoUtils.genRandomStr(32);
			// 计算字符多样性
			const uniqueChars = new Set(str.split(''));
			// 32 个字符中应该有足够的多样性（至少 10 个不同的字符）
			expect(uniqueChars.size).toBeGreaterThanOrEqual(10);
		});
	});

	describe('genRandomPwd', () => {
		// ✅ 测试 10：生成的密码是指定长度
		it('should generate password with specified length', () => {
			const pwd8 = cryptoUtils.genRandomPwd(8);
			const pwd16 = cryptoUtils.genRandomPwd(16);
			
			expect(pwd8.length).toBe(8);
			expect(pwd16.length).toBe(16);
		});

		// ✅ 测试 11：生成的密码只包含字母和数字
		it('should only contain letters and numbers', () => {
			for (let i = 0; i < 100; i++) {
				const pwd = cryptoUtils.genRandomPwd(8);
				expect(pwd).toMatch(/^[A-Za-z0-9]+$/);
			}
		});

		// ✅ 测试 12：不同调用生成不同的密码
		it('should generate different passwords on each call', () => {
			const passwords = new Set();
			for (let i = 0; i < 100; i++) {
				passwords.add(cryptoUtils.genRandomPwd(8));
			}
			// 大多数密码应该不同（允许极小概率的碰撞）
			expect(passwords.size).toBeGreaterThan(95);
		});

		// ✅ 测试 13：默认长度是 8
		it('should use default length of 8', () => {
			const pwd = cryptoUtils.genRandomPwd();
			expect(pwd.length).toBe(8);
		});
	});

	describe('hashPassword', () => {
		// ✅ 测试 14：哈希密码返回 salt 和 hash
		it('should return salt and hash', async () => {
			const result = await cryptoUtils.hashPassword('password123');
			
			expect(result).toHaveProperty('salt');
			expect(result).toHaveProperty('hash');
			expect(typeof result.salt).toBe('string');
			expect(typeof result.hash).toBe('string');
		});

		// ✅ 测试 15：相同密码生成不同的哈希（因为 salt 不同）
		it('should generate different hashes for same password', async () => {
			const hash1 = await cryptoUtils.hashPassword('password123');
			const hash2 = await cryptoUtils.hashPassword('password123');
			
			expect(hash1.hash).not.toBe(hash2.hash);
			expect(hash1.salt).not.toBe(hash2.salt);
		});

		// ✅ 测试 16：哈希是有效的 Base64
		it('should generate valid Base64 hash', async () => {
			const result = await cryptoUtils.hashPassword('password123');
			
			expect(result.hash).toMatch(/^[A-Za-z0-9+/=]*$/);
			expect(result.salt).toMatch(/^[A-Za-z0-9+/=]*$/);
		});
	});

	describe('verifyPassword', () => {
		// ✅ 测试 17：正确的密码验证成功
		it('should verify correct password', async () => {
			const password = 'mySecurePassword123';
			const { salt, hash } = await cryptoUtils.hashPassword(password);
			
			const isValid = await cryptoUtils.verifyPassword(password, salt, hash);
			expect(isValid).toBe(true);
		});

		// ✅ 测试 18：错误的密码验证失败
		it('should reject incorrect password', async () => {
			const password = 'mySecurePassword123';
			const { salt, hash } = await cryptoUtils.hashPassword(password);
			
			const isValid = await cryptoUtils.verifyPassword('wrongPassword', salt, hash);
			expect(isValid).toBe(false);
		});

		// ✅ 测试 19：密码区分大小写
		it('should be case-sensitive', async () => {
			const password = 'MyPassword';
			const { salt, hash } = await cryptoUtils.hashPassword(password);
			
			const isValid1 = await cryptoUtils.verifyPassword('mypassword', salt, hash);
			const isValid2 = await cryptoUtils.verifyPassword('MYPASSWORD', salt, hash);
			
			expect(isValid1).toBe(false);
			expect(isValid2).toBe(false);
		});

		// ✅ 测试 20：空密码处理
		it('should handle empty password', async () => {
			const { salt, hash } = await cryptoUtils.hashPassword('');
			
			const isValid1 = await cryptoUtils.verifyPassword('', salt, hash);
			const isValid2 = await cryptoUtils.verifyPassword('notEmpty', salt, hash);
			
			expect(isValid1).toBe(true);
			expect(isValid2).toBe(false);
		});

		// ✅ 测试 21：特殊字符密码
		it('should handle special characters in password', async () => {
			const password = 'P@ssw0rd!#$%^&*()';
			const { salt, hash } = await cryptoUtils.hashPassword(password);
			
			const isValid = await cryptoUtils.verifyPassword(password, salt, hash);
			expect(isValid).toBe(true);
		});
	});

	describe('genHashPassword', () => {
		// ✅ 测试 22：相同的 salt 和密码生成相同的哈希
		it('should generate same hash for same salt and password', async () => {
			const password = 'testPassword';
			const salt = cryptoUtils.generateSalt();
			
			const hash1 = await cryptoUtils.genHashPassword(password, salt);
			const hash2 = await cryptoUtils.genHashPassword(password, salt);
			
			expect(hash1).toBe(hash2);
		});

		// ✅ 测试 23：不同的 salt 生成不同的哈希
		it('should generate different hash for different salt', async () => {
			const password = 'testPassword';
			const salt1 = cryptoUtils.generateSalt();
			const salt2 = cryptoUtils.generateSalt();
			
			const hash1 = await cryptoUtils.genHashPassword(password, salt1);
			const hash2 = await cryptoUtils.genHashPassword(password, salt2);
			
			expect(hash1).not.toBe(hash2);
		});

		// ✅ 测试 24：哈希长度一致
		it('should generate consistent hash length', async () => {
			const salt = cryptoUtils.generateSalt();
			const hashes = [];
			
			for (let i = 0; i < 10; i++) {
				const hash = await cryptoUtils.genHashPassword(`password${i}`, salt);
				hashes.push(hash);
			}
			
			// 所有哈希长度应该相同
			const firstLength = hashes[0].length;
			hashes.forEach(hash => {
				expect(hash.length).toBe(firstLength);
			});
		});
	});
});

