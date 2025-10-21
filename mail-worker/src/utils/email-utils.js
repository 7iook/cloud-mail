import { parseHTML } from 'linkedom';

const emailUtils = {

	getDomain(email) {
		if (typeof email !== 'string') return '';
		const parts = email.split('@');
		return parts.length === 2 ? parts[1] : '';
	},

	getName(email) {
		if (typeof email !== 'string') return '';
		const parts = email.trim().split('@');
		return parts.length === 2 ? parts[0] : '';
	},

	htmlToText(content) {
		// 修复：处理空值和 null 情况
		if (!content) return '';
		const { document } = parseHTML(content);
		if (!document || !document.documentElement) return '';

		// 移除不需要的标签
		document.querySelectorAll('style, script, title').forEach(el => el.remove());

		// 使用 innerText 或 textContent，但先尝试获取所有可见文本
		// linkedom 可能有特殊的行为，所以我们使用 querySelectorAll 来获取所有文本元素
		const textParts = [];
		const allElements = document.querySelectorAll('*');

		for (const el of allElements) {
			// 跳过脚本、样式等不可见元素
			if (['SCRIPT', 'STYLE', 'TITLE', 'META', 'LINK'].includes(el.tagName)) {
				continue;
			}

			// 获取直接文本节点
			for (const node of el.childNodes) {
				if (node.nodeType === 3) { // TEXT_NODE
					const text = node.textContent.trim();
					if (text) {
						textParts.push(text);
					}
				}
			}
		}

		// 如果没有找到任何文本，尝试使用 textContent
		if (textParts.length === 0) {
			return (document.documentElement.textContent || '').trim();
		}

		return textParts.join(' ').trim();
	}
};

export default emailUtils;
