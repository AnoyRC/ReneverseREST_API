const express = require("express");
const cors = require("cors");
const { KJUR, RSAKey, pemtohex, KEYUTIL } = require("jsrsasign");
require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");
const web3 = require("web3");

const app = express();

app.use(cors());
app.use(express.json({ extended: false }));

const gameId = "ec61338d-88f2-4439-ac57-4e6ef914c7d5";
const APIKey = "334e4afd-d308-42fa-b6be-208d3d48c1d4";
const privateKey =
  "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDU9LiRB59ZXQLwHdUKrYFBJFf/MSTMSCB/z8iCZz0TAQyBI3/Viuextp/CA993hjAKBbhSdqb7eEEWISYRtQOP6CtXvpTPG27B+epHD2yZekVIQnJVbrNpnh1ogv4Wj2mEVsW/1xs6KI0BTV2HyDyjA2Ol8MeceBnvB4wriic4tvGGEZ2KOAQVk8zIEGDc+oAyIgQ3DFu3PlQnsesP9UowriaHgQt6E2gGZjhjmwcjUut/GX/Hn6jG3YlGvZKCr7O38l5SNoWfPA+BF3y7DFoC0pkz7HGsYo1ZLyFPr8nXYsi5LlD+3X/uaubCucQ/XQ9DH/JRUvNfgUnEP8/83EobAgMBAAECggEAaiUYoeFkwcwknL6h49KbrHaLDf3W06PX3x0YWjdPL9vD+dJR84Rq/B+E/dWkWxUdeMFlIGVX0dwcxQT8zrKk9ePJRtENpzWLPVBuP8EmZlGVmvDTwFWPQ8O18NPqBiCxfW8q3fY/8fsoXU/MoNNjtfUIhDvBovISKxxd943DAvbz9KHdLHbFzL1ba2/7+Vh74zJLI8ng63/JOCOwwNZB18Kb2eTqN+8MkRySCHPUZfzoHvlm/UdLjqFNmyTSIoQFyNpelqOCLQLyNckwcCps0tPiJ8M/mQIkcbks30UKrcKKrRyaCOke0A8AK3vwYSs6S1TClMiaDngYML3v00pH0QKBgQDzFNEln1LrDo0/kyIjqVTUgo80orCq/fa9Pszh9Ooqwv/KKvlJTD2boZPL9niSXyHZezaeTWeRtcnF7TEs/vWTKrj67f6OW1ebUGs82BHGdRZas9R8/n2+pvmXeK1jkaIFQrdXDOvJM3jABy7p2ZNMAiSdKstX1ZXLjCpuPum5ZwKBgQDgRgplN1YekGm36V84aStnyhuX59QrUDZz0RQ870o8XLPtkz3TCZJdqEHi9Ytut7yI7uMZua4XbYO0FHyCS/1ljnYQ3G+R8h0K10Iy7fGWaYH2Fxl7LI5C0wRxhr6cWz9zi3kpZLrflSRmUT3tXrDkgl1Tag8NytLpT7/8jtzVLQKBgQCCF4f/PI9h4T3S4mmI8FzIBr+hidhHCvf8PBnma+7Ox+GhTvJvOfBW1FiG9fd9TpCNFhYbDo35O3MrDFAfJqxDAMBS+wAbK+Ns6dMakwCgV5WJIWj9JC4j1LULTbht60jsy9HXMsEVwwhCrRV8bccZDKSPwJFnBpXOg8tJiT4IzQKBgQCJyz7T1V36RWxO7PnuJN/gUxMFEBER06TBH/K5RaRs1eBO1aqkoTrmhFyG36qdihIyZ+PsiGLoTgcfe37MZ3f3D8KGtYlvODyTzpIDzKIkcgrBcovbXBLEB/aw8cLnOkEP8t+siREwEehdXQkZcJZqr5Y7i+xX4wgXBULGH9iauQKBgGikYmlv2z48xIHKMl51Ps04FUSZEYy4KGUd1wPoz03k4a6lr7Ha/IKwVDYuifX5RZH98KoAjd2y424uqE/H+dKU45vTIP+8mDLIme6PuG+iEGvolQj71hJA/0W6eWyaec4KUxPeNPvJikZrGGyP+tC4LBRuBPUmDtvDu8lhdHRM";

app.get("/", (req, res) => res.send("API Running"));

app.post("/api/game/connect", async (req, res) => {
  try {
    const query =
      "mutation GameConnect($email: String!) { GameConnect(email: $email) {gameId name userId status } }";
    const variables = { email: "anoyroyc3545@gmail.com" };
    const url = "http://api.reneverse.io/graphql";
    let utf8Encode = new TextEncoder();

    const body = {
      query: query,
      operationName: "GameConnect",
      variables: variables,
    };

    const queryInput = JSON.stringify({
      query,
      variables,
    });

    const encodedInput = utf8Encode.encode(queryInput);

    const PEMPrivateKeyString =
      "-----BEGIN PRIVATE KEY-----\r\n" +
      privateKey +
      "\r\n-----END PRIVATE KEY-----";

    // const signer = crypto.createSign("RSA-SHA256");
    // signer.update(encodedInput);
    // const Signature = signer.sign(PEMPrivateKeyString, "base64");

    const prvKey = KEYUTIL.getKeyFromPlainPrivatePKCS8PEM(PEMPrivateKeyString);
    var sig = new KJUR.crypto.Signature({ alg: "SHA256withRSA" });
    sig.init(prvKey);
    sig.updateString(encodedInput);
    var hexSign = sig.sign();
    var Signature = Buffer.from(hexSign, "hex").toString("base64");

    const value = APIKey + "." + Signature;
    const output = value.replace("=", "*");
    console.log(output);

    const header = {
      "Content-Type": "application/json",
      "Accept-Charset": "utf-8",
      "Accept-Encoding": "gzip, deflate, br",
      Host: "api.reneverse.io",
      Accept: "application/graphql+json",
      Accept: "application/json;charset=UTF-8",
      authorization: output,
    };

    const response = await axios
      .post(url, body, { headers: header })
      .catch((err) => {
        return res.status(500).send(err);
      });
    return res.json(response.data);
  } catch (err) {
    res.status(500).send(err);
  }
});

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
