module.exports = function requireDeveloper(req, res, next) {
  if (req.session && req.session.isDeveloper) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized — developer login required' });
  }
  return res.redirect('/developer/login');
};
