/**
 * Vite插件: Share Token验证守卫
 * 在开发模式下拦截/share/:token路由,验证token有效性
 * 模拟生产环境的token验证逻辑
 */

export function shareGuardPlugin() {
    return {
        name: 'vite-plugin-share-guard',
        
        configureServer(server) {
            // 在其他中间件之前执行
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url, `http://${req.headers.host}`);
                
                // 只处理/share/路径
                if (!url.pathname.startsWith('/share/')) {
                    return next();
                }
                
                // 提取share token
                const shareToken = url.pathname.split('/share/')[1]?.split('/')[0];
                
                // 严格验证:必须是32字符的有效token格式
                if (!shareToken || shareToken.length !== 32) {
                    console.log(`[ShareGuard] Invalid token format: ${shareToken || 'empty'}`);
                    return send404(res);
                }
                
                // 调用后端API验证token
                try {
                    const backendUrl = process.env.VITE_API_URL || 'http://127.0.0.1:8787';
                    const response = await fetch(`${backendUrl}/api/share/info/${shareToken}`);
                    
                    if (!response.ok) {
                        console.log(`[ShareGuard] Token validation failed: ${shareToken}, Status: ${response.status}`);
                        return send404(res);
                    }
                    
                    console.log(`[ShareGuard] Token valid: ${shareToken}`);
                    // Token有效,继续到Vue SPA
                    next();
                    
                } catch (error) {
                    console.error(`[ShareGuard] Validation error for token ${shareToken}:`, error.message);
                    return send404(res);
                }
            });
        }
    };
}

// 发送404响应（激进式安全策略 - 纯文本响应）
// 与生产环境保持一致，完全不渲染HTML内容
function send404(res) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end('Not Found');
}
