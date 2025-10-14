// Fix P0-5: XSS 防护工具
// 用于清理用户输入，防止 XSS 攻击

const sanitizeUtils = {
	/**
	 * HTML 转义，防止 XSS 攻击
	 * @param {string} input - 用户输入
	 * @returns {string} 转义后的字符串
	 */
	escapeHtml(input) {
		if (typeof input !== 'string') return input;
		
		const htmlEscapeMap = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#x27;',
			'/': '&#x2F;'
		};
		
		return input.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char]);
	},
	
	/**
	 * 清理用户输入，移除潜在危险字符
	 * @param {string} input - 用户输入
	 * @param {number} maxLength - 最大长度
	 * @returns {string} 清理后的字符串
	 */
	sanitizeInput(input, maxLength = 500) {
		if (typeof input !== 'string') return '';
		
		// 移除控制字符和零宽字符
		let cleaned = input.replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, '');
		
		// HTML 转义
		cleaned = this.escapeHtml(cleaned);
		
		// 长度限制
		if (cleaned.length > maxLength) {
			cleaned = cleaned.substring(0, maxLength);
		}
		
		return cleaned.trim();
	},
	
	/**
	 * 验证并清理邮箱地址
	 * @param {string} email - 邮箱地址
	 * @returns {string} 清理后的邮箱（小写）
	 */
	sanitizeEmail(email) {
		if (typeof email !== 'string') return '';
		return email.trim().toLowerCase();
	}
};

export default sanitizeUtils;
