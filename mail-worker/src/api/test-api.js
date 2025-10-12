import app from '../hono/hono';

app.get('/test/env', async (c) => {
	return c.json({
		jwt_secret: c.env.jwt_secret,
		jwt_secret_type: typeof c.env.jwt_secret,
		jwt_secret_length: c.env.jwt_secret?.length
	});
});
