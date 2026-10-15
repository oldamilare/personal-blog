# Personal Blog

A small personal blog with a public side for readers and a password-protected admin side for writing. Built with Node.js, Express and EJS templates. There's no database: each article is a JSON file in the `articles/` folder. Pages are rendered on the server, and there's no JavaScript in the browser.

Project page: https://roadmap.sh/projects/personal-blog

## Pages

**Guest section**

| Page | URL |
| --- | --- |
| Home, a list of all articles, newest first | `/` |
| Article, with its content and publication date | `/article/<id>` |

**Admin section** (log in first)

| Page | URL |
| --- | --- |
| Log in | `/login` |
| Dashboard, with all articles plus edit, delete and add | `/admin` |
| Add article (title, date, content) | `/admin/new` |
| Edit article | `/admin/edit/<id>` |
| Delete article (asks first) | `/admin/delete/<id>` |

## Run it

You need Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. Two sample articles are included, and you can delete them from the dashboard.

The admin login is `admin` / `changeme` until you change it. Set your own like this:

```bash
ADMIN_USER=me ADMIN_PASSWORD='something long' npm start
```

Other settings, all optional:

| Variable | What it does | Default |
| --- | --- | --- |
| `PORT` | Port to listen on | `3000` |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Admin credentials | `admin`, `changeme` |
| `SESSION_SECRET` | Key used to sign login cookies. If you don't set it, a new one is made on every start, so you're logged out after a restart | random |
| `ARTICLES_DIR` | Where article files are kept | `./articles` |

## Tests

```bash
npm test
```

## How it works

- **Storage**: an article is saved as `articles/<id>.json` with a `title`, `content` and `date`. New articles get the next free number. IDs have to be plain numbers, so a URL can't reach any other file.
- **Writing**: leave a blank line between paragraphs. Everything is escaped when shown, so HTML or script tags in an article appear as text.
- **Login**: a login page creates a session cookie that's signed so it can't be forged, marked `HttpOnly`, and lasts 8 hours. Admin forms also carry a hidden token to block forged cross-site requests.
- **Folders**: `server.js` has the routes, `lib/articles.js` the file storage and validation, `lib/auth.js` the login and session code, `views/` the templates and `public/` the CSS.

## Before putting it online

This is a learning project. If you deploy it, set a real password and `SESSION_SECRET`, run it with `NODE_ENV=production` so the cookie is sent only over HTTPS, and serve it over HTTPS. It doesn't limit repeated login attempts.
