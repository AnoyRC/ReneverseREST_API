const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ extended: false }));

app.get("/", (req, res) => res.send("API Running"));

app.use("/api/stg/game", require("./routes/api/stg/game"));
app.use("/api/stg/user", require("./routes/api/stg/user"));

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
