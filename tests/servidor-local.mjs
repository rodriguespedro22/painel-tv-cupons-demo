// Servidor local para desenvolvimento e testes: serve a pasta "site" com os MESMOS
// cabeçalhos de segurança (CSP etc.) definidos no netlify.toml, para que um erro de CSP
// apareça aqui antes de ir para produção.  Uso: node tests/servidor-local.mjs [porta]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pasta = path.join(raiz, "site");
const porta = Number(process.argv[2] || process.env.PORTA || 8811);

// Lê os cabeçalhos do bloco [[headers]] for = "/*" do netlify.toml
const toml = fs.readFileSync(path.join(raiz, "netlify.toml"), "utf8");
const bloco = toml.split("[[headers]]").find((b) => /for\s*=\s*"\/\*"/.test(b)) || "";
const cabecalhos = {};
for (const m of bloco.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"/gm)) if (m[1] !== "for") cabecalhos[m[1]] = m[2];

const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  if (!path.extname(p) && fs.existsSync(path.join(pasta, p + ".html"))) p += ".html";   // igual às "pretty URLs" do Netlify
  const arq = path.normalize(path.join(pasta, p));
  if (!arq.startsWith(pasta) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { ...cabecalhos, "Content-Type": tipos[path.extname(arq)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(arq).pipe(res);
}).listen(porta, () => console.log(`Painel local: http://localhost:${porta}/?demo=1   (admin: /admin.html?demo=1)`));
