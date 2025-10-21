import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwtUtils from './jwt-utils.js';

describe('jwtUtils - Real Unit Tests', () => {
	let mockContext;

	beforeEach(() => {
		mockContext = {
			env: {
				jwt_secret: 'test-secret-key-for-jwt-testing'
			}
		};
	});

	describe('generateToken', () => {
		it('should generate a valid JWT token', async () => {
			const payload = { userId: '123', email: 'test@example.com' };
			const token = await jwtUtils.generateToken(mockContext, payload, 3600);

			expect(token).toBeDefined();
			expect(typeof token).toBe('string');
			expect(token.split('.').length).toBe(3);
		});

		it('should include payload data in token', async () => {
			const payload = { userId: '456', role: 'admin' };
			const token = await jwtUtils.generateToken(mockContext, payload, 3600);

			const parts = token.split('.');
			const payloadB64 = parts[1];
			const decoder = new TextDecoder();
			const payloadJson = decoder.decode(
				Uint8Array.from(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
			);
			const decodedPayload = JSON.parse(payloadJson);

			expect(decodedPayload.userId).toBe('456');
			expect(decodedPayload.role).toBe('admin');
		});

		it('should include iat (issued at) claim', async () => {
			const payload = { userId: '789' };
			const token = await jwtUtils.generateToken(mockContext, payload, 3600);

			const parts = token.split('.');
			const payloadB64 = parts[1];
			const decoder = new TextDecoder();
			const payloadJson = decoder.decode(
				Uint8Array.from(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
			);
			const decodedPayload = JSON.parse(payloadJson);

			expect(decodedPayload.iat).toBeDefined();
			expect(typeof decodedPayload.iat).toBe('number');
		});

		it('should include exp (expiration) claim when expiresInSeconds is provided', async () => {
			const payload = { userId: '999' };
			const expiresIn = 7200;
			const token = await jwtUtils.generateToken(mockContext, payload, expiresIn);

			const parts = token.split('.');
			const payloadB64 = parts[1];
			const decoder = new TextDecoder();
			const payloadJson = decoder.decode(
				Uint8Array.from(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
			);
			const decodedPayload = JSON.parse(payloadJson);

			expect(decodedPayload.exp).toBeDefined();
			expect(decodedPayload.exp - decodedPayload.iat).toBe(expiresIn);
		});

		it('should not include exp claim when expiresInSeconds is not provided', async () => {
			const payload = { userId: '111' };
			const token = await jwtUtils.generateToken(mockContext, payload);

			const parts = token.split('.');
			const payloadB64 = parts[1];
			const decoder = new TextDecoder();
			const payloadJson = decoder.decode(
				Uint8Array.from(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
			);
			const decodedPayload = JSON.parse(payloadJson);

			expect(decodedPayload.exp).toBeUndefined();
		});

		it('should generate different tokens for same payload', async () => {
			const payload = { userId: '222' };
			const token1 = await jwtUtils.generateToken(mockContext, payload, 3600);

			// Wait a bit to ensure different iat (at least 1 second)
			await new Promise(resolve => setTimeout(resolve, 1100));

			const token2 = await jwtUtils.generateToken(mockContext, payload, 3600);

			expect(token1).not.toBe(token2);
		});
	});

	describe('verifyToken', () => {
		it('should verify a valid token', async () => {
			const payload = { userId: '333', email: 'verify@example.com' };
			const token = await jwtUtils.generateToken(mockContext, payload, 3600);

			const verified = await jwtUtils.verifyToken(mockContext, token);

			expect(verified).toBeDefined();
			expect(verified.userId).toBe('333');
			expect(verified.email).toBe('verify@example.com');
		});

		it('should return null for invalid token format', async () => {
			const invalidToken = 'invalid.token';
			const verified = await jwtUtils.verifyToken(mockContext, invalidToken);

			expect(verified).toBeNull();
		});

		it('should return null for tampered token', async () => {
			const payload = { userId: '444' };
			const token = await jwtUtils.generateToken(mockContext, payload, 3600);

			const parts = token.split('.');
			const tamperedToken = `${parts[0]}.${parts[1]}.invalid_signature`;

			const verified = await jwtUtils.verifyToken(mockContext, tamperedToken);

			expect(verified).toBeNull();
		});

		it('should return null for expired token', async () => {
			const payload = { userId: '555' };
			const token = await jwtUtils.generateToken(mockContext, payload, -1); // Expired 1 second ago

			const verified = await jwtUtils.verifyToken(mockContext, token);

			expect(verified).toBeNull();
		});

		it('should return null for token with wrong secret', async () => {
			const payload = { userId: '666' };
			const token = await jwtUtils.generateToken(mockContext, payload, 3600);

			const wrongContext = {
				env: {
					jwt_secret: 'wrong-secret-key'
				}
			};

			const verified = await jwtUtils.verifyToken(wrongContext, token);

			expect(verified).toBeNull();
		});

		it('should handle malformed base64 in token', async () => {
			const malformedToken = 'invalid!!!.invalid!!!.invalid!!!';
			const verified = await jwtUtils.verifyToken(mockContext, malformedToken);

			expect(verified).toBeNull();
		});
	});

	describe('Token Round-trip', () => {
		it('should generate and verify token successfully', async () => {
			const originalPayload = {
				userId: '777',
				email: 'roundtrip@example.com',
				role: 'user'
			};

			const token = await jwtUtils.generateToken(mockContext, originalPayload, 3600);
			const verified = await jwtUtils.verifyToken(mockContext, token);

			expect(verified).toBeDefined();
			expect(verified.userId).toBe(originalPayload.userId);
			expect(verified.email).toBe(originalPayload.email);
			expect(verified.role).toBe(originalPayload.role);
		});

		it('should preserve complex payload structures', async () => {
			const complexPayload = {
				userId: '888',
				permissions: ['read', 'write', 'delete'],
				metadata: {
					loginTime: Date.now(),
					ipAddress: '192.168.1.1'
				}
			};

			const token = await jwtUtils.generateToken(mockContext, complexPayload, 3600);
			const verified = await jwtUtils.verifyToken(mockContext, token);

			expect(verified.permissions).toEqual(['read', 'write', 'delete']);
			expect(verified.metadata.loginTime).toBe(complexPayload.metadata.loginTime);
			expect(verified.metadata.ipAddress).toBe('192.168.1.1');
		});
	});
});

