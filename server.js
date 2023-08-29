const express = require("express");
const cors = require("cors");
require("dotenv").config();
const crypto = require("crypto");
const { HttpRequest } = require("@aws-sdk/protocol-http");

const app = express();

app.use(cors());
app.use(express.json({ extended: false }));

const gameId = "c2f28c4c-206c-49da-bba3-8ea9c9b62356";
const APIKey = "1db338bb-cc1c-4760-b1c6-dfcae73c7ba9";
const privateKey =
  "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCt2RZcik2tB7CvlWtVRIYOoP3Ih91aAdvRT8ZCACC1kNGowsqETFU+enlAy0xIsRhGfBj99vuPh50rupCI8LQ9uFVK0eXbYD3CbNbtyKm+Xz8drehwcsGwkJlRPAY2KRkTsJv3Bffi2x80f2kNSCaKt0YGq4m6kXk+tOiLH1mf1apYspvaXvxLaxZJRXXBA8qbc0qtvWBIGxF5K0DYjqZlVhBNLDhuTrhpwGzHn7U6jkNlk680G8Pew4ThYUiKVEtGE/rwv3miCSAn19EOTpJKqlu3vbxTJjs1VwICcC5789s18sQkOAC46IIQyOyVlHONhnykUxBM9i21dSTSGB//AgMBAAECggEATcNUSFKpCiPteazplPuQx4xl2MRFVBSOwiLf+Pfbqbu8vLNdKS6H1umrwTruxXlJ9YVfHILU5c/wkvXh3w9kYFNK+6vGGIoFNim/Ph/LJdevANSgq2P5lcQogHjMAoABspgGO8nUpwoC/FWdpQ5IBzaRwTwL4INf65e6iTidu2t3JXEwPEzncx0icVXJ6S7B/ARLOLkO/npsnkzE1Bnhbgx79oEzvXeI7o5zfZ817Jm5T1Rn55lB6Iiw8XMTylcm6KmATwy1oAqsmtzcthG+NMXbOfHiulozKSORXKN0ji83SFo5suq8/q7Ia39nUqlDzckZypVlm6XRacfjlOLCsQKBgQDojG1u/x6LmCdR4Q0tPTFPVan/vFy7eHgZVk0sJkG92iuHo5dXk1+ro8WIOtZO13jlDo8LNrBEg3ZQ0ue0NLufl/7j6K0Cz2UuoaK/skRDLVfD4USn+i7jGsK58hokLCy9UUM53e6PUxqgl8P34dLBksPb66o66LDSycXaOXBaWQKBgQC/YTiy7z1eVc1LTCjZsmNUcufoWacRJ0QR4figkdxh66Mq7OaWnwQgkdVk3jjXoEJi80i6RpuF6HPDTplkAzQcbg8kqtCssnvfPfCbX0jt1g3kigIZUHqF01BT51HvJ+6uQgIJrNTe2ZxkN3tUYJ2rLSGpPQ4G2n2sCKPLw5vSFwKBgC/nHXPL4cLnqNHZBhnXjRzGjKo9ZuzHOBYgDO2XQ9uT4XujWz2TAhYdOkeBtzuubxzgDt9EeLLkUa78gvZAFpYdfUf9WgZGKpWcfiX21tDvujCDat0fUCFAFfSvxmrFHsIwxyRYbxffCpEiMiARyJRPY0EeHobb//Cr17HIOzihAoGAaj6v+m5klF1v5jB2sTyedkCATHaREC3LVV4s5/9x6I6ne+oerVnEMcykOiZASjy2/jXvlzIhnvqIYdHdyC8bG/lhwMpvpKBFso6xZ6BDXX4rIkgXmDQcgPTqMFpIG0wA7o7IkNR5LOqELwK6HgKxJVmdyVWS1u0vPXVicXm7pKsCgYB5oGukqp1y2EtlWQLVNgSvsZ5IXX8uXRDy6u4PL6ekf6QHnI53x799uCeqDNiv5JTMm+d/CQ9fsEf/4HjFBjo2bmsVoWyAPYhuvx2Bw7LT0WZO6UJmhG5mb9XDXct23qZdmEZitvHOF00Ga8l4YtZZAhogkB8oDdQ0T24Y3dxfnw==";

app.get("/", (req, res) => res.send("API Running"));

const getSignatureByInput = (input) => {
  const privatePem = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(input);
  const signature = sign.sign(privatePem, "base64");
  return signature;
};

app.post("/api/game/connect", async (req, res) => {
  try {
    const externalGateway = new URL("https://api.stg.reneverse.io/graphql");

    const authorizationQuery = `
    mutation GameConnect($email: String!) { GameConnect(email: $email) {gameId name userId status } }
        `;

    const operation = {
      operationName: "GameConnect",
    };

    const mutation = {
      query: authorizationQuery,
      operationName: operation,
      variables: {
        email: "anoyroyc@reneverse.io",
      },
    };

    const token = "";

    const request = new HttpRequest({
      hostname: externalGateway.hostname,
      path: externalGateway.pathname,
      body: JSON.stringify({ ...mutation, ...operation }),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: externalGateway.hostname,
        authorization: Buffer.from(
          `${APIKey}.${getSignatureByInput(JSON.stringify(mutation))}`
        ).toString("base64"),
      },
    });

    console.log(request);
    const response = await fetch(externalGateway.href, {
      headers: request.headers,
      body: request.body,
      method: request.method,
    });

    return res.json(response);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
