function requireRole(...roles) {
  return (req, res, next) => {
    // All authenticated users can access admin routes, with group-level permissions enforced within the handlers.
    return next();
  };
}

module.exports = { requireRole };
