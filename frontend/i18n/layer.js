// Translation layer. The site is written in English; this swaps every visible English string for the
// reader's language from /i18n/<code>.json (keys are the English strings). Text nodes and the
// attributes placeholder, title, aria-label and alt are translated, now and whenever the page changes.
// Each node remembers its English, so switching languages (or back to English) is exact, and when the
// app writes new English into a node that one is translated in turn.
// The head script in app.html chooses the language and starts loading the dictionary (window.CWT_LANG,
// window.CWT_LANGS, window.CWT_DICT). Not translated: form fields, code, and anything inside
// [data-no-i18n] (readers' and the author's own words, which the API translates instead).
(function () {
  var LANGS = window.CWT_LANGS || [{ code: 'en', name: 'English', english: 'English' }];
  var BY = {}; LANGS.forEach(function (l) { BY[l.code] = l; });
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  // Whole subtrees never translated. Form fields keep what the reader typed (their placeholder is translated).
  var SKIP = 'script,style,code,pre,svg,[data-no-i18n],[contenteditable=""],[contenteditable="true"]';
  // Intl names for the languages browsers do not know by their own code.
  var LOCALE = { pcm: 'en-NG', kri: 'en-SL', tem: 'en-SL', men: 'en-SL' };
  var lang = BY[window.CWT_LANG] ? window.CWT_LANG : 'en';
  var dict = null;
  var root = document.documentElement;
  var observer = null;
  var requests = 0;

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function lookup(english) {
    if (!dict) return null;
    var v = dict[norm(english)];
    return v ? v : null;
  }
  function fill(s, values) {
    return values ? s.replace(/\{([a-z]+)\}/gi, function (m, k) { return values[k] != null ? values[k] : m; }) : s;
  }
  function skipped(el) { return !el || (el.closest && el.closest(SKIP)); }

  function doText(node) {
    if (node.parentNode && node.parentNode.nodeName === 'TEXTAREA') return;
    var now = node.nodeValue;
    if (node.__en === undefined || now !== node.__out) node.__en = now; // first sight, or the app wrote new text
    var english = node.__en;
    if (!/\S/.test(english)) return;
    // An <option> with no value sends its text: keep that English, whatever the reader sees.
    var parent = node.parentNode;
    if (parent && parent.nodeName === 'OPTION' && !parent.hasAttribute('value')) parent.setAttribute('value', norm(english));
    var t = lookup(english);
    var out = t ? english.match(/^\s*/)[0] + t + english.match(/\s*$/)[0] : english;
    node.__out = out;
    if (now !== out) node.nodeValue = out;
  }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var now = el.getAttribute(a);
      el.__enA = el.__enA || {}; el.__outA = el.__outA || {};
      if (el.__enA[a] === undefined || now !== el.__outA[a]) el.__enA[a] = now;
      var t = lookup(el.__enA[a]);
      var out = t || el.__enA[a];
      el.__outA[a] = out;
      if (now !== out) el.setAttribute(a, out);
    }
  }
  function apply(start) {
    if (!start) return;
    if (start.nodeType === 3) { if (!skipped(start.parentElement)) doText(start); return; }
    if (start.nodeType !== 1 || skipped(start)) return;
    var walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var n = start;
    do { if (n.nodeType === 3) doText(n); else doAttrs(n); } while ((n = walker.nextNode()));
  }
  function watch() {
    if (observer) return;
    observer = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'childList') for (var j = 0; j < m.addedNodes.length; j++) apply(m.addedNodes[j]);
        else if (m.type === 'characterData') apply(m.target);
        else if (m.type === 'attributes' && !skipped(m.target)) doAttrs(m.target);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function reveal() { root.classList.remove('i18n-wait'); }
  function setRoot(code) {
    root.lang = code;
    root.dir = BY[code] && BY[code].rtl ? 'rtl' : 'ltr';
    root.classList.toggle('lang-draft', !!(BY[code] && BY[code].draft));
  }

  window.I18N = {
    get lang() { return lang; },
    langs: LANGS,
    info: function (code) { return BY[code || lang]; },
    /** The reader's wording of an English string; {name} style values are filled in. */
    t: function (english, values) { return fill(lookup(english) || english, values); },
    apply: apply,
    locale: function () {
      var want = LOCALE[lang] || lang;
      try { return Intl.DateTimeFormat.supportedLocalesOf([want]).length ? want : 'en'; } catch (e) { return 'en'; }
    },
    fmtDate: function (d, opts) {
      var date = d instanceof Date ? d : new Date(d);
      return isNaN(date) ? String(d) : date.toLocaleDateString(window.I18N.locale(), opts);
    },
    /** Switch language. save:false keeps it to this device (used when the profile's choice arrives).
     *  Resolves true when switched. If the dictionary cannot load, nothing changes (the reader's choice
     *  is never replaced by English) and it resolves false. Only the latest request wins. */
    set: function (code, options) {
      code = BY[code] ? code : 'en';
      var save = !(options && options.save === false);
      var ticket = ++requests;
      var load = code === 'en' ? Promise.resolve(null)
        : fetch('/i18n/' + code + '.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      return load.then(function (d) {
        if (ticket !== requests) return false;
        if (code !== 'en' && !d) {
          window.dispatchEvent(new CustomEvent('cwt:lang-failed', { detail: { lang: code } }));
          return false;
        }
        lang = code;
        dict = d;
        try { localStorage.setItem('cwt.lang', lang); } catch (e) {}
        setRoot(lang);
        apply(root);
        watch();
        window.dispatchEvent(new CustomEvent('cwt:lang', { detail: { lang: lang, save: save } }));
        return true;
      });
    }
  };

  if (lang === 'en') { setRoot('en'); reveal(); return; }
  Promise.resolve(window.CWT_DICT).then(function (d) {
    if (d) { dict = d; setRoot(lang); apply(root); watch(); }
    else { lang = 'en'; setRoot('en'); }
    reveal();
  });
})();
