import express from "express";
import Database from "better-sqlite3";
import cors from "cors";
import seedrandom from "seedrandom";

const allowed = ["TV", "MOVIE", "ONA"];
const db = new Database("db.sqlite");

const numberOfProxies =
  process.env.NUMBER_OF_PROXIES !== "undefined"
    ? process.env.NUMBER_OF_PROXIES
    : 0;

const app = express();
app.set("trust proxy", numberOfProxies);
app.use(express.json());
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

  // enabledFormats missing
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
  console.log(req.headers["x-forwarded-for"] || req.socket.remoteAddress);

  if (!result) return res.sendStatus(204);

  return res.send(result);
});

app.get("/autocomplete", async (_, res) => {
  const query = `SELECT title_e, title_r FROM entries`;
  const result = db.prepare(query).all();

  return res.send(result);
});

app.get("/daily", async (_, res) => {
  const rng = seedrandom(new Date().toDateString());
  const number = Math.floor(rng.quick() * 1075);

  const query = `SELECT * FROM entries LIMIT 1 OFFSET ${number}; `;
  const result = db.prepare(query).get();
  
  return res.send(result);
});

app.listen(3000, () => {
  console.log("Server is up on port 3000");
});
