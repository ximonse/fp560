// Parsar Hermes Vault daily-notes till strukturerad data per sektion.
// Sektionsregler: items kommer endast från Two-todo, Todo, Open loops.
// Anteckningar/Signal/Logg/Claude/Veckans done är kontext, ej items.

import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

const KNOWN_SECTIONS = {
  'two-todo': 'twoTodo',
  'todo': 'todo',
  'open loops': 'openLoops',
  'anteckningar': 'anteckningar',
  'signal': 'signal',
  'logg': 'logg',
  'claude': 'claude',
  'veckans done': 'veckansDone',
};

function normalizeHeader(line) {
  return line.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim().toLowerCase();
}

function stripInlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

function parseCheckbox(line) {
  const m = line.match(/^-\s*\[(.)\]\s+(.+)$/);
  if (!m) return null;
  return { text: stripInlineMarkdown(m[2]), done: m[1].toLowerCase() === 'x' };
}

function parseBullet(line) {
  const m = line.match(/^-\s+(.+)$/);
  if (!m) return null;
  return stripInlineMarkdown(m[1]);
}

// Känd quirk: mallen råkar ha `# Two-todo` två gånger (en överst, en längre ner).
// Parsern appendar från båda. Idag är andra alltid tom så output är korrekt.
// Om Hermes någon gång fyller den andra → dubletter. Fixa när det blir ett problem.
export function parseDailyNote(content) {
  const lines = content.split('\n');
  const sections = {
    twoTodo: [],
    todo: [],
    openLoops: [],
    anteckningar: [],
    signal: [],
    logg: [],
    claude: [],
    veckansDone: [],
  };

  let currentKey = null;
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('# ')) {
      const norm = normalizeHeader(line);
      currentKey = KNOWN_SECTIONS[norm] || null;
      continue;
    }
    if (!currentKey) continue;

    if (currentKey === 'twoTodo' || currentKey === 'todo') {
      const cb = parseCheckbox(line);
      if (cb) sections[currentKey].push(cb);
    } else {
      const b = parseBullet(line);
      if (b) sections[currentKey].push(b);
    }
  }

  return sections;
}

// CLI-test: node lib/daily-parser.js <path-to-daily-note.md>
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: node lib/daily-parser.js <path-to-daily-note.md>');
    process.exit(1);
  }
  const content = readFileSync(path, 'utf-8');
  const result = parseDailyNote(content);
  for (const [key, items] of Object.entries(result)) {
    console.log(`\n--- ${key} (${items.length}) ---`);
    for (const item of items.slice(0, 5)) {
      console.log(typeof item === 'object' ? `[${item.done ? 'x' : ' '}] ${item.text}` : `  ${item}`);
    }
    if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
  }
}
