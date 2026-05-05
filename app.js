(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ART_W = 700;
  const ART_H = 700;

  // ============================================================
  //  COUNTER CONFIG  (chinh sua o day)
  // ============================================================
  //  COUNTER_OFFSET: so "ao" cong them vao so dem that.
  //  Vi du: dat = 1247 thi web hien thi 1247 ngay khi vua mo,
  //  va moi lan generate thi se tang len: 1248, 1249, ...
  //  De ve 0 (chi dem that) thi dat = 0.
  const COUNTER_OFFSET = 1247;
  // ============================================================
  //  Khong can sua phan duoi tru khi muon doi dich vu dem.
  const COUNTER_NS  = 'docteurmeo-dunglook';
  const COUNTER_KEY = 'looks';
  const COUNTER_API = 'https://abacus.jasoncameron.dev';
  const COUNTER_POLL_MS = 4000;  // Cu 4 giay 1 lan dong bo voi server

  const $ = (id) => document.getElementById(id);
  const CANVAS = $('canvas');
  const CANVAS_WRAP = $('canvasWrap');
  const COUNTER = $('counterLabel');
  const GEN_BTN = $('generateBtn');
  const GEN_LABEL = GEN_BTN.querySelector('.btn-label');
  const DL_GROUP = $('downloadGroup');
  const DL_SVG = $('downloadSvgBtn');
  const DL_PNG = $('downloadPngBtn');

  const state = {
    manifest: null,
    svgCache: new Map(),
    displayCount: 0,
    autoTimer: null,
    isAnimating: false,
    finalized: false
  };

  // ---------- helpers ----------

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function parseViewBox(vb) {
    const p = String(vb || '0 0 100 100').trim().split(/\s+/).map(Number);
    return { x: p[0] || 0, y: p[1] || 0, w: p[2] || 100, h: p[3] || 100 };
  }

  // ---------- remote counter (Abacus) ----------

  async function fetchRemoteCount() {
    try {
      const res = await fetch(`${COUNTER_API}/get/${COUNTER_NS}/${COUNTER_KEY}`, { cache: 'no-store' });
      if (res.status === 404) return 0;
      if (!res.ok) return null;
      const j = await res.json();
      return typeof j.value === 'number' ? j.value : null;
    } catch {
      return null;
    }
  }

  async function hitRemoteCount() {
    try {
      const res = await fetch(`${COUNTER_API}/hit/${COUNTER_NS}/${COUNTER_KEY}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const j = await res.json();
      return typeof j.value === 'number' ? j.value : null;
    } catch {
      return null;
    }
  }

  function renderCounter() {
    COUNTER.textContent = String(COUNTER_OFFSET + state.displayCount);
  }

  // Cu COUNTER_POLL_MS giay lay so moi nhat tu server.
  // Chi tang, khong giam (de khong de len so vua animate local).
  // Tu dong dung khi tab bi an, chay lai khi tab visible.
  let _counterPollTimer = null;
  async function pollCounterOnce() {
    const srv = await fetchRemoteCount();
    if (srv !== null && srv > state.displayCount) {
      state.displayCount = srv;
      renderCounter();
    }
  }
  function startCounterPolling() {
    if (_counterPollTimer) return;
    _counterPollTimer = setInterval(() => {
      if (document.hidden) return;
      pollCounterOnce();
    }, COUNTER_POLL_MS);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pollCounterOnce();
  });

  async function fetchManifest() {
    const res = await fetch('data/manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest fetch failed');
    return res.json();
  }

  async function fetchSvgText(p) {
    if (state.svgCache.has(p)) return state.svgCache.get(p);
    const res = await fetch(p);
    if (!res.ok) throw new Error('svg fetch failed: ' + p);
    const txt = await res.text();
    state.svgCache.set(p, txt);
    return txt;
  }

  // Fetches BD StreetSign Sans once and caches as base64 data URL.
  // Must be embedded in download SVG because Canvas-rendered SVG-as-image
  // runs in a sandbox and can't reach the page's @font-face declarations.
  let _fontDataUrl = null;
  async function getFontDataUrl() {
    if (_fontDataUrl !== null) return _fontDataUrl;
    try {
      const res = await fetch('fonts/BDStreetSignSans_Variable.ttf');
      if (!res.ok) throw new Error('font fetch failed: ' + res.status);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      _fontDataUrl = 'data:font/ttf;base64,' + btoa(binary);
    } catch (e) {
      console.warn('[dunglook] font embed failed:', e);
      _fontDataUrl = '';
    }
    return _fontDataUrl;
  }

  // ---------- random selection ----------

  function chooseLayerAssets(manifest) {
    const out = [];
    for (const layer of manifest.layers) {
      if (!layer.assets || layer.assets.length === 0) continue;
      const include = layer.required || Math.random() < (layer.probability ?? 1);
      if (!include) continue;

      const pick = pickRandom(layer.assets);
      const placement = computePlacement(layer);
      const recolor = layer.colorize && manifest.colors?.length
        ? pickRandom(manifest.colors)
        : null;

      out.push({ layer, asset: pick, placement, recolor });
    }
    return out;
  }

  function computePlacement(layer) {
    // Returns { x, y, width, height, rotate } in art-frame coordinates (700x700)
    if (layer.behavior === 'fixed_center') {
      const off = layer.renderOffset || { x: 100, y: 0 };
      const sz = typeof layer.renderSize === 'number'
        ? { width: layer.renderSize, height: layer.renderSize }
        : layer.renderSize || { width: 500, height: 500 };
      return { x: off.x, y: off.y, width: sz.width, height: sz.height, rotate: 0 };
    }
    if (layer.behavior === 'fixed_position' && layer.anchor) {
      const sz = layer.renderSize || { width: 400, height: 180 };
      return {
        x: layer.anchor.x - sz.width / 2,
        y: layer.anchor.y - sz.height / 2,
        width: sz.width,
        height: sz.height,
        rotate: 0
      };
    }
    if (layer.behavior === 'random_corner') {
      const sz = layer.renderSize || { width: 140, height: 140 };
      const c = layer.container || { left: 100, top: 0, width: 500, height: 500 };
      const pad = layer.padding ?? 60;
      const corners = [
        { x: c.left + pad,                       y: c.top + pad },
        { x: c.left + c.width - sz.width - pad,  y: c.top + pad },
        { x: c.left + pad,                       y: c.top + c.height - sz.height - pad },
        { x: c.left + c.width - sz.width - pad,  y: c.top + c.height - sz.height - pad }
      ];
      const corner = pickRandom(corners);
      const rot = layer.rotation || { mode: 'continuous', min: -45, max: 45 };
      let angle = 0;
      if (rot.mode === 'steps' && Array.isArray(rot.steps)) {
        angle = pickRandom(rot.steps);
      } else {
        const min = rot.min ?? -45;
        const max = rot.max ?? 45;
        angle = min + Math.random() * (max - min);
      }
      return { x: corner.x, y: corner.y, width: sz.width, height: sz.height, rotate: angle };
    }
    return { x: 0, y: 0, width: 500, height: 500, rotate: 0 };
  }

  function chooseText(manifest) {
    const t = manifest.text || { prefix: [], suffix: [] };
    const c = manifest.colors || [];
    return {
      prefix: t.prefix?.length ? pickRandom(t.prefix) : '',
      core: manifest.coreText || 'đúng look',
      suffix: t.suffix?.length ? pickRandom(t.suffix) : '',
      prefixColor: c.length ? pickRandom(c) : '#009ada',
      suffixColor: c.length ? pickRandom(c) : '#f99d1c'
    };
  }

  // ---------- SVG composition ----------

  function recolorSvgGroup(group, color) {
    const els = group.querySelectorAll(
      'path, rect, circle, ellipse, polygon, polyline, line'
    );
    els.forEach((el) => {
      const fill = el.getAttribute('fill');
      const stroke = el.getAttribute('stroke');
      // Only override visible fills (skip "none" and unspecified-with-stroke)
      if (fill !== 'none' && fill !== null) {
        el.setAttribute('fill', color);
      } else if (fill === null && (!stroke || stroke === 'none')) {
        el.setAttribute('fill', color);
      }
    });
    // Clear inline style fills
    els.forEach((el) => {
      const s = el.getAttribute('style');
      if (s && /fill\s*:/.test(s)) {
        el.setAttribute(
          'style',
          s.replace(/fill\s*:\s*[^;]+;?/g, '').trim()
        );
      }
    });
  }

  async function compose(choices, text, opts = {}) {
    const finalized = !!opts.finalized;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('viewBox', `0 0 ${ART_W} ${ART_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Light blue card background — preview only. Stripped on download via the
    // finalizedBg id (we want transparent SVG/PNG so users can place over any bg).
    if (finalized) {
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('id', 'finalizedBg');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', String(ART_W));
      bg.setAttribute('height', String(ART_H));
      bg.setAttribute('rx', '37');
      bg.setAttribute('ry', '37');
      bg.setAttribute('fill', '#d3e8f0');
      svg.appendChild(bg);
    }

    // Layers
    for (const { layer, asset, placement, recolor } of choices) {
      const txt = await fetchSvgText(asset.path).catch(() => null);
      if (!txt) continue;

      const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      const src = doc.documentElement;
      if (src.nodeName.toLowerCase() !== 'svg') continue;

      const srcVb = parseViewBox(src.getAttribute('viewBox') || layer.viewBox);
      const sx = placement.width / srcVb.w;
      const sy = placement.height / srcVb.h;
      const cx = placement.x + placement.width / 2;
      const cy = placement.y + placement.height / 2;

      // Outer transform: position + rotate around center
      const outer = document.createElementNS(SVG_NS, 'g');
      outer.setAttribute(
        'transform',
        `translate(${placement.x} ${placement.y}) rotate(${placement.rotate || 0} ${placement.width / 2} ${placement.height / 2}) scale(${sx} ${sy}) translate(${-srcVb.x} ${-srcVb.y})`
      );
      outer.setAttribute('class', `layer ${layer.folder}`);

      while (src.firstChild) {
        outer.appendChild(document.importNode(src.firstChild, true));
        src.removeChild(src.firstChild);
      }

      if (recolor) recolorSvgGroup(outer, recolor);

      svg.appendChild(outer);
    }

    // Text 3 lines (positions from Figma textFrame at 263, 500 — 174x164)
    // Line order in design: prefix top (y≈10), core middle (y≈45), suffix bottom (y≈109-119)
    const tFrame = state.manifest?.textFrame || { x: 263, y: 500, width: 174, height: 164 };
    const tx = tFrame.x + tFrame.width / 2;
    const fontDisplay = '"BD StreetSign Sans", "Bagel Fat One", system-ui, sans-serif';
    const coreColor = finalized ? '#000000' : '#ffffff';

    const mkText = (str, y, size, color, upper) => {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(tx));
      t.setAttribute('y', String(y));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'hanging');
      t.setAttribute('font-family', fontDisplay);
      t.setAttribute('font-size', String(size));
      t.setAttribute('fill', color);
      if (upper) t.setAttribute('style', 'text-transform: uppercase');
      t.textContent = upper ? String(str).toUpperCase() : str;
      return t;
    };

    if (text.prefix) {
      svg.appendChild(mkText(text.prefix, tFrame.y + 10, 32, text.prefixColor, true));
    }
    svg.appendChild(mkText(text.core, tFrame.y + 55, 48, coreColor, false));
    if (text.suffix) {
      svg.appendChild(mkText(text.suffix, tFrame.y + 119, 32, text.suffixColor, true));
    }

    return svg;
  }

  async function renderRandom(opts = {}) {
    if (!state.manifest) return null;
    const choices = chooseLayerAssets(state.manifest);
    const text = chooseText(state.manifest);
    const svg = await compose(choices, text, opts);

    while (CANVAS.firstChild) CANVAS.removeChild(CANVAS.firstChild);
    while (svg.firstChild) CANVAS.appendChild(svg.firstChild);
    CANVAS.setAttribute('viewBox', svg.getAttribute('viewBox'));

    return { choices, text };
  }

  // ---------- auto-shuffle (idle) ----------

  function startAutoShuffle() {
    stopAutoShuffle();
    state.autoTimer = setInterval(() => {
      if (!state.isAnimating && !state.finalized) {
        renderRandom({ finalized: false });
      }
    }, 200);
  }
  function stopAutoShuffle() {
    if (state.autoTimer) clearInterval(state.autoTimer);
    state.autoTimer = null;
  }

  // ---------- generate animation ----------

  async function runGenerateAnimation() {
    state.isAnimating = true;
    stopAutoShuffle();

    GEN_BTN.dataset.busy = 'true';
    GEN_LABEL.textContent = 'Generating';
    CANVAS_WRAP.dataset.state = 'generating';

    // Speed curve: start fast (40ms), accelerate slightly, then slow down
    const frames = [40, 35, 35, 40, 50, 65, 90, 130, 180, 240, 320, 420];
    for (const ms of frames) {
      await renderRandom({ finalized: false });
      await new Promise((r) => setTimeout(r, ms));
    }

    // Final render with finalized look (light blue card + black core text)
    await renderRandom({ finalized: true });

    CANVAS_WRAP.dataset.state = 'finalized';
    state.isAnimating = false;
    state.finalized = true;
    state.displayCount += 1;
    renderCounter();
    hitRemoteCount().then((srv) => {
      if (srv !== null && srv > state.displayCount) {
        state.displayCount = srv;
        renderCounter();
      }
    });

    GEN_BTN.dataset.busy = 'false';
    GEN_LABEL.textContent = 'Look khác';
    DL_GROUP.classList.remove('hidden');
  }

  function reshuffle() {
    state.finalized = false;
    GEN_LABEL.textContent = 'Generate';
    DL_GROUP.classList.add('hidden');
    CANVAS_WRAP.dataset.state = 'idle';
    renderRandom({ finalized: false });
    startAutoShuffle();
  }

  // ---------- serialize / download ----------

  async function buildDownloadSvg() {
    if (!state.manifest) return null;
    const clone = document.createElementNS(SVG_NS, 'svg');
    clone.setAttribute('xmlns', SVG_NS);
    clone.setAttribute('viewBox', `0 0 ${ART_W} ${ART_H}`);

    const fontUrl = await getFontDataUrl();
    if (fontUrl) {
      const defs = document.createElementNS(SVG_NS, 'defs');
      const style = document.createElementNS(SVG_NS, 'style');
      style.textContent =
        '@font-face{font-family:"BD StreetSign Sans";' +
        'src:url(' + fontUrl + ') format("truetype");' +
        'font-weight:100 900;font-style:normal;}';
      defs.appendChild(style);
      clone.appendChild(defs);
    }

    for (const child of CANVAS.childNodes) {
      if (child.id === 'finalizedBg') continue;
      clone.appendChild(child.cloneNode(true));
    }
    return clone;
  }

  function serializeSvgString(svgEl) {
    const xml = new XMLSerializer().serializeToString(svgEl);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
  }

  async function downloadSvg() {
    const svg = await buildDownloadSvg();
    if (!svg) return;
    const text = serializeSvgString(svg);
    const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `dunglook-${Date.now()}.svg`);
  }

  async function downloadPng() {
    const svg = await buildDownloadSvg();
    if (!svg) return;
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch {}

    const xml = serializeSvgString(svg);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const SCALE = 2; // 1400x1400 PNG for crisp output
    const img = new Image();
    img.decoding = 'async';
    img.src = url;

    try {
      await img.decode();
    } catch (e) {
      URL.revokeObjectURL(url);
      console.error('[dunglook] PNG decode failed:', e);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = ART_W * SCALE;
    canvas.height = ART_H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(blob, `dunglook-${Date.now()}.png`);
    }, 'image/png');
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ---------- event wiring ----------

  GEN_BTN.addEventListener('click', () => {
    if (state.isAnimating) return;
    if (state.finalized) reshuffle();
    else runGenerateAnimation();
  });
  DL_SVG.addEventListener('click', downloadSvg);
  DL_PNG.addEventListener('click', downloadPng);

  // ---------- boot ----------

  (async () => {
    try {
      const remote = await fetchRemoteCount();
      state.displayCount = remote ?? 0;
      renderCounter();
    } catch (e) {
      console.warn('[dunglook] counter init failed:', e);
      renderCounter();
    }
    startCounterPolling();

    try {
      state.manifest = await fetchManifest();
      const total = (state.manifest.layers || []).reduce(
        (s, l) => s + (l.assets?.length || 0),
        0
      );
      if (total === 0) {
        console.warn('[dunglook] No SVG assets found. Drop files into assets/01_base, 02_eyes, 03_sticker.');
        return;
      }
      await renderRandom({ finalized: false });
      startAutoShuffle();
    } catch (e) {
      console.error('[dunglook] manifest load failed:', e);
    }
  })();
})();
