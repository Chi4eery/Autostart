const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'change_me');
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Недействительный или устаревший токен' });
  }
}

function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'change_me');
  } catch (error) {
    req.user = null;
  }

  return next();
}

authenticate.optional = optionalAuthenticate;

module.exports = authenticate;
