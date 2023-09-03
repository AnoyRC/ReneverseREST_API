const express = require("express");
const basicAuth = require("../../middleware/basicAuth");
const router = express.Router();
const getSignatureByInput = require("../../config/headerPrep");
const { check, validationResult } = require("express-validator");
const config = require("config");
const { HttpRequest } = require("@aws-sdk/protocol-http");
const { randomUUID } = require("crypto");
const WebSocket = require("ws");
const tokenAuth = require("../../middleware/tokenAuth");

// @route   GET api/game/connect
// @desc    Sends a request to the Reneverse to connect a user to a game
// @access  Public
router.post(
  "/connect",
  [basicAuth, check("email", "Email is required").isEmail()],
  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const externalGateway = new URL(config.get("prod"));

      const authorizationQuery = `
      mutation gameConnectOp($email: String!) {
        GameConnect(email: $email) {
            email
            gameId
            name
            status
            userId
       }
    }
          `;

      const operation = {
        operationName: "gameConnectOp",
      };

      const mutation = {
        query: authorizationQuery,
        variables: {
          email: req.body.email,
        },
      };

      const request = new HttpRequest({
        hostname: externalGateway.hostname,
        path: externalGateway.pathname,
        body: JSON.stringify({ ...mutation, ...operation }),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: externalGateway.hostname,
          authorization: Buffer.from(
            `${req.apiKey}.${getSignatureByInput(
              req.privateKey,
              JSON.stringify(mutation)
            )}`
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
  }
);

// @route   GET api/game/auth
// @desc    Fetches Auth Token for a user
// @access  Public
router.get("/auth", basicAuth, async (req, res) => {
  try {
    if (!req.query.userId) return res.status(400).send("No user ID provided");

    const waitForSeconds = !req.query.waitForSeconds
      ? 30
      : req.query.waitForSeconds;

    const onGameConnectAuth = `
      subscription OnGameConnectAuthUpdateOp($gameId: String!, $userId: String!) {
          OnGameConnectAuthUpdate(gameId: $gameId, userId: $userId) {
              gameId
              jwt
          }
        }      
      `.trim();

    const subscription = {
      query: onGameConnectAuth,
      variables: {
        gameId: req.gameId,
        userId: req.query.userId,
      },
    };

    const headers = {
      host: config.get("aws-host-prod"),
      Authorization: Buffer.from(
        `${req.apiKey}.${getSignatureByInput(
          req.privateKey,
          JSON.stringify(subscription)
        )}`
      ).toString("base64"),
    };

    const url = config.get("aws-url-prod");

    const payload = {};

    const base64ApiHeader = Buffer.from(JSON.stringify(headers)).toString(
      "base64"
    );
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
      "base64"
    );
    const appsyncUrl =
      url + "?header=" + base64ApiHeader + "&payload=" + base64Payload;

    const ws = new WebSocket(appsyncUrl, "graphql-ws");

    const websocketSubscriptionMessage = {
      id: randomUUID(),
      payload: {
        data: JSON.stringify({
          ...subscription,
          operationName: "OnGameConnectAuthUpdateOp",
        }),
        extensions: {
          authorization: headers,
        },
      },
      type: "start",
    };

    /**
     * We need to send connection_init as soon as the web-socket is opened, and wait for
     * connection_ack before sending the subscription request.
     */
    ws.on("open", function open() {
      ws.send(
        JSON.stringify({
          type: "connection_init",
        })
      );
    });

    /**
     * Listen to events from AppSync
     */
    let initializingMode = true;
    ws.on("message", function message(event) {
      const parsedEvent = JSON.parse(event);
      console.log("Received", parsedEvent.payload);

      /**
       * If we get a data payload, we can close the connection and return the token
       * to the client
       */
      if (parsedEvent.payload?.data) {
        ws.close();
        return res.json({
          token: parsedEvent.payload?.data?.OnGameConnectAuthUpdate?.jwt,
        });
      }

      /**
       * Only runs once for the handshake with app-sync
       */
      if (initializingMode) {
        if (parsedEvent.type === "connection_ack") {
          // Acknowledge came, so we can start subscribing

          ws.send(JSON.stringify(websocketSubscriptionMessage));
          initializingMode = false;
          return;
        }
      }
    });

    /**
     * Listen for errors
     */
    ws.on("error", function message(error) {
      ws.close();
      return res.status(500).send({ error });
    });

    req.setTimeout(waitForSeconds * 1000, () => {
      ws.close();
      res.status(503);
      res.send(); // propagate cancellation
    });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

// @route   GET api/game/assetTemplates
// @desc    Fetches game assets
// @access  Public
router.get("/assetTemplates", [basicAuth, tokenAuth], async (req, res) => {
  try {
    const limit = !req.query.limit ? 10 : req.query.limit;

    const externalGateway = new URL(config.get("prod"));

    const authorizationQuery = `
    query AssetTemplates($limit: String, $nextToken: String, $assetTemplateId: String) {
       AssetTemplates(input: { limit: $limit, nextToken: $nextToken, assetTemplateId: $assetTemplateId }) { 
          items { 
            assetTemplateId 
            name 
            attributes { 
              displayType 
              maxValue 
              traitType 
              values 
            } data { 
              description 
              price 
              supply 
            } files { 
              animations 
              { 
                name 
                url 
                extension 
              } images { 
                name 
                url 
                extension 
              } 
            } gameEngineFiles { 
              name 
              url 
              extension 
            } image { 
              name 
              url 
              extension 
            } metadataTemplates { 
              backgroundColor 
              description 
              name 
            } 
          } 
          limit nextToken 
        } 
      }
        `;

    const operation = {
      operationName: "AssetTemplates",
    };

    const query = {
      query: authorizationQuery,
      variables: {
        input: {
          limit: limit,
          nextToken: "",
          assetTemplateId: "",
        },
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

// @route   GET api/game/assetTemplate
// @desc    Fetches an asset Template by ID
// @access  Public
router.get("/assetTemplate", [basicAuth, tokenAuth], async (req, res) => {
  try {
    if (!req.query.id)
      return res.status(400).send("No asset template ID provided");

    const id = req.query.id;

    const externalGateway = new URL(config.get("prod"));

    const authorizationQuery = `
    query AssetTemplates($limit: String, $nextToken: String, $assetTemplateId: String) {
       AssetTemplates(input: { limit: $limit, nextToken: $nextToken, assetTemplateId: $assetTemplateId }) { 
          items { 
            assetTemplateId 
            name 
            attributes { 
              displayType 
              maxValue 
              traitType 
              values 
            } data { 
              description 
              price 
              supply 
            } files { 
              animations 
              { 
                name 
                url 
                extension 
              } images { 
                name 
                url 
                extension 
              } 
            } gameEngineFiles { 
              name 
              url 
              extension 
            } image { 
              name 
              url 
              extension 
            } metadataTemplates { 
              backgroundColor 
              description 
              name 
            } 
          } 
          limit nextToken 
        } 
      }
        `;

    const operation = {
      operationName: "AssetTemplates",
    };

    const query = {
      query: authorizationQuery,
      variables: {
        input: {
          limit: 1,
          nextToken: "",
          assetTemplateId: id,
        },
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
    const assetTemplate = parsedResponse.data.AssetTemplates.items.find(
      (item) => item.assetTemplateId === id
    );

    return res.json(assetTemplate);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

// @route   GET api/game/assets
// @desc    Fetches all assets
// @access  Public
router.get("/assets", [basicAuth, tokenAuth], async (req, res) => {
  try {
    const limit = !req.query.limit ? 10 : req.query.limit;

    const externalGateway = new URL(config.get("prod"));

    const authorizationQuery = `
    query Assets($limit: String, $nextToken: String, $nftId: String) { 
      Assets(input: { 
        limit: $limit, 
        nextToken: $nextToken, 
        nftId: $nftId}) { 
          items { 
            assetTemplateId 
            cId 
            gameId 
            metadata { 
              name 
              description 
              image 
              animationUrl 
              attributes { 
                traitType 
                value 
              } 
            } 
            nftId 
            walletAddress 
          } 
          limit 
          nextToken 
        } 
      }
        `;

    const operation = {
      operationName: "Assets",
    };

    const query = {
      query: authorizationQuery,
      variables: {
        input: {
          limit: limit,
          nextToken: "",
          nftId: "",
        },
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
    return res.json(parsedResponse);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

// @route   GET api/game/asset
// @desc    Fetches an asset by ID
// @access  Public
router.get("/asset", [basicAuth, tokenAuth], async (req, res) => {
  try {
    if (!req.query.id) return res.status(400).send("No asset ID provided");

    const id = req.query.id;

    const externalGateway = new URL(config.get("prod"));

    const authorizationQuery = `
    query Assets($limit: String, $nextToken: String, $nftId: String) { 
      Assets(input: { 
        limit: $limit, 
        nextToken: $nextToken, 
        nftId: $nftId}) { 
          items { 
            assetTemplateId 
            cId 
            gameId 
            metadata { 
              name 
              description 
              image 
              animationUrl 
              attributes { 
                traitType 
                value 
              } 
            } 
            nftId 
            walletAddress 
          } 
          limit 
          nextToken 
        } 
      }
        `;

    const operation = {
      operationName: "Assets",
    };

    const query = {
      query: authorizationQuery,
      variables: {
        input: {
          limit: 1,
          nextToken: "",
          nftId: id,
        },
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
    const asset = parsedResponse.data.Assets.items.find(
      (item) => item.nftId === id
    );

    return res.json(asset);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

// @route   POST api/game/mint
// @desc    Mints an asset
// @access  Public
router.post(
  "/mint",
  [
    basicAuth,
    tokenAuth,
    check("assetTemplateId", "Asset Template ID is required").not().isEmpty(),
    check("userId", "User ID is required").not().isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        console.log(errors);
        return res.status(400).json({ errors: errors.array() });
      }

      const assetTemplateId = req.body.assetTemplateId;

      const isTestNet = !req.body.isTestNet
        ? true
        : req.body.isTestNet === "true";

      let metadata = null;

      if (req.body.metadata) {
        metadata = req.body.metadata;
      }

      const userId = req.body.userId;

      const externalGateway = new URL(config.get("prod"));

      const authorizationQuery = `
    mutation MintAsset($assetTemplateId: String!, $isTestNet: Boolean!, $metadata: AssetMetadataInput, $userId: String) { 
      MintAsset(input: { 
        assetTemplateId: $assetTemplateId, 
        isTestNet: $isTestNet, 
        metadata: $metadata, 
        userId: $userId
      }) 
    }
        `;

      const operation = {
        operationName: "MintAsset",
      };

      let mutation = {
        query: authorizationQuery,
        variables: {
          assetTemplateId: assetTemplateId,
          isTestNet: isTestNet,
          userId: userId,
        },
      };

      if (metadata) {
        mutation.variables.metadata = metadata;
      }

      const request = new HttpRequest({
        hostname: externalGateway.hostname,
        path: externalGateway.pathname,
        body: JSON.stringify({ ...mutation, ...operation }),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: externalGateway.hostname,
          authorization: Buffer.from(
            `${req.apiKey}.${getSignatureByInput(
              req.privateKey,
              JSON.stringify(mutation)
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
      return res.json(parsedResponse);
    } catch (err) {
      console.log(err);
      res.status(500).send(err);
    }
  }
);

// @route   POST api/game/transfer
// @desc    Transfers an asset
// @access  Public
router.post(
  "/transfer",
  [
    basicAuth,
    tokenAuth,
    check("nftId", "NFT ID is required").not().isEmpty(),
    check("receiverUserId", "Receiver User ID is required").not().isEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        console.log(errors);
        return res.status(400).json({ errors: errors.array() });
      }

      const nftId = req.body.nftId;

      const receiverUserId = req.body.receiverUserId;

      const externalGateway = new URL(config.get("prod"));

      const authorizationQuery = `
    mutation TransferAsset($nftId: String!, $receiverUserId: String!) { 
      TransferAsset(input: { 
        nftId: $nftId, 
        receiverUserId: $receiverUserId 
      }) { 
        nftId 
        receiverUserId 
      } 
    }
        `;

      const operation = {
        operationName: "TransferAsset",
      };

      const mutation = {
        query: authorizationQuery,
        variables: {
          nftId: nftId,
          receiverUserId: receiverUserId,
        },
      };

      const request = new HttpRequest({
        hostname: externalGateway.hostname,
        path: externalGateway.pathname,
        body: JSON.stringify({ ...mutation, ...operation }),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: externalGateway.hostname,
          authorization: Buffer.from(
            `${req.apiKey}.${getSignatureByInput(
              req.privateKey,
              JSON.stringify(mutation)
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
      return res.json(parsedResponse);
    } catch (err) {
      console.log(err);
      res.status(500).send(err);
    }
  }
);

module.exports = router;
