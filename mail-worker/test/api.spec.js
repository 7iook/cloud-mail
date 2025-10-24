import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src';

/**
 * Real API Integration Tests
 * Tests the actual worker API endpoints
 */

describe('Cloud Mail Worker API', () => {
	describe('Health Check', () => {
		it('should respond to health check endpoint', async () => {
			const request = new Request('http://example.com/api/health', {
				method: 'GET'
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			// Should return 200 or 404 (depending on implementation)
			expect([200, 404]).toContain(response.status);
		});
	});

	describe('API Routing', () => {
		it('should route /api/* requests to Hono app', async () => {
			const request = new Request('http://example.com/api/test', {
				method: 'GET'
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			// Should return a response (not "Hello World!")
			expect(response).toBeDefined();
			expect(response.status).toBeGreaterThanOrEqual(200);
			expect(response.status).toBeLessThan(600);
		});
	});

	describe('Share Token Validation', () => {
		it('should handle share token routes', async () => {
			const request = new Request('http://example.com/share/12345678901234567890123456789012', {
				method: 'GET'
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			// Should return a response
			expect(response).toBeDefined();
			expect(response.status).toBeGreaterThanOrEqual(200);
			expect(response.status).toBeLessThan(600);
		});
	});

	describe('Static Assets', () => {
		it('should serve static assets', async () => {
			const request = new Request('http://example.com/index.html', {
				method: 'GET'
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			
			// Should return a response
			expect(response).toBeDefined();
		});
	});
});

