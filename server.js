const express = require("express");
const cors = require("cors");
const readme = require("readmeio");

const app = express();

app.use(cors());
app.use(express.json({ extended: false }));

app.get("/", (req, res) => res.send("API Running"));

app.use("/api/stg/game", require("./routes/api/stg/game"));
app.use("/api/stg/user", require("./routes/api/stg/user"));

app.use("/api/game", require("./routes/api/game"));
app.use("/api/user", require("./routes/api/user"));

const secret = "CDnDMoYE7QGcSQchx4MuSPumpSEObyJq";

app.post("/webhook", async (req, res) => {
  const signature = req.headers["readme-signature"];

  try {
    readme.verifyWebhook(req.body, signature, secret);
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  return res.json({});
});

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
