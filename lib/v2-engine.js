// fp560 v2 regelmotor (Fas 1)
//
// Tar raw.json + parsad daily-note, producerar v2/data.json med strukturerad data.
// Inga prosa-rader (now_lines, reminder) — det är Fas 2 (Claude).
//
// Hårda regler:
//   - Items endast från: # Two-todo, # Todo, # Open loops, Google Tasks, Calendar
//   - Aldrig items från: # Anteckningar, # Signal, # Logg, # Claude, # Veckans done
//   - Sleep-event < 15 min eller frånvaro → ignorera
//   - Helgfönster fre 16:00 → sön 18:00 → ingen jobbgrej i Two-todo / today

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { parseDailyNote } from './daily-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SWEDISH_WEEKDAYS = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'];

function isWeekendWindow(now) {
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 6) return true;
  if (day === 5 && hour >= 16) return true;
  if (day === 0 && hour < 18) return true;
  return false;
}

function dayPart(now) {
  const h = now.getHours();
  if (h < 12) return 'morgon';
  if (h < 17) return 'dag';
  if (h < 22) return 'kväll';
  return 'natt';
}

function getSleep(calendar) {
  const sleepEvent = calendar.find(e => /^sleep\b/i.test(e.title || ''));
  if (!sleepEvent || !sleepEvent.start || !sleepEvent.end) return null;
  const start = new Date(sleepEvent.start);
  const end = new Date(sleepEvent.end);
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 15) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return { minutes, label: `${hours}h ${mins}m`, startISO: sleepEvent.start, endISO: sleepEvent.end };
}

function isJobItem(text, list) {
  if (list && /ribba|skola/i.test(list)) return true;
  return /\bribba|\bskola|\blektion|\belev|\bnp\b|\bsensor\b|microbit/i.test(text);
}

function comparable(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[.,:;!?"'()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupItems(items) {
  const result = [];
  for (const item of items) {
    const c = comparable(item.text);
    if (!c || c.length < 3) continue;
    const dup = result.find(r => {
      const rc = comparable(r.text);
      if (rc === c) return true;
      if (c.length >= 8 && rc.startsWith(c)) return true;
      if (rc.length >= 8 && c.startsWith(rc)) return true;
      return false;
    });
    if (!dup) result.push(item);
  }
  return result;
}

function buildTwoTodoOverride(parsed, weekend) {
  const result = [];
  for (const t of parsed.twoTodo) {
    if (t.done) continue;
    if (weekend && isJobItem(t.text, null)) continue;
    result.push({ text: t.text, done: false });
  }
  return result;
}

function buildTodayItems(parsed, tasks, weekend) {
  const items = [];
  for (const t of parsed.todo) {
    if (t.done) continue;
    items.push({ text: t.text, due: null, source: 'daily-note', list: null });
  }
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  for (const t of tasks) {
    if (!t.due) continue;
    if (new Date(t.due) > todayEnd) continue;
    if (weekend && isJobItem(t.title, t.list)) continue;
    items.push({ text: t.title, due: t.due, source: 'task', list: t.list });
  }
  return dedupItems(items);
}

function buildTodayEvents(calendar) {
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return calendar
    .filter(e => new Date(e.start) <= todayEnd)
    .map(e => {
      const start = new Date(e.start);
      const isAllDay = !e.start.includes('T');
      const time = isAllDay
        ? 'heldag'
        : start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      return { time, title: e.title, isAllDay, startISO: e.start, endISO: e.end };
    });
}

function buildWeekAhead(calendar, tasks) {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const in7 = new Date(tomorrow);
  in7.setDate(in7.getDate() + 7);

  const events = calendar
    .filter(e => {
      const s = new Date(e.start);
      return s >= tomorrow && s < in7;
    })
    .map(e => ({ type: 'event', date: e.start, title: e.title }));

  const taskItems = tasks
    .filter(t => t.due && new Date(t.due) >= tomorrow && new Date(t.due) < in7)
    .map(t => ({ type: 'task', date: t.due, title: t.title, list: t.list }));

  return [...events, ...taskItems].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function buildNextWeekPrep(calendar, tasks) {
  const in7 = new Date();
  in7.setHours(0, 0, 0, 0);
  in7.setDate(in7.getDate() + 7);
  const in14 = new Date(in7);
  in14.setDate(in14.getDate() + 7);

  const events = calendar
    .filter(e => {
      const s = new Date(e.start);
      return s >= in7 && s < in14;
    })
    .map(e => ({ type: 'event', date: e.start, title: e.title }));

  const taskItems = tasks
    .filter(t => t.due && new Date(t.due) >= in7 && new Date(t.due) < in14)
    .map(t => ({ type: 'task', date: t.due, title: t.title, list: t.list }));

  return [...events, ...taskItems].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function buildImportantMail(mail) {
  return mail.slice(0, 5);
}

export function buildV2Data(raw, dailyNoteContent) {
  const now = new Date();
  const weekend = isWeekendWindow(now);
  // dailyNoteContent vinner över raw.obsidian — för CLI-test mot färsk fil-version.
  // Vid integration i generate.js skickas raw.obsidian (atomisk snapshot).
  const noteSource = dailyNoteContent ?? raw.obsidian;
  const parsed = noteSource
    ? parseDailyNote(noteSource)
    : { twoTodo: [], todo: [], openLoops: [], anteckningar: [], signal: [], logg: [], claude: [], veckansDone: [] };

  return {
    meta: {
      generatedAt: now.toISOString(),
      date: raw.date,
      weekday: SWEDISH_WEEKDAYS[now.getDay()],
      weekend,
      currentDayPart: dayPart(now),
    },
    twoTodoOverride: buildTwoTodoOverride(parsed, weekend),
    todayItems: buildTodayItems(parsed, raw.tasks, weekend),
    todayEvents: buildTodayEvents(raw.calendar),
    openLoops: parsed.openLoops,
    weekAhead: buildWeekAhead(raw.calendar, raw.tasks),
    nextWeekPrep: buildNextWeekPrep(raw.calendar, raw.tasks),
    importantMail: buildImportantMail(raw.mail),
    sleep: getSleep(raw.calendar),
    nowLines: [],   // Fas 2 — Claude fyller per dagdel
    reminder: null, // Fas 2 — Claude valfri prosarad
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const rawPath = join(ROOT, 'data', 'raw.json');
  if (!existsSync(rawPath)) {
    console.error('data/raw.json saknas. Kör: node generate.js --data-only');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));

  // CLI: läs dagens daily-note färskt från disk (raw.obsidian kan vara cachad/inaktuell)
  const today = raw.date;
  const vaultPaths = [
    process.env.OBSIDIAN_DAILY_PATH,
    '/mnt/c/Users/ximon/Hermes Vault',
    'C:\\Users\\ximon\\Hermes Vault',
  ].filter(Boolean);
  let dailyNote = null;
  for (const base of vaultPaths) {
    const p = join(base, `${today}.md`);
    if (existsSync(p)) { dailyNote = readFileSync(p, 'utf-8'); break; }
  }
  if (!dailyNote) console.warn('VARNING: dagens daily-note hittades inte, använder raw.obsidian');

  const data = buildV2Data(raw, dailyNote);

  const v2Dir = join(ROOT, 'v2');
  if (!existsSync(v2Dir)) mkdirSync(v2Dir);
  writeFileSync(join(v2Dir, 'data.json'), JSON.stringify(data, null, 2), 'utf-8');

  console.log(`Wrote v2/data.json. Summary:`);
  console.log(`  ${data.meta.weekday} ${data.meta.date}, dayPart=${data.meta.currentDayPart}, weekend=${data.meta.weekend}`);
  console.log(`  twoTodoOverride: ${data.twoTodoOverride.length}`);
  console.log(`  todayItems:      ${data.todayItems.length}`);
  console.log(`  todayEvents:     ${data.todayEvents.length}`);
  console.log(`  openLoops:       ${data.openLoops.length}`);
  console.log(`  weekAhead:       ${data.weekAhead.length}`);
  console.log(`  nextWeekPrep:    ${data.nextWeekPrep.length}`);
  console.log(`  importantMail:   ${data.importantMail.length}`);
  console.log(`  sleep:           ${data.sleep ? data.sleep.label : '(ingen data)'}`);
}
