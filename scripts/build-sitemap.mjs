// regenerates sitemap.xml from the built static pages.
// run after build-content.mjs + build-tlag.mjs so generated project pages are included:
//   node scripts/build-content.mjs && node scripts/build-tlag.mjs && node scripts/build-sitemap.mjs

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function baseUrl() {
  try {
    const cname = (await readFile(path.join(ROOT, 'CNAME'), 'utf8')).trim().split(/\s+/)[0];
    if (cname) return `https://${cname.replace(/\/+$/, '')}`;
  } catch {}
  return 'https://conlangatucsd.com';
}

const SKIP_DIRS = new Set(['partials', 'raw-md-files', 'data', 'scripts', '.github', '.git']);
const SKIP_FILES = new Set(['404.html']);

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.name === 'index.html') out.push(full);
    else if (e.name.endsWith('.html') && !SKIP_FILES.has(e.name)) out.push(full);
  }
  return out;
}

function urlFor(file, root) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

function metaFor(url) {
  if (url === '/') return { changefreq: 'weekly', priority: '1.0' };
  if (url === '/faq/') return { changefreq: 'monthly', priority: '0.7' };
  if (['/about/', '/officers/', '/projects/', '/tlag/'].includes(url))
    return { changefreq: 'monthly', priority: '0.8' };
  return { changefreq: 'monthly', priority: '0.6' };
}

async function main() {
  const base = await baseUrl();
  const files = (await walk(ROOT)).sort();
  const urls = [];
  for (const file of files) {
    const url = urlFor(file, ROOT);
    // skip 404 — never belongs in a sitemap
    if (url === '/404.html' || url === '/404/') continue;    const st = await stat(file);
    const lastmod = st.mtime.toISOString().slice(0, 10);
    const { changefreq, priority } = metaFor(url);
    urls.push({ loc: `${base}${url}`, lastmod, changefreq, priority });
  }
  urls.sort((a, b) => {
    if (a.loc === `${base}/`) return -1;
    if (b.loc === `${base}/`) return 1;
    return a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0;
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  await writeFile(path.join(ROOT, 'sitemap.xml'), xml);
  console.log(`Built sitemap.xml: ${urls.length} url(s)`);
  for (const u of urls) console.log(`  ${u.loc}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
