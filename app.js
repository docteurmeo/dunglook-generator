(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ART_SIZE = 1024;
  const TEXT_AREA_H = 256;
  const TOTAL_H = ART_SIZE + TEXT_AREA_H;

  const $ = (id) => document.getElementById(id);
  const CANVAS = $('canvas');
  const CANVAS_WRAP = $('canvasWrap');
  const STATUS = $('status');
  const COUNTER = $('counterLabel');
  const GEN_BTN = $('generateBtn');
  const SHF_BTN = $('shuffleBtn');
  const DL_BTN = $('downloadBtn');
  const QR_BTN = $('qrBtn');
  const QR_MODAL = $('qrModal');
  const QR_CONTAINER = $('qrContainer');
  const QR_NOTE = $('qrNote');

  const state = {
    manifest: null,
    svgCache: new Map(),
    counter: 0,
    autoTimer: null,
    isAnimating: false,
    finalized: false
  };

  // ---------- helpers ----------

  function setStatus(msg, isError = false) {
    STATUS.textContent = msg || '';
    STATUS.classList.toggle('error', isError);
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function parseViewBox(vb) {
    const parts = String(vb || '0 0 1024 1024').trim().split(/\s+/).map(Number);
    return { x: parts[0] || 0, y: parts[1] || 0, w: parts[2] || 1024, h: parts[3] || 1024 };
  }

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

  // ---------- random selection ----------

  function chooseLayerAssets(manifest) {
    const out = [];
    for (const layer of manifest.layers) {
      if (!layer.assets || layer.assets.length === 0) continue;
      const include = layer.required || Math.random() < (layer.probability ?? 1);
      if (!include) continue;

      const pick = pickRandom(layer.assets);
      const vb = parseViewBox(layer.viewBox);
      let transform = '';

      if (layer.behavior === 'random_position') {
        const r = layer.positionRange || { xMin: 150, xMax: 874, yMin: 150, yMax: 874 };
        const cx = r.xMin + Math.random() * (r.xMax - r.xMin);
        const cy = r.yMin + Math.random() * (r.yMax - r.yMin);
        const dx = cx - (vb.x + vb.w / 2);
        const dy = cy - (vb.y + vb.h / 2);
        transform = `translate(${dx} ${dy})`;
      } else if (layer.behavior === 'random_angle') {
        const steps = layer.angleSteps || [0, 45, 90, 135, 180, 225, 270, 315];
        const angle = pickRandom(steps);
        const a = layer.anchor || { x: 850, y: 174 };
        const cx = vb.x + vb.w / 2;
        const cy = vb.y + vb.h / 2;
        transform = `translate(${a.x - cx} ${a.y - cy}) rotate(${angle} ${cx} ${cy})`;
      } else if (layer.behavior === 'fixed_position' && layer.anchor) {
        const dx = layer.anchor.x - (vb.x + vb.w / 2);
        const dy = layer.anchor.y - (vb.y + vb.h / 2);
        transform = `translate(${dx} ${dy})`;
      }
      // fixed_center → no transform

      out.push({ layer, asset: pick, transform });
    }
    return out;
  }

  function chooseText(manifest) {
    const t = manifest.text || { prefix: [], suffix: [] };
    return {
      prefix: t.prefix && t.prefix.length ? pickRandom(t.prefix) : '',
      core: 'ĐÚNG LOOK',
      suffix: t.suffix && t.suffix.length ? pickRandom(t.suffix) : ''
    };
  }

  // ---------- SVG composition ----------

  async function compose(choices, text) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('viewBox', `0 0 ${ART_SIZE} ${TOTAL_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // White background
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(ART_SIZE));
    bg.setAttribute('height', String(TOTAL_H));
    bg.setAttribute('fill', '#ffffff');
    svg.appendChild(bg);

    // Layer groups
    for (const { layer, asset, transform } of choices) {
      const txt = await fetchSvgText(asset.path).catch(() => null);
      if (!txt) continue;

      const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      const src = doc.documentElement;
      if (src.nodeName.toLowerCase() !== 'svg') continue;

      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', `layer ${layer.folder}`);
      if (transform) g.setAttribute('transform', transform);

      while (src.firstChild) {
        g.appendChild(document.importNode(src.firstChild, true));
        src.removeChild(src.firstChild);
      }
      svg.appendChild(g);
    }

    // Text 3 lines
    const tx = ART_SIZE / 2;
    const fontStack =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    const mkText = (str, y, size, weight) => {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(tx));
      t.setAttribute('y', String(y));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-family', fontStack);
      t.setAttribute('font-size', String(size));
      t.setAttribute('font-weight', String(weight));
      t.setAttribute('fill', '#111');
      t.textContent = str;
      return t;
    };

    if (text.prefix) svg.appendChild(mkText(text.prefix, ART_SIZE + 70, 44, 500));
    svg.appendChild(mkText(text.core, ART_SIZE + 150, 80, 800));
    if (text.suffix) svg.appendChild(mkText(text.suffix, ART_SIZE + 230, 44, 500));

    return svg;
  }

  async function renderRandom() {
    if (!state.manifest) return null;
    const choices = chooseLayerAssets(state.manifest);
    const text = chooseText(state.manifest);
    const svg = await compose(choices, text);

    while (CANVAS.firstChild) CANVAS.removeChild(CANVAS.firstChild);
    while (svg.firstChild) CANVAS.appendChild(svg.firstChild);
    CANVAS.setAttribute('viewBox', svg.getAttribute('viewBox'));

    return { choices, text };
  }

  // ---------- auto-shuffle ----------

  function startAutoShuffle() {
    stopAutoShuffle();
    state.autoTimer = setInterval(() => {
      if (!state.isAnimating && !state.finalized) renderRandom();
    }, 1800);
  }
  function stopAutoShuffle() {
    if (state.autoTimer) clearInterval(state.autoTimer);
    state.autoTimer = null;
  }

  // ---------- generate animation: speed up → slow down → pop ----------

  async function runGenerateAnimation() {
    state.isAnimating = true;
    stopAutoShuffle();

    // Frame intervals (ms): start fast, gradually slow
    const frames = [40, 40, 50, 60, 80, 110, 150, 200, 280, 380];
    for (const ms of frames) {
      await renderRandom();
      await new Promise((r) => setTimeout(r, ms));
    }
    await renderRandom(); // final frame

    // Pop
    CANVAS_WRAP.classList.remove('pop');
    void CANVAS_WRAP.offsetWidth; // restart animation
    CANVAS_WRAP.classList.add('pop');

    state.isAnimating = false;
    state.finalized = true;
    state.counter += 1;
    COUNTER.textContent = String(state.counter);

    GEN_BTN.classList.add('hidden');
    SHF_BTN.classList.remove('hidden');
    DL_BTN.classList.remove('hidden');
    QR_BTN.classList.remove('hidden');
  }

  // ---------- serialize / download ----------

  function serializeCurrent() {
    const clone = document.createElementNS(SVG_NS, 'svg');
    clone.setAttribute('xmlns', SVG_NS);
    clone.setAttribute('viewBox', CANVAS.getAttribute('viewBox') || `0 0 ${ART_SIZE} ${TOTAL_H}`);
    for (const child of CANVAS.childNodes) {
      clone.appendChild(child.cloneNode(true));
    }
    const xml = new XMLSerializer().serializeToString(clone);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
  }

  function downloadSvg() {
    const svgText = serializeCurrent();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dunglook-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- QR ----------

  function showQr() {
    while (QR_CONTAINER.firstChild) QR_CONTAINER.removeChild(QR_CONTAINER.firstChild);
    QR_NOTE.textContent = '';
    QR_MODAL.classList.remove('hidden');

    const svgText = serializeCurrent();
    const dataUrl =
      'data:image/svg+xml;base64,' +
      btoa(unescape(encodeURIComponent(svgText)));

    if (typeof QRCode === 'undefined') {
      QR_NOTE.textContent = 'Lỗi: chưa load được thư viện QR (kiểm tra mạng).';
      return;
    }

    const canvas = document.createElement('canvas');
    QR_CONTAINER.appendChild(canvas);

    QRCode.toCanvas(
      canvas,
      dataUrl,
      { width: 256, errorCorrectionLevel: 'L', margin: 1 },
      (err) => {
        if (err) {
          while (QR_CONTAINER.firstChild) QR_CONTAINER.removeChild(QR_CONTAINER.firstChild);
          const m = document.createElement('div');
          m.textContent = 'SVG quá lớn để encode trong QR.';
          m.style.color = '#c0392b';
          m.style.fontSize = '14px';
          QR_CONTAINER.appendChild(m);
          QR_NOTE.textContent =
            'Hãy bấm DOWNLOAD SVG, rồi AirDrop / Bluetooth / Zalo sang điện thoại.';
        } else {
          QR_NOTE.textContent =
            'Mở camera điện thoại quét QR — sticker sẽ tự mở. Bấm giữ để lưu.';
        }
      }
    );
  }

  function hideQr() {
    QR_MODAL.classList.add('hidden');
  }

  // ---------- reshuffle ----------

  function reshuffle() {
    state.finalized = false;
    GEN_BTN.classList.remove('hidden');
    SHF_BTN.classList.add('hidden');
    DL_BTN.classList.add('hidden');
    QR_BTN.classList.add('hidden');
    renderRandom();
    startAutoShuffle();
  }

  // ---------- bind events ----------

  GEN_BTN.addEventListener('click', () => {
    if (!state.isAnimating) runGenerateAnimation();
  });
  SHF_BTN.addEventListener('click', reshuffle);
  DL_BTN.addEventListener('click', downloadSvg);
  QR_BTN.addEventListener('click', showQr);
  QR_MODAL.addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined) hideQr();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !QR_MODAL.classList.contains('hidden')) hideQr();
  });

  // ---------- boot ----------

  (async () => {
    try {
      state.manifest = await fetchManifest();
      const total = (state.manifest.layers || []).reduce(
        (s, l) => s + (l.assets?.length || 0),
        0
      );
      if (total === 0) {
        setStatus(
          'Chưa có SVG. Drop file .svg vào assets/01_base, 02_eyes,… rồi push GitHub. Action sẽ tự rebuild manifest.'
        );
        return;
      }
      const tx = state.manifest.text || {};
      setStatus(
        `${state.manifest.layers.length} lớp · ${total} svg · ${(tx.prefix || []).length}+${(tx.suffix || []).length} text. Sẵn sàng.`
      );
      await renderRandom();
      startAutoShuffle();
    } catch (e) {
      console.error(e);
      setStatus(
        'Không tải được data/manifest.json. Đợi GitHub Action build xong rồi reload trang.',
        true
      );
    }
  })();
})();
