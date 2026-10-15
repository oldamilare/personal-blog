const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Point the store at a throwaway folder before loading it
process.env.ARTICLES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-test-'));
const articles = require('../lib/articles');

const sample = { title: 'Hello', content: 'First paragraph.\n\nSecond one.', date: '2026-03-04' };

test('check accepts a good article and trims it', () => {
  const { values, errors } = articles.check({ title: '  Hi  ', content: ' text ', date: '2026-01-31' });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(values.title, 'Hi');
  assert.strictEqual(values.content, 'text');
});

test('check rejects missing fields and impossible dates', () => {
  assert.strictEqual(articles.check({}).errors.length, 3);
  assert.ok(articles.check({ ...sample, date: '2026-02-30' }).errors.length > 0);
  assert.ok(articles.check({ ...sample, date: 'tomorrow' }).errors.length > 0);
  assert.ok(articles.check({ ...sample, title: 'x'.repeat(151) }).errors.length > 0);
});

test('create, read, update, list and remove', async () => {
  const first = await articles.create(sample);
  const second = await articles.create({ ...sample, title: 'Newer', date: '2026-05-01' });
  assert.strictEqual(first, '1');
  assert.strictEqual(second, '2');

  assert.strictEqual((await articles.read(first)).title, 'Hello');
  assert.deepStrictEqual((await articles.list()).map((a) => a.title), ['Newer', 'Hello']);

  assert.ok(await articles.update(first, { ...sample, title: 'Changed' }));
  assert.strictEqual((await articles.read(first)).title, 'Changed');

  assert.ok(await articles.remove(first));
  assert.strictEqual(await articles.read(first), null);
  assert.strictEqual(await articles.remove(first), false);
});

test('ids that are not plain numbers never touch the disk', async () => {
  assert.strictEqual(await articles.read('../package'), null);
  assert.strictEqual(await articles.read('1.json'), null);
  assert.strictEqual(await articles.remove('../../etc/passwd'), false);
  assert.strictEqual(await articles.update('abc', sample), false);
});

test('a damaged file is skipped instead of breaking the list', async () => {
  fs.writeFileSync(path.join(process.env.ARTICLES_DIR, '99.json'), '{not json');
  const list = await articles.list();
  assert.ok(list.every((a) => a.id !== '99'));
});

test('formatDate and paragraphs', () => {
  assert.strictEqual(articles.formatDate('2026-10-05'), 'October 5, 2026');
  assert.deepStrictEqual(articles.paragraphs('a\n\n\nb\nc'), ['a', 'b\nc']);
});
