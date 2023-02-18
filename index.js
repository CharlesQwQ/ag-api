import express from "express";
import Database from "better-sqlite3";
import rateLimit from "express-rate-limit";
import cors from "cors";

const allowed = ["TV", "MOVIE", "ONA"];
const db = new Database("db.sqlite");
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: "Too many requests, please try again later.",
});

const numberOfProxies =
  process.env.NUMBER_OF_PROXIES !== "undefined"
    ? process.env.NUMBER_OF_PROXIES
    : 0;

const app = express();
app.set("trust proxy", numberOfProxies);
app.use(express.json());
app.use(limiter);
app.use(cors());

app.use((err, _, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.sendStatus(400);
  }
  next();
});

function isBad(body) {
  // empty json
  if (Object.keys(body).length === 0) return true;

  // missing keys
  if (
    !body.hasOwnProperty("alreadyGuessed") ||
    !body.hasOwnProperty("enabledFormats") ||
    !body.hasOwnProperty("userEntries")
  )
    return true;

  // alreadyGuessed wonky
  if (
    !body.alreadyGuessed.every((n) => {
      return typeof n === "number";
    })
  )
    return true;

  // enabledFormats wonky
  if (body.enabledFormats.some((format) => !allowed.includes(format)))
    return true;

  // enabledFormats empty
  if (body.enabledFormats.length == 0) return true;

  return false;
}

app.put("/entries", async (req, res) => {
  if (isBad(req.body)) return res.sendStatus(400);

  let query = `SELECT * FROM entries WHERE (${req.body.enabledFormats
    .map((format) => `format = '${format}'`)
    .join(" OR ")}) AND id NOT IN (${req.body.alreadyGuessed.join(", ")}) ${
    req.body.userEntries.length == 0
      ? ""
      : `AND id IN (${req.body.userEntries.join(", ")}) `
  }ORDER BY RANDOM() LIMIT 1`;

  const result = db.prepare(query).get();

  if(!result) {
    return res.sendStatus(418);
  }
  return res.send(result);
});

app.get("/autocomplete", async (req, res) => {
  const query = `SELECT title_e, title_e, title_r FROM entries`;
  const result = db.prepare(query).all();

  return res.send(result);
});

app.listen(3000, () => {
  console.log("Server is up on port 3000");
});
