const domainUtils = {
	toOssDomain(domain) {

		if (!domain) {
			return null
		}

		// 先移除末尾的斜杠
		if (domain.endsWith("/")) {
			domain = domain.slice(0, -1);
		}

		// 检查是否已经有协议（http:// 或 https://）
		if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
			return 'https://' + domain
		}

		return domain
	}
}

export default  domainUtils
