module.exports = function (req, res, next) {
  // Get Game ID from header
  const gameId = req.header("x-gameId");

  // If no Game ID, return 401
  if (!gameId)
    return res.status(401).send("Access denied. No Game ID provided.");

  // Get API Key from header
  const apiKey = req.header("x-apiKey");

  // If no API Key, return 401
  if (!apiKey)
    return res.status(401).send("Access denied. No API Key provided.");

  //Get Private Key from header
  const privateKey = req.header("x-privateKey");

  // If no Private Key, return 401
  if (!privateKey)
    return res.status(401).send("Access denied. No Private Key provided.");

  req.gameId = gameId;
  req.apiKey = apiKey;
  req.privateKey = privateKey;

  next();
};
