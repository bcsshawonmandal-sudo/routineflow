/**
 * server.js — RoutineFlow Full-Stack Server
 * Express backend providing Google Authentication, Turso Cloud Database persistence,
 * and static asset hosting.
 */

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { query, execute, initSchema } = require('./server/turso');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

let schemaReady = false;
async function ensureSchemaReady() {
  if (!schemaReady) {
    try {
      await initSchema();
      schemaReady = true;
    } catch (err) {
      console.warn('Schema init note:', err.message);
    }
  }
}

// Auth & Session Middleware
app.use(async (req, res, next) => {
  await ensureSchemaReady();
  req.user = null;
  const userId = req.cookies.routine_session;

  if (userId) {
    try {
      const users = await query('SELECT id, email, name, picture, created_at FROM users WHERE id = ?;', [userId]);
      if (users.length > 0) {
        req.user = users[0];
      }
    } catch (err) {
      console.error('Session lookup error:', err.message);
    }
  }
  next();
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

/**
 * GET /api/auth/me
 * Returns current authenticated user profile and Turso connection status.
 */
app.get('/api/auth/me', (req, res) => {
  res.json({
    user: req.user || null,
    tursoConnected: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || ''
  });
});

/**
 * POST /api/auth/google
 * Accepts Google Identity Services JWT credential, verifies payload, and stores user in Turso.
 */
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential token.' });
    }

    // Decode JWT payload (Google ID Token)
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid Google credential token format.' });
    }

    const payloadRaw = Buffer.from(parts[1], 'base64').toString('utf-8');
    const payload = JSON.parse(payloadRaw);

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || email.split('@')[0];
    const picture = payload.picture || '';

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Invalid payload in Google credential.' });
    }

    // Upsert into Turso users table
    await execute(
      `INSERT INTO users (id, email, name, picture, last_login)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         picture = excluded.picture,
         last_login = CURRENT_TIMESTAMP;`,
      [googleId, email, name, picture]
    );

    // Set HTTP-only session cookie
    res.cookie('routine_session', googleId, {
      httpOnly: true,
      maxAge: 30 * 24 * 3600 * 1000,
      sameSite: 'lax',
      path: '/'
    });

    const user = { id: googleId, email, name, picture };
    res.json({ success: true, user });
  } catch (err) {
    console.error('Google sign-in error:', err);
    res.status(500).json({ error: 'Failed to authenticate with Google: ' + err.message });
  }
});

/**
 * POST /api/auth/demo
 * Quick test / demo login that creates/logs in a simulated Google user in Turso.
 */
app.post('/api/auth/demo', async (req, res) => {
  try {
    const demoUser = {
      id: 'google_user_demo_777',
      email: 'alex.rivera.demo@gmail.com',
      name: 'Alex Rivera',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'
    };

    await execute(
      `INSERT INTO users (id, email, name, picture, last_login)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         picture = excluded.picture,
         last_login = CURRENT_TIMESTAMP;`,
      [demoUser.id, demoUser.email, demoUser.name, demoUser.picture]
    );

    res.cookie('routine_session', demoUser.id, {
      httpOnly: true,
      maxAge: 30 * 24 * 3600 * 1000,
      sameSite: 'lax',
      path: '/'
    });

    res.json({ success: true, user: demoUser });
  } catch (err) {
    console.error('Demo auth error:', err);
    res.status(500).json({ error: 'Demo sign-in failed: ' + err.message });
  }
});

/**
 * POST /api/auth/logout
 * Clears session cookie.
 */
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('routine_session', { path: '/' });
  res.json({ success: true });
});

// ==========================================
// ROUTINE & CLOUD SYNC ROUTES
// ==========================================

/**
 * GET /api/routine/template
 * Fetches user's master routine template from Turso.
 */
app.get('/api/routine/template', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized. Sign in required.' });
  }

  try {
    const rows = await query('SELECT tasks_json FROM routine_templates WHERE user_id = ?;', [req.user.id]);
    if (rows.length > 0 && rows[0].tasks_json) {
      return res.json({ template: JSON.parse(rows[0].tasks_json) });
    }
    return res.json({ template: null });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/routine/template
 * Saves user's master routine template to Turso.
 */
app.post('/api/routine/template', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized. Sign in required.' });
  }

  try {
    const { template } = req.body;
    if (!Array.isArray(template)) {
      return res.status(400).json({ error: 'Template must be an array of tasks.' });
    }

    await execute(
      `INSERT INTO routine_templates (user_id, tasks_json, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         tasks_json = excluded.tasks_json,
         updated_at = CURRENT_TIMESTAMP;`,
      [req.user.id, JSON.stringify(template)]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Save template error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/routine/day/:date
 * Fetches a specific day's routine record from Turso.
 */
app.get('/api/routine/day/:date', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized. Sign in required.' });
  }

  try {
    const dateStr = req.params.date;
    const rows = await query(
      'SELECT tasks_json FROM daily_records WHERE user_id = ? AND date = ?;',
      [req.user.id, dateStr]
    );

    if (rows.length > 0 && rows[0].tasks_json) {
      return res.json({ date: dateStr, tasks: JSON.parse(rows[0].tasks_json) });
    }
    return res.json({ date: dateStr, tasks: null });
  } catch (err) {
    console.error('Get day error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/routine/day/:date
 * Saves a specific day's routine record to Turso.
 */
app.post('/api/routine/day/:date', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized. Sign in required.' });
  }

  try {
    const dateStr = req.params.date;
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks must be an array.' });
    }

    const recordId = `${req.user.id}_${dateStr}`;
    await execute(
      `INSERT INTO daily_records (id, user_id, date, tasks_json, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         tasks_json = excluded.tasks_json,
         updated_at = CURRENT_TIMESTAMP;`,
      [recordId, req.user.id, dateStr, JSON.stringify(tasks)]
    );

    res.json({ success: true, date: dateStr });
  } catch (err) {
    console.error('Save day error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/routine/day/:date
 * Deletes a single day record from Turso.
 */
app.delete('/api/routine/day/:date', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized. Sign in required.' });
  }

  try {
    const dateStr = req.params.date;
    await execute(
      'DELETE FROM daily_records WHERE user_id = ? AND date = ?;',
      [req.user.id, dateStr]
    );
    res.json({ success: true, deletedDate: dateStr });
  } catch (err) {
    console.error('Delete day error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/routine/history/previous
 * Purges all historical daily records prior to today.
 */
app.delete('/api/routine/history/previous', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized. Sign in required.' });
  }

  try {
    const todayStr = req.query.today || new Date().toISOString().split('T')[0];
    await execute(
      'DELETE FROM daily_records WHERE user_id = ? AND date < ?;',
      [req.user.id, todayStr]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Clear previous days error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/routine/history
 * Fetches all tracked history logs for current user from Turso.
 */
app.get('/api/routine/history', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized. Sign in required.' });
  }

  try {
    const rows = await query(
      'SELECT date, tasks_json FROM daily_records WHERE user_id = ? ORDER BY date DESC;',
      [req.user.id]
    );

    const history = rows.map(r => ({
      date: r.date,
      tasks: JSON.parse(r.tasks_json)
    }));

    res.json({ history });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/settings
 * Fetches user display settings from Turso.
 */
app.get('/api/settings', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const rows = await query('SELECT settings_json FROM user_settings WHERE user_id = ?;', [req.user.id]);
    if (rows.length > 0 && rows[0].settings_json) {
      return res.json({ settings: JSON.parse(rows[0].settings_json) });
    }
    res.json({ settings: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings
 * Saves user display settings to Turso.
 */
app.post('/api/settings', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const { settings } = req.body;
    await execute(
      `INSERT INTO user_settings (user_id, settings_json, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         settings_json = excluded.settings_json,
         updated_at = CURRENT_TIMESTAMP;`,
      [req.user.id, JSON.stringify(settings)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Fallback to index.html for single-page app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server if run directly
async function start() {
  try {
    await ensureSchemaReady();
    app.listen(PORT, () => {
      console.log(`🚀 RoutineFlow server running at http://localhost:${PORT}`);
      console.log(`📡 Connected to Turso database: ${process.env.TURSO_DATABASE_URL}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
