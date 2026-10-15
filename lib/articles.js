const fs = require('fs/promises');
const path = require('path');

// One JSON file per article: articles/<id>.json
const DIR = process.env.ARTICLES_DIR || path.join(__dirname, '..', 'articles');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const MAX_TITLE = 150;
const MAX_CONTENT = 50000;

const isId = (id) => /^\d{1,9}$/.test(String(id));
const fileFor = (id) => path.join(DIR, `${id}.json`);

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function formatDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Blank lines separate paragraphs
function paragraphs(text) {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

function check(form) {
  const values = {
    title: String(form.title ?? '').trim(),
    content: String(form.content ?? '').replace(/\r\n/g, '\n').trim(),
    date: String(form.date ?? '').trim(),
  };
  const errors = [];
  if (!values.title) errors.push('Give the article a title.');
  else if (values.title.length > MAX_TITLE) errors.push(`The title can be at most ${MAX_TITLE} characters.`);
  if (!values.content) errors.push('The article needs some content.');
  else if (values.content.length > MAX_CONTENT) errors.push(`The content can be at most ${MAX_CONTENT} characters.`);
  if (!isRealDate(values.date)) errors.push('Pick a valid publication date.');
  return { values, errors };
}

async function fileNames() {
  try {
    return await fs.readdir(DIR);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function idsFrom(names) {
  return names.map((n) => n.match(/^(\d+)\.json$/)).filter(Boolean).map((m) => m[1]);
}

async function read(id) {
  if (!isId(id)) return null;
  try {
    const data = JSON.parse(await fs.readFile(fileFor(id), 'utf8'));
    if (typeof data.title !== 'string' || typeof data.content !== 'string' || !isRealDate(String(data.date))) {
      return null;
    }
    return { id: String(id), title: data.title, content: data.content, date: data.date };
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Skipping article ${id}: ${err.message}`);
    return null;
  }
}

async function list() {
  const ids = idsFrom(await fileNames());
  const articles = (await Promise.all(ids.map((id) => read(id)))).filter(Boolean);
  return articles.sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
}

function serialize({ title, content, date }) {
  return JSON.stringify({ title, content, date }, null, 2) + '\n';
}

async function create(article) {
  await fs.mkdir(DIR, { recursive: true });
  for (let attempt = 0; attempt < 5; attempt++) {
    const next = idsFrom(await fileNames()).reduce((max, id) => Math.max(max, Number(id)), 0) + 1;
    try {
      // 'wx' refuses to overwrite a file that appeared in the meantime
      await fs.writeFile(fileFor(next), serialize(article), { flag: 'wx' });
      return String(next);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  throw new Error('Could not find a free article ID.');
}

async function update(id, article) {
  if (!(await read(id))) return false;
  const tmp = fileFor(id) + '.tmp';
  await fs.writeFile(tmp, serialize(article));
  await fs.rename(tmp, fileFor(id));
  return true;
}

async function remove(id) {
  if (!isId(id)) return false;
  try {
    await fs.unlink(fileFor(id));
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

module.exports = { list, read, create, update, remove, check, formatDate, paragraphs, today };
