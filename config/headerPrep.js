const crypto = require("crypto");

const getSignatureByInput = (privateKey, input) => {
  const privatePem = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(input);
  const signature = sign.sign(privatePem, "base64");
  return signature;
};

module.exports = getSignatureByInput;
