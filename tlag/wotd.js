// tlag word of the day: deterministic pick by UTC date, caches into localstorage
(function () {
  'use strict';

  var LS_DICT = 'tlag.dict.v1';
  var LS_STATE = 'tlag.wotd.v1';

  function todayKeyUTC(d) {
    d = d || new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD, UTC so everyone shares a day
  }

  function parseKey(key) {
    return new Date(key + 'T00:00:00Z');
  }

  function shiftKey(key, days) {
    var d = parseKey(key);
    d.setUTCDate(d.getUTCDate() + days);
    return todayKeyUTC(d);
  }

  function prettyKey(key) {
    try {
      return parseKey(key).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
      });
    } catch (err) {
      return key;
    }
  }

  // cyrb53 hash, good enough
  function hashStr(str, seed) {
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  function pickForDate(entries, key) {
    var idx = hashStr('tlag-wotd:' + key, 0) % entries.length;
    return { index: idx, entry: entries[idx] };
  }

  function readLS(name) {
    try {
      var raw = localStorage.getItem(name);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeLS(name, value) {
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch (err) {
      /* storage full or unavailable: feature still works, just not remembered */
    }
  }

  function loadState() {
    var s = readLS(LS_STATE) || {};
    if (!s.seen || typeof s.seen !== 'object') s.seen = {};
    if (!Array.isArray(s.favs)) s.favs = [];
    return s;
  }

  function loadDict(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      return res.json();
    }).then(function (dict) {
      writeLS(LS_DICT, { savedAt: Date.now(), dict: dict });
      return dict;
    }).catch(function (err) {
      var cached = readLS(LS_DICT);
      if (cached && cached.dict && cached.dict.entries && cached.dict.entries.length) return cached.dict;
      throw err;
    });
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function displayEn(entry) {
    if (typeof entry.enHtml === 'string') {
      var tmp = document.createElement('span');
      tmp.innerHTML = entry.enHtml;
      return esc(tmp.textContent || '');
    }
    return esc(entry.en || '');
  }

  function renderEntryHTML(entry) {
    var h = '<div class="wotd-word tl">' + esc(entry.t) + '</div>';
    var meta = [];
    if (entry.ipa) meta.push('<span class="ipa">' + esc(entry.ipa) + '</span>');
    if (entry.pos) meta.push('<span class="pos">' + esc(entry.pos) + '</span>');
    if (entry.cats && entry.cats.length) {
      meta.push('<span class="wotd-cats">' + entry.cats.map(esc).join(' · ') + '</span>');
    }
    if (meta.length) h += '<div class="wotd-meta">' + meta.join(' ') + '</div>';
    h += '<p class="wotd-en">' + displayEn(entry) + '</p>';
    if (entry.ety) h += '<p class="wotd-ety">' + esc(entry.ety) + '</p>';
    (entry.ex || []).forEach(function (x) {
      h += '<div class="wotd-ex"><p class="wotd-ex-t">' + esc(x.tlag || '') + '</p>';
      String(x.en || '').split('\n').forEach(function (line) {
        if (line) h += '<p class="wotd-ex-e">' + esc(line) + '</p>';
      });
      if (x.gloss) h += '<p class="wotd-ex-g">' + esc(x.gloss) + '</p>';
      h += '</div>';
    });
    return h;
  }

  function renderWidget(box, dict, state, key, today) {
    var entries = dict.entries;
    var pick = pickForDate(entries, key);
    var entry = pick.entry;

    state.seen[key] = entry.t;
    var seenKeys = Object.keys(state.seen).sort();
    while (seenKeys.length > 60) delete state.seen[seenKeys.shift()];
    writeLS(LS_STATE, state);

    var glossHref = box.getAttribute('data-gloss') || 'gloss/';
    var fav = state.favs.indexOf(entry.t) > -1;
    var isToday = key === today;

    var h = ''
      + '<div class="wotd-top"><span class="tag wotd-date">' + esc(isToday ? 'Today · ' + prettyKey(key) : prettyKey(key)) + '</span>'
      + '<span class="wotd-nav" role="group" aria-label="Browse other days">'
      + '<button type="button" class="wotd-btn" data-act="prev" aria-label="Previous day">‹</button>'
      + (isToday ? '' : '<button type="button" class="wotd-btn wotd-btn--text" data-act="today">Today</button>')
      + '<button type="button" class="wotd-btn" data-act="next" aria-label="Next day"' + (isToday ? ' disabled' : '') + '>›</button>'
      + '</span></div>'
      + renderEntryHTML(entry)
      + '<div class="wotd-actions">'
      + '<button type="button" class="wotd-btn wotd-btn--text" data-act="fav" aria-pressed="' + fav + '">' + (fav ? '★ favorited' : '☆ favorite') + '</button>'
      + '<button type="button" class="wotd-btn wotd-btn--text" data-act="copy">copy</button>'
      + '<a class="wotd-link" href="' + esc(glossHref) + '?w=' + encodeURIComponent(entry.t) + '">open in dictionary</a>'
      + '</div>';

    var recent = Object.keys(state.seen).sort().slice(-6, -1).reverse();
    if (recent.length) {
      h += '<p class="wotd-recent"><span>recent:</span> ' + recent.map(function (k) {
        return '<button type="button" class="wotd-chip" data-act="goto" data-date="' + esc(k) + '" title="' + esc(k) + '">' + esc(state.seen[k]) + '</button>';
      }).join(' ') + '</p>';
    }
    box.innerHTML = h;

    box.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-act');
        if (act === 'prev') renderWidget(box, dict, state, shiftKey(key, -1), today);
        else if (act === 'next' && !isToday) renderWidget(box, dict, state, shiftKey(key, 1), today);
        else if (act === 'today') renderWidget(box, dict, state, today, today);
        else if (act === 'goto') renderWidget(box, dict, state, btn.getAttribute('data-date'), today);
        else if (act === 'fav') {
          var i = state.favs.indexOf(entry.t);
          if (i > -1) state.favs.splice(i, 1);
          else state.favs.push(entry.t);
          writeLS(LS_STATE, state);
          renderWidget(box, dict, state, key, today);
        } else if (act === 'copy') {
          var text = 'tlag word of the day ' + key + ': ' + entry.t + ' — ' + (entry.en || '');
          copyText(text, btn);
        }
      });
    });
  }

  function copyText(text, btn) {
    function done(ok) {
      var orig = btn.textContent;
      btn.textContent = ok ? 'copied!' : 'copy failed';
      setTimeout(function () { btn.textContent = orig; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done(true);
      } catch (err) {
        done(false);
      }
    }
  }

  function renderStrip(el, dict) {
    var key = todayKeyUTC();
    if (!dict.entries.length) return;
    var entry = pickForDate(dict.entries, key).entry;
    el.innerHTML = 'Word of the day (' + esc(key) + '): '
      + '<a href="?w=' + encodeURIComponent(entry.t) + '"><strong class="tl">' + esc(entry.t) + '</strong> — ' + displayEn(entry) + '</a>';
  }

  function fail(box, err) {
    console.error('[wotd] Could not load dictionary:', err);
    var gloss = box.getAttribute('data-gloss') || 'gloss/';
    box.innerHTML = '<p class="wotd-error">Could not load today\u2019s word. '
      + '<a href="' + esc(gloss) + '">Browse the full dictionary</a> instead.</p>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var widgets = Array.prototype.slice.call(document.querySelectorAll('[data-wotd]'));
    var strips = Array.prototype.slice.call(document.querySelectorAll('[data-wotd-strip]'));
    if (!widgets.length && !strips.length) return;

    var urls = {};
    widgets.concat(strips).forEach(function (el) {
      var u = el.getAttribute('data-dict')
        || (el.hasAttribute('data-wotd-strip') ? '../data/dictionary.json' : 'data/dictionary.json');
      urls[u] = true;
    });

    Object.keys(urls).forEach(function (url) {
      loadDict(url).then(function (dict) {
        var state = loadState();
        var today = todayKeyUTC();
        widgets.filter(function (el) {
          return (el.getAttribute('data-dict') || 'data/dictionary.json') === url;
        }).forEach(function (el) {
          renderWidget(el, dict, state, today, today);
        });
        strips.filter(function (el) {
          return (el.getAttribute('data-dict') || '../data/dictionary.json') === url;
        }).forEach(function (el) {
          renderStrip(el, dict);
        });
      }).catch(function (err) {
        widgets.forEach(function (el) { fail(el, err); });
        strips.forEach(function (el) {
          el.innerHTML = 'Word of the day is unavailable offline. <a href="gloss/">Browse the dictionary</a>.';
        });
      });
    });
  });

  // exposed for testing / debugging in the console
  window.TlagWotd = {
    todayKeyUTC: todayKeyUTC,
    shiftKey: shiftKey,
    hashStr: hashStr,
    pickForDate: pickForDate
  };
})();
