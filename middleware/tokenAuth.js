module.exports = function (req, res, next) {
  // Get Auth Token from header
  const token = req.header("x-auth-token");

  // If no Auth Token, return 401
  if (!token)
    return res.status(401).send("Access denied. No Auth Token provided.");

  req.token = token;

  next();
};
