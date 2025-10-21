import JwtUtils from '../utils/jwt-utils';
import constant from '../const/constant';

const userContext = {
	getUserId(c) {
		const user = c.get('user');
		if (!user) {
			throw new Error('User context not found');
		}
		return user.userId;
	},

	getUser(c) {
		return c.get('user');
	},

	async getToken(c) {
		const jwt = c.req.header(constant.TOKEN_HEADER);
		const { token } = JwtUtils.verifyToken(c,jwt);
		return token;
	},
};
export default userContext;
