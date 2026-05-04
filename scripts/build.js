#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const CONTENT_DIR = path.join(ROOT, 'content');
const OUT_FILE = path.join(ROOT, 'data', 'manifest.json');

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

function readConfig(layerDir) {
  const p = path.join(layerDir, '_config.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`! cannot parse ${p}: ${e.message}`);
    return {};
  }
}

function readTextLists() {
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

function build() {
  const layers = [];
  for (const folder of listLayerFolders()) {
    const dir = path.join(ASSETS_DIR, folder);
    const cfg = readConfig(dir);
    const svgs = listSvgs(dir);
    layers.push({
      folder,
      name: cfg.name || folder,
      order: cfg.order ?? layers.length + 1,
      behavior: cfg.behavior || 'fixed_center',
      required: cfg.required ?? false,
      probability: cfg.probability ?? 1,
      viewBox: cfg.viewBox || '0 0 1024 1024',
      anchor: cfg.anchor || null,
      positionRange: cfg.positionRange || null,
      angleSteps: cfg.angleSteps || null,
      assets: svgs.map((f) => ({
        file: f,
        path: `assets/${folder}/${f}`
      }))
    });
  }
  layers.sort((a, b) => a.order - b.order);

  const text = readTextLists();
  const baseLayer = layers.find((l) => l.behavior === 'fixed_center') || layers[0];
  const baseViewBox = baseLayer ? baseLayer.viewBox : '0 0 1024 1024';

  const manifest = {
    generatedAt: new Date().toISOString(),
    canvas: { viewBox: baseViewBox, core: 'ĐÚNG LOOK' },
    layers,
    text
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n');

  const totalSvg = layers.reduce((s, l) => s + l.assets.length, 0);
  console.log('OK manifest written → data/manifest.json');
  console.log(`   ${layers.length} layers, ${totalSvg} svg files`);
  console.log(`   text: ${text.prefix.length} prefix · ${text.suffix.length} suffix`);
  for (const l of layers) {
    console.log(
      `   - ${l.folder}: ${l.assets.length} svg · behavior=${l.behavior} · p=${l.probability}`
    );
  }
}

build();
