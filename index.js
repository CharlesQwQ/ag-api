import express from "express";
import Database from "better-sqlite3";
import rateLimit from "express-rate-limit";

const allowed = ["TV", "MOVIE", "ONA"];
const db = new Database("db.sqlite");
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: "Too many requests, please try again later.",
});

const app = express();
app.use(express.json());
app.use(limiter);

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
    !body.hasOwnProperty("enabledFormats")
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

  return false;
}

app.get("/entries", async (req, res) => {
  if (isBad(req.body)) return res.sendStatus(400);

  let query = `SELECT * FROM entries WHERE ${req.body.enabledFormats
    .map((format) => `format = '${format}'`)
    .join(" OR ")} AND id NOT IN (${req.body.alreadyGuessed.join(
    ", "
  )}) ORDER BY RANDOM() LIMIT 1`;

  const result = db.prepare(query).get();
  return res.send(result);
});

app.listen(3000, () => {
  console.log("Server is up on port 3000");
});
