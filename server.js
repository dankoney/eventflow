/**
 * Production HTTP entry for hosts (e.g. Plesk) that require a single startup file
 * instead of `next start`. Point "Application startup file" to: server.js
 *
 * Local development: use `npm run dev` (not this file).
 */
process.env.NODE_ENV ||= "production";

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
