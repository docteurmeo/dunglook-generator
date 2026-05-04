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
    return { prefix: [], suffix: [] };
  }
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch {
    console.warn('  xlsx package not installed — run npm install');
    return { prefix: [], suffix: [] };
  }
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const prefix = uniq(rows.map((r) => String(r.prefix || '').trim()));
  const suffix = uniq(rows.map((r) => String(r.suffix || '').trim()));
  return { prefix, suffix };
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
  console.log(`   text: ${text.prefix.length} prefix · ${text.suffix.length} suffix`);
  console.log(`   colors: ${colors.length} swatches`);
  for (const l of layers) {
    console.log(
      `   - ${l.folder}: ${l.assets.length} svg · ${l.behavior}${l.colorize ? ' · colorize' : ''} · p=${l.probability}`
    );
  }
}

build();
