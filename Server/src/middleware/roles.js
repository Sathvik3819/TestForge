function requireRole(...roles) {
  return (req, res, next) => {
    if (!res.locals.user || !roles.includes(res.locals.user.role)) {
      return res.status(403).json({ msg: "Forbidden: insufficient role" });
    }

    return next();
  };
}

module.exports = { requireRole };
