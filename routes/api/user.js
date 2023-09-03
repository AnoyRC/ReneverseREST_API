const express = require("express");
const basicAuth = require("../../middleware/basicAuth");
const router = express.Router();
const getSignatureByInput = require("../../config/headerPrep");
const { check, validationResult } = require("express-validator");
const config = require("config");
const { HttpRequest } = require("@aws-sdk/protocol-http");
const tokenAuth = require("../../middleware/tokenAuth");

// @route   GET api/user/profile
// @desc    Get user profile
// @access  Public
router.get("/profile", [basicAuth, tokenAuth], async (req, res) => {
  try {
    const externalGateway = new URL(config.get("prod"));

    const authorizationQuery = `
        query User { 
            User 
            { 
                userId 
                email 
                data { 
                    firstName 
                    lastName 
                } 
                externalAccounts { 
                    discordId 
                    steamId 
                    twitterId 
                } 
                image { 
                    url 
                } 
                stats { 
                    assets 
                    games 
                    value 
                }  
            } 
        }
            `;

    const operation = {
      operationName: "User",
    };

    const query = {
      query: authorizationQuery,
      variables: {},
    };

    const request = new HttpRequest({
      hostname: externalGateway.hostname,
      path: externalGateway.pathname,
      body: JSON.stringify({ ...query, ...operation }),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: externalGateway.hostname,
        authorization: Buffer.from(
          `${req.apiKey}.${getSignatureByInput(
            req.privateKey,
            JSON.stringify(query)
          )}.${req.token}`
        ).toString("base64"),
      },
    });

    const response = await fetch(externalGateway.href, {
      headers: request.headers,
      body: request.body,
      method: request.method,
    });

    const parsedResponse = await response.json();
    res.json(parsedResponse);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

// @route   GET api/user/search
// @desc    Search for user
// @access  Public
router.get("/search", [basicAuth, tokenAuth], async (req, res) => {
  try {
    const term = req.query.term;

    if (!term) {
      return res.status(400).json({ msg: "Please enter a search term." });
    }

    const externalGateway = new URL(config.get("prod"));

    const authorizationQuery = `
      query UserSearch($userSearchTerm: String!) { 
        UserSearch(input: { userSearchTerm: $userSearchTerm }) { 
            items { 
                userId 
                email 
                data { 
                    firstName 
                    lastName 
                } 
                externalAccounts { 
                    discordId 
                    steamId 
                    twitterId 
                } 
                image { 
                    url 
                } 
                stats { 
                    assets 
                    games 
                    value 
                } 
            } 
            limit 
            nextToken 
        } 
    }
              `;

    const operation = {
      operationName: "UserSearch",
    };

    const query = {
      query: authorizationQuery,
      variables: {
        userSearchTerm: term,
      },
    };

    const request = new HttpRequest({
      hostname: externalGateway.hostname,
      path: externalGateway.pathname,
      body: JSON.stringify({ ...query, ...operation }),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: externalGateway.hostname,
        authorization: Buffer.from(
          `${req.apiKey}.${getSignatureByInput(
            req.privateKey,
            JSON.stringify(query)
          )}.${req.token}`
        ).toString("base64"),
      },
    });

    const response = await fetch(externalGateway.href, {
      headers: request.headers,
      body: request.body,
      method: request.method,
    });

    const parsedResponse = await response.json();
    res.json(parsedResponse);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

module.exports = router;
