const express = require('express');
const path = require('path');
const articles = require('./lib/articles');
const auth = require('./lib/auth');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.locals.formatDate = articles.formatDate;
app.locals.admin = false;
app.locals.csrf = '';

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; form-action 'self'; frame-ancestors 'none'");
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(auth.attach);

const notFound = (res) => res.status(404).render('404', { title: 'Page not found' });

// ---------- guest section ----------

app.get('/', async (req, res) => {
  res.render('home', { title: 'Home', articles: await articles.list() });
});

app.get('/article/:id', async (req, res) => {
  const article = await articles.read(req.params.id);
  if (!article) return notFound(res);
  res.render('article', { title: article.title, article, paragraphs: articles.paragraphs(article.content) });
});

// ---------- login / logout ----------

app.get('/login', (req, res) => {
  if (req.session) return res.redirect('/admin');
  res.render('login', { title: 'Log in', error: null });
});

app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;
  if (auth.checkLogin(String(username), String(password))) {
    auth.startSession(res);
    return res.redirect(303, '/admin');
  }
  res.status(401).render('login', { title: 'Log in', error: 'Wrong username or password.' });
});

app.post('/logout', (req, res) => {
  if (!req.session) return res.redirect('/');
  auth.verifyCsrf(req, res, () => {
    auth.endSession(res);
    res.redirect(303, '/');
  });
});

// ---------- admin section ----------

const admin = express.Router();
admin.use(auth.requireAdmin);
admin.use((req, res, next) => (req.method === 'POST' ? auth.verifyCsrf(req, res, next) : next()));

const FLASH = new Map([
  ['created', 'Article published.'],
  ['updated', 'Changes saved.'],
  ['deleted', 'Article deleted.'],
]);

admin.get('/', async (req, res) => {
  const msg = typeof req.query.msg === 'string' ? FLASH.get(req.query.msg) : null;
  res.render('dashboard', { title: 'Dashboard', articles: await articles.list(), message: msg });
});

admin.get('/new', (req, res) => {
  res.render('editor', {
    title: 'New article', isNew: true, id: null, errors: [],
    values: { title: '', content: '', date: articles.today() },
  });
});

admin.post('/new', async (req, res) => {
  const { values, errors } = articles.check(req.body);
  if (errors.length) {
    return res.status(400).render('editor', { title: 'New article', isNew: true, id: null, errors, values });
  }
  await articles.create(values);
  res.redirect(303, '/admin?msg=created');
});

admin.get('/edit/:id', async (req, res) => {
  const article = await articles.read(req.params.id);
  if (!article) return notFound(res);
  res.render('editor', { title: 'Edit article', isNew: false, id: article.id, errors: [], values: article });
});

admin.post('/edit/:id', async (req, res) => {
  if (!(await articles.read(req.params.id))) return notFound(res);
  const { values, errors } = articles.check(req.body);
  if (errors.length) {
    return res.status(400).render('editor', { title: 'Edit article', isNew: false, id: req.params.id, errors, values });
  }
  await articles.update(req.params.id, values);
  res.redirect(303, '/admin?msg=updated');
});

admin.get('/delete/:id', async (req, res) => {
  const article = await articles.read(req.params.id);
  if (!article) return notFound(res);
  res.render('confirm-delete', { title: 'Delete article', article });
});

admin.post('/delete/:id', async (req, res) => {
  if (!(await articles.remove(req.params.id))) return notFound(res);
  res.redirect(303, '/admin?msg=deleted');
});

app.use('/admin', admin);

// ---------- fallbacks ----------

app.use((req, res) => notFound(res));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large') {
    return res.status(413).render('error', { title: 'Too large', message: 'That article is too long to save.' });
  }
  console.error(err);
  res.status(500).render('error', { title: 'Error', message: 'Something went wrong on our side.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Blog running at http://localhost:${port}`);
  if (auth.usingDefaults) {
    console.log('Admin login is admin / changeme. Set ADMIN_USER and ADMIN_PASSWORD to change it.');
  }
});
