const jwt = require("jsonwebtoken");

function extractToken(req) {
  const headerToken = req.header("x-auth-token");
  if (headerToken) return headerToken;

  const authHeader = req.header("authorization") || req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  if (req.body && req.body.token) return req.body.token;
  if (req.query && req.query.token) return req.query.token;

  return null;
}

function auth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    res.locals.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ msg: "Token is not valid" });
  }
}

module.exports = auth;
