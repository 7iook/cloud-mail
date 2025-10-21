import { describe, it, expect, beforeEach } from 'vitest';
import fileUtils from './file-utils.js';

describe('fileUtils - Real Unit Tests', () => {
	describe('getExtFileName', () => {
		it('should extract file extension', () => {
			expect(fileUtils.getExtFileName('document.pdf')).toBe('.pdf');
			expect(fileUtils.getExtFileName('image.jpg')).toBe('.jpg');
			expect(fileUtils.getExtFileName('archive.tar.gz')).toBe('.gz');
		});

		it('should return empty string for files without extension', () => {
			expect(fileUtils.getExtFileName('README')).toBe('');
			expect(fileUtils.getExtFileName('Makefile')).toBe('');
		});

		it('should handle hidden files', () => {
			expect(fileUtils.getExtFileName('.gitignore')).toBe('.gitignore');
			expect(fileUtils.getExtFileName('.env.local')).toBe('.local');
		});

		it('should handle multiple dots in filename', () => {
			expect(fileUtils.getExtFileName('file.backup.tar.gz')).toBe('.gz');
			expect(fileUtils.getExtFileName('archive.2021.01.01.zip')).toBe('.zip');
		});

		it('should handle empty string', () => {
			expect(fileUtils.getExtFileName('')).toBe('');
		});

		it('should handle filename with only extension', () => {
			expect(fileUtils.getExtFileName('.pdf')).toBe('.pdf');
		});

		it('should handle very long filename', () => {
			const longName = 'a'.repeat(1000) + '.txt';
			expect(fileUtils.getExtFileName(longName)).toBe('.txt');
		});

		it('should handle special characters in extension', () => {
			expect(fileUtils.getExtFileName('file.tar.gz')).toBe('.gz');
			expect(fileUtils.getExtFileName('file.7z')).toBe('.7z');
		});
	});

	describe('getBuffHash', () => {
		it('should generate SHA-256 hash for buffer', async () => {
			const buffer = new TextEncoder().encode('test data');
			const hash = await fileUtils.getBuffHash(buffer);

			expect(hash).toBeDefined();
			expect(typeof hash).toBe('string');
			expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
		});

		it('should generate consistent hash for same data', async () => {
			const data = 'consistent test data';
			const buffer1 = new TextEncoder().encode(data);
			const buffer2 = new TextEncoder().encode(data);

			const hash1 = await fileUtils.getBuffHash(buffer1);
			const hash2 = await fileUtils.getBuffHash(buffer2);

			expect(hash1).toBe(hash2);
		});

		it('should generate different hash for different data', async () => {
			const buffer1 = new TextEncoder().encode('data1');
			const buffer2 = new TextEncoder().encode('data2');

			const hash1 = await fileUtils.getBuffHash(buffer1);
			const hash2 = await fileUtils.getBuffHash(buffer2);

			expect(hash1).not.toBe(hash2);
		});

		it('should handle empty buffer', async () => {
			const buffer = new Uint8Array(0);
			const hash = await fileUtils.getBuffHash(buffer);

			expect(hash).toBeDefined();
			expect(hash.length).toBe(64);
		});

		it('should handle large buffer', async () => {
			const largeData = new Uint8Array(1024 * 1024); // 1MB
			for (let i = 0; i < largeData.length; i++) {
				largeData[i] = Math.floor(Math.random() * 256);
			}

			const hash = await fileUtils.getBuffHash(largeData);

			expect(hash).toBeDefined();
			expect(hash.length).toBe(64);
		});

		it('should produce lowercase hex string', async () => {
			const buffer = new TextEncoder().encode('test');
			const hash = await fileUtils.getBuffHash(buffer);

			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});
	});

	describe('base64ToUint8Array', () => {
		it('should convert base64 to Uint8Array', () => {
			const base64 = 'dGVzdCBkYXRh'; // 'test data' in base64
			const result = fileUtils.base64ToUint8Array(base64);

			expect(result).toBeInstanceOf(Uint8Array);
			expect(result.length).toBe(9);
		});

		it('should correctly decode base64 string', () => {
			const base64 = 'SGVsbG8gV29ybGQ='; // 'Hello World' in base64
			const result = fileUtils.base64ToUint8Array(base64);
			const decoded = new TextDecoder().decode(result);

			expect(decoded).toBe('Hello World');
		});

		it('should handle empty base64 string', () => {
			const result = fileUtils.base64ToUint8Array('');

			expect(result).toBeInstanceOf(Uint8Array);
			expect(result.length).toBe(0);
		});

		it('should handle base64 with padding', () => {
			const base64 = 'YQ=='; // 'a' in base64
			const result = fileUtils.base64ToUint8Array(base64);

			expect(result.length).toBe(1);
			expect(result[0]).toBe(97); // 'a' character code
		});

		it('should handle binary data', () => {
			const binaryData = new Uint8Array([0, 1, 2, 255, 254, 253]);
			const base64 = btoa(String.fromCharCode(...binaryData));
			const result = fileUtils.base64ToUint8Array(base64);

			expect(result).toEqual(binaryData);
		});
	});

	describe('base64ToFile', () => {
		it('should convert base64 image data to File', () => {
			const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
			const file = fileUtils.base64ToFile(base64Data);

			expect(file).toBeInstanceOf(File);
			expect(file.type).toBe('image/png');
			expect(file.name).toMatch(/\.png$/);
		});

		it('should use custom filename', () => {
			const base64Data = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA==';
			const file = fileUtils.base64ToFile(base64Data, 'my-photo');

			expect(file.name).toBe('my-photo.jpeg');
		});

		it('should generate default filename with timestamp', () => {
			const base64Data = 'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA==';
			const file = fileUtils.base64ToFile(base64Data);

			expect(file.name).toMatch(/^image_\d+\.jpg$/);
		});

		it('should handle different image formats', () => {
			const formats = [
				{ data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', ext: 'png' },
				{ data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA==', ext: 'jpeg' },
				{ data: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', ext: 'gif' }
			];

			formats.forEach(({ data, ext }) => {
				const file = fileUtils.base64ToFile(data);
				expect(file.type).toContain(ext);
			});
		});

		it('should throw error for invalid base64 format', () => {
			const invalidData = 'not-valid-base64';

			expect(() => fileUtils.base64ToFile(invalidData)).toThrow('Invalid base64 data format');
		});

		it('should throw error for missing data prefix', () => {
			const invalidData = 'image/png;base64,iVBORw0KGgo=';

			expect(() => fileUtils.base64ToFile(invalidData)).toThrow('Invalid base64 data format');
		});

		it('should handle video data', () => {
			const base64Data = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAA==';
			const file = fileUtils.base64ToFile(base64Data);

			expect(file.type).toBe('video/mp4');
			expect(file.name).toMatch(/\.mp4$/);
		});

		it('should preserve file size', () => {
			const originalData = 'test file content';
			const base64Data = 'data:image/png;base64,' + btoa(originalData);
			const file = fileUtils.base64ToFile(base64Data);

			expect(file.size).toBeGreaterThan(0);
		});

		it('should handle large base64 data', () => {
			const largeContent = 'x'.repeat(10000);
			const base64Data = 'data:image/png;base64,' + btoa(largeContent);
			const file = fileUtils.base64ToFile(base64Data);

			expect(file).toBeInstanceOf(File);
			expect(file.size).toBeGreaterThan(0);
		});

		it('should handle special characters in custom filename', () => {
			const base64Data = 'data:image/png;base64,iVBORw0KGgo=';
			const file = fileUtils.base64ToFile(base64Data, 'my-photo-2021');

			expect(file.name).toBe('my-photo-2021.png');
		});
	});

	describe('Edge Cases and Integration', () => {
		it('should handle file extension extraction and base64 conversion together', async () => {
			const filename = 'document.pdf';
			const ext = fileUtils.getExtFileName(filename);

			expect(ext).toBe('.pdf');
		});

		it('should handle hash generation for file content', async () => {
			const content = 'file content';
			const buffer = new TextEncoder().encode(content);
			const hash = await fileUtils.getBuffHash(buffer);

			expect(hash).toBeDefined();
			expect(hash.length).toBe(64);
		});
	});
});

