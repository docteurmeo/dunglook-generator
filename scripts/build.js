#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const CONTENT_DIR = path.join(ROOT, 'content');
const OUT_FILE = path.join(ROOT, 'data', 'manifest.json');

const ART_FRAME = { width: 700, height: 700 };
const TEXT_FRAME = { x: 263, y: 500, width: 174, height: 164 };

function listLayerFolders() {
  if (!fs.existsSync(ASSETS_DIR)) return [];
  return fs
    .readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function listSvgs(layerDir) {
  return fs
    .readdirSync(layerDir)
    .filter((f) => !f.startsWith('_') && !f.startsWith('.'))
    .filter((f) => path.extname(f).toLowerCase() === '.svg')
    .sort();
}

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`! cannot parse ${p}: ${e.message}`);
    return null;
  }
}

function readTexts() {
  const xlsxPath = path.join(CONTENT_DIR, 'text-lists.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.warn('  no content/text-lists.xlsx — text lists empty');
    return { topics: [] };
  }
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch {
    console.warn('  xlsx package not installed — run npm install');
    return { topics: [] };
  }
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // Read as raw 2D array — columns positional (TOPIC | A/prefix | core | B/suffix)
  // Tuong thich voi Google Sheet "Final" cua DUNG LOOK: cot 0 = topic (forward-fill khi
  // empty), cot 1 = prefix, cot 3 = suffix. Bo qua dong header (chua \n hoac dau ngoac).
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

  const topicMap = new Map();
  let currentTopic = '';
  const isHeaderCell = (s) => /[()\n]|Động từ|Tính từ|CẤU TRÚC|^A\b|^B\b/i.test(s);
  const isHeaderTopic = (s) => /^TOPIC$|CẤU TRÚC/i.test(s);

  for (const row of matrix) {
    const topicCell = String(row[0] || '').trim();
    const prefix    = String(row[1] || '').trim();
    const suffix    = String(row[3] || '').trim();

    if (topicCell && !isHeaderTopic(topicCell)) currentTopic = topicCell;
    else if (isHeaderTopic(topicCell)) continue;
    if (!currentTopic) continue;
    if (isHeaderCell(prefix) || isHeaderCell(suffix)) continue;
    if (!prefix && !suffix) continue;

    if (!topicMap.has(currentTopic)) {
      topicMap.set(currentTopic, { name: currentTopic, prefix: [], suffix: [] });
    }
    const t = topicMap.get(currentTopic);
    if (prefix && !t.prefix.includes(prefix)) t.prefix.push(prefix);
    if (suffix && !t.suffix.includes(suffix)) t.suffix.push(suffix);
  }

  const topics = Array.from(topicMap.values());
  return { topics };
}

function readColors() {
  const p = path.join(CONTENT_DIR, 'colors.json');
  const fallback = ['#009ada', '#f99d1c', '#ad75b2', '#5dbb4c', '#ec008c', '#f47421'];
  const data = readJson(p);
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('  no content/colors.json — using fallback palette');
    return fallback;
  }
  return data.filter((c) => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c.trim())).map((c) => c.trim());
}

function build() {
  const layers = [];
  for (const folder of listLayerFolders()) {
    const dir = path.join(ASSETS_DIR, folder);
    const cfg = readJson(path.join(dir, '_config.json')) || {};
    const svgs = listSvgs(dir);
    layers.push({
      folder,
      name: cfg.name || folder,
      order: cfg.order ?? layers.length + 1,
      behavior: cfg.behavior || 'fixed_center',
      required: cfg.required ?? false,
      probability: cfg.probability ?? 1,
      viewBox: cfg.viewBox || '0 0 500 500',
      renderSize: cfg.renderSize ?? null,
      renderOffset: cfg.renderOffset ?? null,
      anchor: cfg.anchor ?? null,
      container: cfg.container ?? null,
      padding: cfg.padding ?? null,
      rotation: cfg.rotation ?? null,
      colorize: cfg.colorize ?? false,
      assets: svgs.map((f) => ({
        file: f,
        path: `assets/${folder}/${f}`
      }))
    });
  }
  layers.sort((a, b) => a.order - b.order);

  const text = readTexts();
  const colors = readColors();

  const manifest = {
    generatedAt: new Date().toISOString(),
    artFrame: ART_FRAME,
    textFrame: TEXT_FRAME,
    coreText: 'đúng look',
    layers,
    text,
    colors
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n');

  const totalSvg = layers.reduce((s, l) => s + l.assets.length, 0);
  console.log('OK manifest written → data/manifest.json');
  console.log(`   ${layers.length} layers, ${totalSvg} svg files`);
  const topicCount = text.topics?.length ?? 0;
  const prefixTotal = text.topics?.reduce((s, t) => s + t.prefix.length, 0) ?? 0;
  const suffixTotal = text.topics?.reduce((s, t) => s + t.suffix.length, 0) ?? 0;
  console.log(`   text: ${topicCount} topics · ${prefixTotal} prefix · ${suffixTotal} suffix`);
  console.log(`   colors: ${colors.length} swatches`);
  for (const l of layers) {
    console.log(
      `   - ${l.folder}: ${l.assets.length} svg · ${l.behavior}${l.colorize ? ' · colorize' : ''} · p=${l.probability}`
    );
  }
}

build();
