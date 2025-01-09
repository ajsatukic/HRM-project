const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const pool = require('./config/db');

const app = express();
const port = 3000;

// Middleware za parsiranje tijela zahtjeva
app.use(express.urlencoded({ extended: true })); // Parsira URL-encoded podatke
app.use(express.json()); // Parsira JSON podatke

// Middleware za sesije
app.use(
  session({
    secret: 'sarajevo',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Statički folder
app.use(express.static(path.join(__dirname, 'public')));

// Middleware za method override
app.use(methodOverride('_method'));

// Postavljanje EJS kao view engine
app.set('view engine', 'ejs');

// Middleware funkcije
const { ensureLoggedIn, ensureAdmin } = require('./middleware/auth');

// Uvoz ruta
const authRoutes = require('./routes/auth');

const jobRoutes = require('./routes/jobs');
const interviewsRoutes = require('./routes/interviews');
const notificationsRouter = require('./routes/notifications');
const profileRouter = require('./routes/profile');
const candidatesRoutes = require('./routes/candidates');
const reportsRouter = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');

// Korištenje ruta
app.use('/auth', authRoutes);
app.use('/jobs', jobRoutes);
app.use('/interviews', interviewsRoutes);
app.use('/notifications', notificationsRouter);
app.use('/profile', profileRouter);
app.use('/candidates', candidatesRoutes);
app.use('/reports', reportsRouter);
app.use('/dashboard', dashboardRoutes);

// Glavna ruta
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Admin dashboard
app.get('/admin-dashboard', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    const activeJobs = await pool.query('SELECT COUNT(*) AS total FROM jobs WHERE status = $1', ['active']);
    const applications = await pool.query('SELECT COUNT(*) AS total FROM applications');
    const jobs = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');

    res.render('admin-dashboard', {
      user: req.session.user,
      stats: {
        activeJobs: activeJobs.rows[0]?.total || 0,
        applications: applications.rows[0]?.total || 0,
      },
      jobs: jobs.rows,
    });
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
    res.status(500).send('Error loading admin dashboard');
  }
});

// User dashboard
app.get('/user-dashboard', ensureLoggedIn, (req, res) => {
  res.render('user-dashboard', { user: req.session.user });
});

// Ruta za logout
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).send('An error occurred while logging out.');
    }
    res.redirect('/auth/login');
  });
});

// Ruta za login
app.get('/login', (req, res) => {
  res.render('login');
});

// Pokretanje servera
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
