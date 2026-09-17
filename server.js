require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const plansRoute = require('./src/routes/plans');
const subscribeRoute = require('./src/routes/subscribe');
const payfastNotifyRoute = require('./src/routes/payfastNotify');
const formUploadRoute = require('./src/routes/formUpload');
const { router: adminRoute } = require('./src/routes/admin');
const articlesRoute = require('./src/routes/articles');

const app = express();
app.use(cookieParser());

// The site and the API are served from the same origin now, so CORS
// isn't strictly needed — but it's harmless to leave configured in
// case you ever call the API from somewhere else (a separate admin
// dashboard, etc). Leave ALLOWED_ORIGINS unset to allow all origins.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const localPreviewOrigins = ['http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(
  cors({
    origin: (origin, callback) => {
      const origins = allowedOrigins.length
        ? allowedOrigins
        : localPreviewOrigins;
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true,
  })
);

// Capture the raw body (needed to forward an identical copy to
// PayFast's validation endpoint) while still parsing form fields.
app.use(
  express.urlencoded({
    extended: false,
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', plansRoute);
app.use('/api', subscribeRoute);
app.use('/api', payfastNotifyRoute);
app.use('/api', formUploadRoute);
app.use('/api', adminRoute);
app.use('/api', articlesRoute);

// Serve the website itself — index.html, style.css, subscribe.js,
// the downloadable forms, everything in /public.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`LLCT Solutions running at http://localhost:${PORT}`);

  if (process.env.npm_lifecycle_event === 'dev') {
    const url = `http://localhost:${PORT}`;
    const command = process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

    require('child_process').exec(command);
  }
});
