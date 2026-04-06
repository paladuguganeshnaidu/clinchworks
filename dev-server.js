const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const ROOT = __dirname;

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0].split("#")[0];

  if (urlPath.endsWith(".html")) {
    if (urlPath.endsWith("index.html")) {
      const redirectUrlStr = urlPath.replace(/index\.html$/, "");
      res.writeHead(301, { Location: redirectUrlStr || "/" });
      return res.end();
    } else {
      const redirectUrlStr = urlPath.replace(/\.html$/, "");
      res.writeHead(301, { Location: redirectUrlStr });
      return res.end();
    }
  }

  let filePath = path.join(ROOT, urlPath);
  let extname = String(path.extname(filePath)).toLowerCase();

  if (!extname && urlPath !== "/") {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isDirectory()) {
      const potentialHtmlPath = filePath + ".html";
      if (fs.existsSync(potentialHtmlPath)) {
        filePath = potentialHtmlPath;
        extname = ".html";
      }
    }
  }

  if (urlPath === "/" || (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())) {
    filePath = path.join(filePath, "index.html");
    extname = ".html";
  }

  const contentType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if(err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>404 Not Found</h1>", "utf-8");
      } else {
        res.writeHead(500);
        res.end("Server Error: " + err.code);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });

}).listen(PORT);

console.log(`Test environment mirroring GoDaddy .htaccess running on http://localhost:${PORT}`);

