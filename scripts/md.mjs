// md to html parser (custom because we hate deps)

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section'
  );
}

function safeUrl(url) {
  const u = url.trim();
  return /^\s*(javascript|data|vbscript):/i.test(u) ? '#' : u;
}

export function parseInline(src) {
  const stash = [];
  const hold = (html) => `\u0000${stash.push(html) - 1}\u0000`;

  let s = src.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, code) =>
    hold(`<code>${escapeHtml(code.trim())}</code>`)
  );

  // escapes
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, (_, ch) => hold(escapeHtml(ch)));

  s = escapeHtml(s);

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)/g, (_, alt, url, title) =>
    hold(`<img src="${safeUrl(url)}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy">`)
  );
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)/g, (_, text, url, title) => {
    const external = /^https?:\/\//i.test(url);
    return hold(
      `<a href="${safeUrl(url)}"${title ? ` title="${title}"` : ''}${external ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`
    );
  });

  
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>');
  s = s.replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

  let prev;
  do {
    prev = s;
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
  } while (s !== prev);
  return s;
}

export function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}


export function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) {
      v = v
        .slice(1, -1)
        .split(',')
        .map((x) => x.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      v = v.replace(/^["']|["']$/g, '');
      if (v === 'true') v = true;
      else if (v === 'false') v = false;
    }
    data[kv[1]] = v;
  }
  return { data, body: raw.slice(m[0].length) };
}

const RE = {
  fence: /^\s*(```+|~~~+)\s*([\w-]*)\s*$/,
  heading: /^(#{1,6})\s+(.*?)\s*#*\s*$/,
  hr: /^\s*([-*_])(\s*\1){2,}\s*$/,
  quote: /^\s*>\s?/,
  list: /^(\s*)([-*+]|\d+[.)])\s+(.*)$/,
  tableSep: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
};

function splitRow(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

function startsBlock(line, next) {
  return (
    RE.fence.test(line) ||
    RE.heading.test(line) ||
    RE.hr.test(line) ||
    RE.quote.test(line) ||
    RE.list.test(line) ||
    (line.includes('|') && next !== undefined && RE.tableSep.test(next) && next.includes('-'))
  );
}

function renderList(lines, i, headings) {
  const first = lines[i].match(RE.list);
  const baseIndent = first[1].replace(/\t/g, '    ').length;
  const ordered = /\d/.test(first[2]);
  const tag = ordered ? 'ol' : 'ul';
  let html = `<${tag}>`;

  while (i < lines.length) {
    const m = lines[i].match(RE.list);
    if (!m) break;
    const indent = m[1].replace(/\t/g, '    ').length;
    if (indent < baseIndent) break;
    if (indent > baseIndent) break;

    let text = m[3];
    i++;
    let nested = '';
    while (i < lines.length && lines[i].trim() !== '') {
      const nm = lines[i].match(RE.list);
      if (nm) {
        const ni = nm[1].replace(/\t/g, '    ').length;
        if (ni > baseIndent) {
          const r = renderList(lines, i, headings);
          nested += r.html;
          i = r.next;
          continue;
        }
        break;
      }
      if (/^\s+\S/.test(lines[i])) {
        text += ' ' + lines[i].trim();
        i++;
        continue;
      }
      break;
    }
    html += `<li>${parseInline(text)}${nested}</li>`;
  }
  html += `</${tag}>`;
  return { html, next: i };
}

export function parseBlocks(body, headings = []) {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const used = new Map();
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }

    let m = line.match(RE.fence);
    if (m) {
      const fence = m[1];
      const lang = m[2];
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]);
      i++;
      out.push(
        `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(buf.join('\n'))}</code></pre>`
      );
      continue;
    }

    // heading
    m = line.match(RE.heading);
    if (m) {
      const level = m[1].length;
      const html = parseInline(m[2]);
      const text = stripHtml(html);
      let id = slugify(text);
      const n = used.get(id) || 0;
      used.set(id, n + 1);
      if (n) id += `-${n}`;
      headings.push({ level, id, text });
      out.push(`<h${level} id="${id}">${html}</h${level}>`);
      i++;
      continue;
    }

    // hr
    if (RE.hr.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // table
    if (line.includes('|') && i + 1 < lines.length && RE.tableSep.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''
      );
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      const cell = (tag, c, idx) =>
        `<${tag}${aligns[idx] ? ` style="text-align:${aligns[idx]}"` : ''}>${parseInline(c)}</${tag}>`;
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c, x) => cell('th', c, x)).join('')}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${head.map((_, x) => cell('td', r[x] ?? '', x)).join('')}</tr>`).join('')}</tbody></table></div>`
      );
      continue;
    }

    // blockquote
    if (RE.quote.test(line)) {
      const buf = [];
      while (i < lines.length && RE.quote.test(lines[i])) buf.push(lines[i++].replace(RE.quote, ''));
      out.push(`<blockquote>${parseBlocks(buf.join('\n'), headings).html}</blockquote>`);
      continue;
    }

    // list
    if (RE.list.test(line)) {
      const r = renderList(lines, i, headings);
      out.push(r.html);
      i = r.next;
      continue;
    }

    // paragraph
    const buf = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i], lines[i + 1])) {
      buf.push(lines[i++].trim());
    }
    out.push(`<p>${parseInline(buf.join(' '))}</p>`);
  }

  return { html: out.join('\n'), headings };
}

// entry

export function parseMarkdown(raw) {
  const { data, body } = parseFrontmatter(raw);
  const { html, headings } = parseBlocks(body, []);
  const firstP = html.match(/<p>([\s\S]*?)<\/p>/);
  const excerpt = firstP ? stripHtml(firstP[1]).slice(0, 240) : '';
  const title = data.title || headings.find((h) => h.level === 1)?.text || '';
  return { frontmatter: data, title, excerpt, headings, html };
}

// god i hate regex
