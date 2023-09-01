const express = require("express");
const basicAuth = require("../../../middleware/basicAuth");
const router = express.Router();
const getSignatureByInput = require("../../../config/headerPrep");
const { check, validationResult } = require("express-validator");
const config = require("config");
const { HttpRequest } = require("@aws-sdk/protocol-http");
const { randomUUID } = require("crypto");
const WebSocket = require("ws");

// @route   GET api/stg/game/connect
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

      const externalGateway = new URL(config.get("stg"));

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

// @route   GET api/stg/game/auth
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
      host: config.get("aws-host"),
      Authorization: Buffer.from(
        `${req.apiKey}.${getSignatureByInput(
          req.privateKey,
          JSON.stringify(subscription)
        )}`
      ).toString("base64"),
    };

    const url = config.get("aws-url");

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
      console.log("error", { error });
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

module.exports = router;
