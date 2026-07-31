const { verifyToken } = require('../utils/jwt');

module.exports = function authMiddleware(req, res, next) {
  const url = req.originalUrl || req.path || '';

  // Allow health check and auth routes without token
  if (url === '/health' || url.includes('/api/auth')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For seamless guest access & dev fallback
    req.user = { id: 'guest', name: 'Guest User', email: 'guest@quizzy.app' };
    return next();
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid or expired JWT token.',
    });
  }

  req.user = decoded;
  next();
};
