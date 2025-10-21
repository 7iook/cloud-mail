const verifyUtils = {
	isEmail(str) {
		return  /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(str);
	},
	isDomain(str) {
		// 修复：不允许连字符在开头或结尾
		// 正确的域名格式：字母/数字开头，可以包含连字符，但不能以连字符结尾
		return /^(?!:\/\/)([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(str);
	}
}

export default  verifyUtils
