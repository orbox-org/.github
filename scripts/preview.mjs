// Lightweight GitHub-flavored Markdown preview server for the org profile.
// Renders README.md and profile/README.md the way GitHub does and serves them
// with the official github-markdown-css so maintainers can eyeball changes
// before pushing. Files are read fresh on every request, so a browser refresh
// reflects edits immediately.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

// The documents to preview, keyed by URL path. The org profile page on GitHub
// renders profile/README.md, while README.md is the repo landing page.
const DOCS = {
  "/": { file: "profile/README.md", title: "Org profile · profile/README.md" },
  "/repo": { file: "README.md", title: "Repo README · README.md" },
};

const marked = new Marked({ gfm: true, breaks: false });
marked.use(gfmHeadingId());

async function githubCss() {
  const cssPath = join(
    ROOT,
    "node_modules",
    "github-markdown-css",
    "github-markdown.css",
  );
  return readFile(cssPath, "utf8");
}

function page(title, bodyHtml, css) {
  const nav = Object.entries(DOCS)
    .map(([path, { title: t }]) => `<a href="${path}">${t}</a>`)
    .join(" · ");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
${css}
    body { margin: 0; background: #ffffff; color: #1f2328; }
    .nav { padding: 12px 24px; border-bottom: 1px solid #d1d9e0; font: 13px system-ui, sans-serif; background: #f6f8fa; }
    .nav a { color: #0969da; text-decoration: none; margin-right: 4px; }
    .markdown-body { box-sizing: border-box; max-width: 1012px; margin: 0 auto; padding: 32px 24px 64px; }
  </style>
</head>
<body>
  <div class="nav">Orbox profile preview — ${nav}</div>
  <article class="markdown-body">
${bodyHtml}
  </article>
</body>
</html>`;
}

const server = createServer(async (req, res) => {
  try {
    const url = (req.url || "/").split("?")[0];
    const doc = DOCS[url];
    if (!doc) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found. Try / or /repo");
      return;
    }
    const [md, css] = await Promise.all([
      readFile(join(ROOT, doc.file), "utf8"),
      githubCss(),
    ]);
    const html = page(doc.title, await marked.parse(md), css);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Preview error: ${err && err.message ? err.message : err}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Markdown preview server running at http://localhost:${PORT}`);
  console.log("  /      → profile/README.md (org profile page)");
  console.log("  /repo  → README.md (repo landing page)");
});
