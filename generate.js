import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = 'C:/Users/ximon/.google-auth/credentials.json';
const TOKEN_PATH = 'C:/Users/ximon/.google-auth/google-token.json';
const OBSIDIAN_DAILY = 'C:/Users/ximon/Hermes Vault/Daily';

// ── Auth ────────────────────────────────────────────────────────────────────

function getAuth() {
  const creds = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret } = creds.installed || creds.web;
  const auth = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3001/oauth2callback');
  const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  auth.setCredentials(token);
  auth.on('tokens', (tokens) => {
    const existing = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
    writeFileSync(TOKEN_PATH, JSON.stringify({ ...existing, ...tokens }, null, 2));
  });
  return auth;
}

// ── Google helpers ───────────────────────────────────────────────────────────

async function fetchCalendar(auth) {
  const cal = google.calendar({ version: 'v3', auth });
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);
  const res = await cal.events.list({
    calendarId: 'primary',
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.items || [];
}

async function fetchTaskLists(auth) {
  const svc = google.tasks({ version: 'v1', auth });
  const res = await svc.tasklists.list({ maxResults: 20 });
  return res.data.items || [];
}

async function fetchTasksForList(auth, listId, includeCompleted = false) {
  const svc = google.tasks({ version: 'v1', auth });
  const res = await svc.tasks.list({
    tasklist: listId,
    showCompleted: includeCompleted,
    showHidden: includeCompleted,
    maxResults: 100,
  });
  return res.data.items || [];
}

async function fetchGmail(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox',
    maxResults: 20,
  });
  if (!res.data.messages) return [];
  const details = await Promise.all(
    res.data.messages.map(msg =>
      gmail.users.messages.get({
        userId: 'me', id: msg.id, format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })
    )
  );
  return details.map(d => ({
    from: d.data.payload.headers.find(h => h.name === 'From')?.value || '',
    subject: d.data.payload.headers.find(h => h.name === 'Subject')?.value || '(inget ämne)',
    snippet: d.data.snippet || '',
  }));
}

// ── Filtering ────────────────────────────────────────────────────────────────

const NOISE_PATTERNS = [
  /github/i, /vercel/i, /newsletter/i, /noreply/i, /no-reply/i,
  /unsubscribe/i, /bekräftelse/i, /confirmation/i, /notification/i,
  /donotreply/i, /marketing/i, /info@/i, /nyhetsbrev/i,
];

function filterMail(emails) {
  const filtered = emails.filter(e => {
    const text = `${e.from} ${e.subject} ${e.snippet}`;
    return !NOISE_PATTERNS.some(p => p.test(text));
  });
  return filtered.slice(0, 5);
}

// ── Countdowns ───────────────────────────────────────────────────────────────

function readManualCountdowns() {
  const path = join(__dirname, 'countdowns.json');
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  return (data.countdowns || []).map(c => ({
    label: c.label,
    deadline: new Date(c.deadline.includes('T') ? c.deadline : c.deadline + 'T23:59:00'),
  }));
}

function tasksToCountdowns(tasks) {
  return tasks
    .filter(t => t.due && t.status === 'needsAction')
    .map(t => ({
      label: t.title,
      deadline: new Date(t.due),
    }));
}

function formatCountdown(deadline) {
  const diff = deadline - new Date();
  if (diff <= 0) return { text: 'nu', cls: 'urgent' };
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (h < 24) return { text: `${h}h ${Math.floor((diff % 3600000) / 60000)}m`, cls: 'urgent' };
  if (d < 3) return { text: `${d}d ${h % 24}h`, cls: 'urgent' };
  if (d < 14) return { text: `${d}d`, cls: 'soon' };
  return { text: `${d}d`, cls: 'far' };
}

function mergeCountdowns(manual, fromTasks) {
  const seen = new Set();
  const all = [...manual, ...fromTasks].filter(c => {
    if (seen.has(c.label)) return false;
    seen.add(c.label);
    return true;
  });
  return all.sort((a, b) => a.deadline - b.deadline).slice(0, 6);
}

// ── Two-todo ─────────────────────────────────────────────────────────────────

function readOverride() {
  const path = join(__dirname, 'two-todo-override.json');
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const today = new Date().toISOString().slice(0, 10);
  if (data.date === today && data.todos?.some(t => t.trim())) return data.todos;
  return null;
}

function autoSelectTodos(tasks, events, obsidian) {
  const now = new Date();
  const in3days = new Date(now.getTime() + 3 * 86400000);

  const urgent = tasks
    .filter(t => t.due && t.status === 'needsAction' && new Date(t.due) <= in3days)
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .map(t => t.title);

  if (urgent.length >= 2) return urgent.slice(0, 2);

  // Check calendar for prep-needed meetings
  const prepNeeded = events
    .filter(e => {
      const title = (e.summary || '').toLowerCase();
      return title.includes('möte') || title.includes('samtal') || title.includes('presentation') || title.includes('np');
    })
    .map(e => `Förbered: ${e.summary}`);

  const candidates = [...urgent, ...prepNeeded];
  if (candidates.length >= 2) return candidates.slice(0, 2);

  // Fall back to any task with due date
  const withDue = tasks
    .filter(t => t.due && t.status === 'needsAction')
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .map(t => t.title);

  const all = [...new Set([...candidates, ...withDue])];
  if (all.length === 0) return ['Lägg till en todo om du vill', 'Lägg till en till om du vill'];
  if (all.length === 1) return [all[0], 'Lägg till en till om du vill'];
  return all.slice(0, 2);
}

// ── Obsidian daily ───────────────────────────────────────────────────────────

function readObsidianDaily() {
  const today = new Date().toISOString().slice(0, 10);
  const path = join(OBSIDIAN_DAILY, `${today}.md`);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

// ── Calendar formatting ──────────────────────────────────────────────────────

function formatEvents(events) {
  const now = new Date();
  return events.map(e => {
    const start = new Date(e.start.dateTime || e.start.date);
    const end = new Date(e.end.dateTime || e.end.date);
    const timeStr = e.start.dateTime
      ? start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
      : 'heldag';
    let cls = '';
    if (end < now) cls = 'past';
    else if (start <= now && end > now) cls = 'now';
    return { time: timeStr, title: e.summary || 'Namnlöst event', cls };
  });
}

// ── HTML generation ──────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCountdowns(countdowns) {
  if (!countdowns.length) return '<p class="empty-section">Inga nedräkningar.</p>';
  return '<ul>' + countdowns.map(c => {
    const { text, cls } = formatCountdown(c.deadline);
    return `<li class="${cls}"><span class="label">${esc(c.label)}</span><span class="time" data-deadline="${c.deadline.toISOString()}">${esc(text)}</span></li>`;
  }).join('') + '</ul>';
}

function renderEvents(events) {
  if (!events.length) return '<p class="empty-section">Inga möten idag. Bra.</p>';
  return '<ul>' + events.map(e =>
    `<li class="${e.cls}"><span class="time">${esc(e.time)}</span><span class="title">${esc(e.title)}</span></li>`
  ).join('') + '</ul>';
}

function renderMail(emails) {
  if (!emails.length) return '<p class="empty-section">Inga mail att svara på.</p>';
  return '<ul>' + emails.map(e =>
    `<li><span class="from">${esc(e.from.replace(/<.*>/, '').trim())}</span><span class="subject">${esc(e.subject)}</span></li>`
  ).join('') + '</ul>';
}

function renderStandiga(tasks) {
  if (!tasks.length) return '<p class="empty-section">Inga ständiga todos.</p>';
  const now = new Date();
  const isLate = now.getHours() >= 10;
  return '<ul>' + tasks.map(t => {
    const done = t.status === 'completed';
    const overdue = !done && isLate;
    const cls = done ? 'done' : overdue ? 'overdue' : '';
    const box = done ? '[×]' : '[ ]';
    return `<li class="${cls}"><span class="box">${box}</span>${esc(t.title)}</li>`;
  }).join('') + '</ul>';
}

function renderTodos(todos) {
  return todos.map((t, i) => {
    const empty = !t || t.startsWith('Lägg till');
    return `<li class="${empty ? 'empty' : ''}">${esc(t || 'Lägg till en todo om du vill')}</li>`;
  }).join('');
}

function buildHtml({ todos, countdowns, events, mail, standiga, curatedAt }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Fokus</title>
<style>
  :root {
    --bg: #1C1C1C;
    --fg: #EEEAE0;
    --fg-dim: #8A857B;
    --fg-faint: #4A473F;
    --magenta: #E63B8B;
    --yellow-green: #C6D645;
    --line: #2D2D2D;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: var(--bg); color: var(--fg);
    font-family: "Trebuchet MS", sans-serif;
    min-height: 100vh; line-height: 1.4;
    -webkit-font-smoothing: antialiased;
  }
  body { padding: 48px 64px 96px; max-width: 1600px; margin: 0 auto; }
  header {
    display: flex; justify-content: space-between; align-items: baseline;
    padding-bottom: 24px; border-bottom: 1px solid var(--line); margin-bottom: 64px;
  }
  header .date { font-size: 22px; }
  header .meta { font-size: 14px; color: var(--fg-dim); }
  header #clock { font-size: 22px; color: var(--fg-dim); font-variant-numeric: tabular-nums; margin-left: 32px; }
  .two-todo { margin-bottom: 96px; }
  .two-todo .label {
    color: var(--magenta); font-size: 14px; letter-spacing: 0.15em;
    text-transform: uppercase; margin-bottom: 32px;
  }
  .two-todo .label::after {
    content: ""; display: block; width: 64px; height: 1px;
    background: var(--magenta); margin-top: 12px;
  }
  .two-todo ol { list-style: none; counter-reset: tt; }
  .two-todo li {
    counter-increment: tt; font-size: 44px; line-height: 1.25;
    padding: 18px 0; display: flex; gap: 32px; align-items: baseline;
  }
  .two-todo li::before {
    content: counter(tt); color: var(--fg-faint); font-size: 44px;
    flex: 0 0 auto; min-width: 40px;
  }
  .two-todo li.empty { color: var(--fg-faint); font-size: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px 96px; }
  section h2 {
    color: var(--fg-dim); font-size: 13px; letter-spacing: 0.18em;
    text-transform: uppercase; font-weight: normal;
    margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--line);
  }
  .countdowns ul { list-style: none; }
  .countdowns li {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 10px 0; font-size: 18px;
  }
  .countdowns .label { color: var(--fg); }
  .countdowns .time { font-variant-numeric: tabular-nums; color: var(--fg-dim); font-size: 15px; }
  .countdowns .urgent .time, .countdowns .urgent .label { color: var(--magenta); }
  .countdowns .soon .time { color: var(--fg); }
  .countdowns .far .label, .countdowns .far .time { color: var(--fg-faint); }
  .calendar ul { list-style: none; }
  .calendar li { display: flex; gap: 20px; padding: 10px 0; font-size: 18px; }
  .calendar .time { flex: 0 0 72px; color: var(--fg-dim); font-variant-numeric: tabular-nums; }
  .calendar .title { color: var(--fg); }
  .calendar li.now .time, .calendar li.now .title { color: var(--yellow-green); }
  .calendar li.past .title, .calendar li.past .time { color: var(--fg-faint); }
  .mail ul { list-style: none; }
  .mail li { padding: 10px 0; font-size: 17px; border-bottom: 1px solid var(--line); }
  .mail li:last-child { border-bottom: none; }
  .mail .from { color: var(--fg-dim); font-size: 13px; display: block; margin-bottom: 4px; }
  .mail .subject { color: var(--fg); }
  .persistent ul { list-style: none; }
  .persistent li { padding: 10px 0; font-size: 18px; display: flex; gap: 14px; align-items: baseline; }
  .persistent .box { font-family: monospace; color: var(--fg-dim); }
  .persistent li.done { color: var(--fg-faint); text-decoration: line-through; }
  .persistent li.done .box { color: var(--fg-faint); }
  .persistent li.overdue { color: var(--magenta); }
  .persistent li.overdue .box { color: var(--magenta); }
  .empty-section { color: var(--fg-faint); font-size: 16px; font-style: italic; padding: 12px 0; }
  @media (max-width: 900px) {
    body { padding: 32px 24px 64px; }
    .grid { grid-template-columns: 1fr; gap: 48px; }
    .two-todo li { font-size: 28px; }
    .two-todo li::before { font-size: 28px; min-width: 28px; }
    header { flex-wrap: wrap; }
  }
</style>
</head>
<body>

<header>
  <div>
    <div class="date">${esc(dateStr)}</div>
    <div class="meta">kurerad ${esc(curatedAt)}</div>
  </div>
  <div id="clock"></div>
</header>

<section class="two-todo">
  <div class="label">idag gör du bara två saker</div>
  <ol>${renderTodos(todos)}</ol>
</section>

<div class="grid">

  <section class="countdowns">
    <h2>Nedräkning</h2>
    ${renderCountdowns(countdowns)}
  </section>

  <section class="calendar">
    <h2>Idag</h2>
    ${renderEvents(events)}
  </section>

  <section class="mail">
    <h2>Mail att svara på</h2>
    ${renderMail(mail)}
  </section>

  <section class="persistent">
    <h2>Ständiga</h2>
    ${renderStandiga(standiga)}
  </section>

</div>

<script>
  function pad(n) { return String(n).padStart(2, '0'); }

  function updateClock() {
    const n = new Date();
    document.getElementById('clock').textContent = pad(n.getHours()) + ':' + pad(n.getMinutes());
  }
  updateClock();
  setInterval(updateClock, 30000);

  function updateCountdowns() {
    document.querySelectorAll('.time[data-deadline]').forEach(el => {
      const diff = new Date(el.dataset.deadline) - new Date();
      if (diff <= 0) { el.textContent = 'nu'; return; }
      const totalH = Math.floor(diff / 3600000);
      const d = Math.floor(totalH / 24);
      const h = totalH % 24;
      const m = Math.floor((diff % 3600000) / 60000);
      if (totalH < 24) el.textContent = totalH + 'h ' + m + 'm';
      else if (d < 3) el.textContent = d + 'd ' + h + 'h';
      else el.textContent = d + 'd';
    });
  }
  updateCountdowns();
  setInterval(updateCountdowns, 60000);
</script>
</body>
</html>`;
}

// ── Fetch all data ───────────────────────────────────────────────────────────

async function fetchAllData() {
  const auth = getAuth();

  const [calEvents, taskLists, rawMail] = await Promise.all([
    fetchCalendar(auth).catch(e => { console.warn('Kalender:', e.message); return []; }),
    fetchTaskLists(auth).catch(e => { console.warn('Tasks:', e.message); return []; }),
    fetchGmail(auth).catch(e => { console.warn('Gmail:', e.message); return []; }),
  ]);

  const standigaList = taskLists.find(l => l.title === 'Ständiga');
  const allTasksArrays = await Promise.all(
    taskLists.map(l => fetchTasksForList(auth, l.id).catch(() => []))
  );
  const standigaTasks = standigaList
    ? await fetchTasksForList(auth, standigaList.id, true).catch(() => [])
    : [];

  const allTasks = allTasksArrays.flat();
  const obsidian = readObsidianDaily();

  return { calEvents, allTasks, standigaTasks, rawMail, obsidian };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dataOnly = process.argv.includes('--data-only');

  console.log('Hämtar data...');
  const { calEvents, allTasks, standigaTasks, rawMail, obsidian } = await fetchAllData();

  const taskCountdowns = tasksToCountdowns(allTasks);
  const manualCountdowns = readManualCountdowns();
  const countdowns = mergeCountdowns(manualCountdowns, taskCountdowns);
  const mail = filterMail(rawMail);
  const events = formatEvents(calEvents);

  if (dataOnly) {
    // Spara rådata för Claude att resonera över
    const dataDir = join(__dirname, 'data');
    if (!existsSync(dataDir)) { import('fs').then(fs => fs.mkdirSync(dataDir)); }
    const { mkdirSync } = await import('fs');
    if (!existsSync(dataDir)) mkdirSync(dataDir);

    const raw = {
      date: new Date().toISOString().slice(0, 10),
      calendar: calEvents.map(e => ({
        title: e.summary,
        start: e.start.dateTime || e.start.date,
        end: e.end.dateTime || e.end.date,
      })),
      tasks: allTasks
        .filter(t => t.status === 'needsAction')
        .map(t => ({ title: t.title, due: t.due || null, notes: t.notes || null })),
      standiga: standigaTasks.map(t => ({ title: t.title, done: t.status === 'completed' })),
      mail: mail.map(e => ({ from: e.from, subject: e.subject, snippet: e.snippet })),
      countdowns: countdowns.map(c => ({ label: c.label, deadline: c.deadline.toISOString() })),
      obsidian: obsidian || null,
    };

    writeFileSync(join(__dirname, 'data', 'raw.json'), JSON.stringify(raw, null, 2), 'utf-8');
    console.log('data/raw.json skriven. Claude kan nu välja two-todos.');
    return;
  }

  // Läs Claude-kurering om den finns och är från idag
  const today = new Date().toISOString().slice(0, 10);
  const curatedPath = join(__dirname, 'data', 'curated.json');
  let claudeCurated = null;
  if (existsSync(curatedPath)) {
    const c = JSON.parse(readFileSync(curatedPath, 'utf-8'));
    if (c.date === today) claudeCurated = c;
  }

  const todos = claudeCurated?.todos || readOverride() || autoSelectTodos(allTasks, calEvents, obsidian);
  const finalCountdowns = claudeCurated?.countdowns
    ? claudeCurated.countdowns.map(c => ({ label: c.label, deadline: new Date(c.deadline) }))
    : countdowns;
  const finalMail = claudeCurated?.mail || mail;

  const now = new Date();
  const curatedAt = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  const html = buildHtml({ todos, countdowns: finalCountdowns, events, mail: finalMail, standiga: standigaTasks, curatedAt });
  writeFileSync(join(__dirname, 'index.html'), html, 'utf-8');
  console.log('index.html skriven.');

  const dateStamp = now.toISOString().slice(0, 16).replace('T', ' ');
  execSync(`git -C "${__dirname}" add index.html`, { stdio: 'inherit' });
  execSync(`git -C "${__dirname}" commit -m "Morgonsida ${dateStamp}"`, { stdio: 'inherit' });
  execSync(`git -C "${__dirname}" push`, { stdio: 'inherit' });
  console.log(`\nDone. Sidan deployar till https://ximonse.github.io/fp560/`);

  console.log('\n--- Sammanfattning ---');
  console.log('Two-todos:', todos);
  const urgent = finalCountdowns.filter(c => (c.deadline - new Date()) < 3 * 86400000);
  if (urgent.length) console.log('Akuta nedräkningar:', urgent.map(c => c.label).join(', '));
  if (!obsidian) console.log('OBS: Ingen Obsidian daily för idag.');
}

main().catch(e => { console.error(e); process.exit(1); });
