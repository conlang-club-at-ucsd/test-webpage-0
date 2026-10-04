// builds tlag/gloss/index.html dictionary regions from tlag/data/dictionary.json

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = path.join(ROOT, 'tlag', 'data', 'dictionary.json');
const GLOSS_PATH = path.join(ROOT, 'tlag', 'gloss', 'index.html');
const TLAG_INDEX_PATH = path.join(ROOT, 'tlag', 'index.html');

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

function renderEntry(e) {
  const t = e.t ?? '';
  // enHtml: rare maintainer-authored markup inside the English gloss
  // (e.g. muted "(meaning not recorded)"); trusted like the rest of the JSON.
  const enHtml = typeof e.enHtml === 'string' ? e.enHtml : null;
  const enText = enHtml ? enHtml.replace(/<.*?>/g, '') : (e.en ?? '');
  const en = enHtml ?? (e.en ?? '');
  const ipa = e.ipa ?? '';
  const pos = e.pos ?? '';
  const ety = e.ety ?? '';
  const cats = Array.isArray(e.cats) ? e.cats : [];
  const exs = Array.isArray(e.ex) ? e.ex : [];

  const dataCat = esc(cats.join('|'));
  let h = `<li class="entry" data-t="${esc(t.toLowerCase())}" data-e="${esc(enText.toLowerCase())}" data-pos="${esc(pos)}" data-cat="${dataCat}"><div><span class="tl">${esc(t)}</span>`;
  if (ipa) h += `<span class="ipa">${esc(ipa)}</span>`;
  if (pos) h += `<span class="pos">${esc(pos)}</span>`;
  h += `</div><div><span class="en">${enHtml ?? esc(en)}</span>`;
  if (ety) h += `<span class="ety">${esc(ety)}</span>`;
  if (cats.length) h += `<span class="cats">${cats.map((c) => `<span>${esc(c)}</span>`).join('')}</span>`;
  for (const x of exs) {
    h += `<div class="ex"><span class="ex-t">${esc(x.tlag ?? '')}</span>`;
    // multi-line en (newline-separated) renders as stacked ex-e lines
    for (const line of String(x.en ?? '').split('\n')) {
      if (line) h += `<span class="ex-e">${esc(line)}</span>`;
    }
    if (x.gloss) h += `<span class="mg">${esc(x.gloss)}</span>`;
    h += `</div>`;
  }
  h += `</div></li>`;
  return h;
}

function replaceOrThrow(src, re, replacement, label) {
  if (!re.test(src)) throw new Error(`pattern not found for ${label} in ${GLOSS_PATH}`);
  return src.replace(re, replacement);
}

async function main() {
  const dict = JSON.parse(await readFile(JSON_PATH, 'utf8'));
  const entries = dict.entries ?? [];
  const todo = dict.todo ?? [];

  // canonical order is JSON array order (keep it alphabetical by `t` when editing,
  // appending new words in place; homonyms like "cina" may repeat).
  // the word-of-the-day picker indexes into this same order, so never reorder
  // existing entries or past days' words will change.

  const byCodepoint = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

  const posCounts = new Map();
  const catCounts = new Map();
  for (const e of entries) {
    if (e.pos) posCounts.set(e.pos, (posCounts.get(e.pos) ?? 0) + 1);
    for (const c of e.cats ?? []) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  }

  const posOpts =
    `<option value="">All parts of speech</option>` +
    [...posCounts.entries()]
      .sort(byCodepoint)
      .map(([p, n]) => `<option value="${esc(p)}">${esc(p)} (${n})</option>`)
      .join('');
  const catOpts =
    `<option value="">All categories</option>` +
    [...catCounts.entries()]
      .sort(byCodepoint)
      .map(([c, n]) => `<option value="${esc(c)}">${esc(c)} (${n})</option>`)
      .join('');

  const entriesHtml = entries.map(renderEntry).join('');
  const todoHtml =
    `<details class="todo"><summary>Still to be coined (${todo.length})</summary>` +
    `<p class="e-note">Meanings from the working sheet that don't have a Tlag word yet.</p>` +
    `<ul class="chips">${todo.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>`;

  let html = await readFile(GLOSS_PATH, 'utf8');
  html = replaceOrThrow(html, /<select id="pos">.*?<\/select>/s, `<select id="pos">${posOpts}</select>`, 'pos select');
  html = replaceOrThrow(html, /<select id="cat">.*?<\/select>/s, `<select id="cat">${catOpts}</select>`, 'cat select');
  html = replaceOrThrow(
    html,
    /<span class="count" id="count"[^>]*>.*?<\/span>/s,
    `<span class="count" id="count" aria-live="polite">${entries.length} entries</span>`,
    'count label'
  );
  html = replaceOrThrow(
    html,
    /<ul class="entries" id="entries">.*?<\/ul>\s*(?=<details class="todo">)/s,
    `<ul class="entries" id="entries">${entriesHtml}</ul>\n`,
    'entries list'
  );
  html = replaceOrThrow(html, /<details class="todo">.*?<\/details>/s, todoHtml, 'todo list');

  if (dict.count !== entries.length) {
    console.warn(`warning: "count" field is ${dict.count}, actual entries ${entries.length}`);
  }

  await writeFile(GLOSS_PATH, html);
  console.log(`Built tlag gloss: ${entries.length} entries, ${todo.length} todo, ${posCounts.size} pos, ${catCounts.size} cats`);

  // keep the tlag landing page summary counts truthful as the dictionary grows
  try {
    const nouns = posCounts.get('Noun') ?? 0;
    const verbs = posCounts.get('Verb') ?? 0;
    let landing = await readFile(TLAG_INDEX_PATH, 'utf8');
    const re = /<strong>\d+ entries<\/strong>: mostly nouns \(\d+\) and verbs \(\d+\)/;
    const fresh = `<strong>${entries.length} entries</strong>: mostly nouns (${nouns}) and verbs (${verbs})`;
    if (!re.test(landing)) {
      console.warn('warning: tlag summary sentence not found in tlag/index.html, counts not updated');
    } else {
      landing = landing.replace(re, fresh);
      await writeFile(TLAG_INDEX_PATH, landing);
      console.log(`Updated tlag/index.html summary: ${entries.length} entries, ${nouns} nouns, ${verbs} verbs`);
    }
  } catch (err) {
    console.warn('warning: could not update tlag/index.html summary:', err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
