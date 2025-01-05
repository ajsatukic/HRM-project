const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const pool = require('./config/db'); // Dodaj konekciju prema bazi

const app = express();
const port = 3000;

app.use(express.json()); // Parsira JSON tijelo zahtjeva
app.use(express.urlencoded({ extended: true })); // Parsira URL-encoded podatke iz formi

// Middleware za sesije
app.use(
  session({
    secret: 'your-secret-key', // Promijeni s jačim ključem za sigurnost
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

// Statički folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));

// Middleware za parsiranje tijela zahtjeva
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware za method override
app.use(methodOverride('_method'));

// Postavljanje EJS kao view engine
app.set('view engine', 'ejs');

// Uvoz ruta
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const jobRoutes = require('./routes/jobs');
const interviewsRoutes = require('./routes/interviews'); // Import ruta
const notificationsRouter = require('./routes/notifications');

// Korištenje ruta
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/jobs', jobRoutes);
app.use('/interviews', interviewsRoutes); // Ruta za intervjue
app.use('/notifications',notificationsRouter);

// Glavna ruta
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Middleware funkcije
const { ensureLoggedIn, ensureAdmin } = require('./middleware/auth');

// Admin dashboard
app.get('/admin-dashboard', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    // Uzimanje statistike iz baze
    const activeJobs = await pool.query('SELECT COUNT(*) AS total FROM jobs WHERE status = $1', ['active']);
    const applications = await pool.query('SELECT COUNT(*) AS total FROM applications');
    const jobs = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');

    res.render('admin-dashboard', {
      user: req.session.user,
      stats: {
        activeJobs: activeJobs.rows[0]?.total || 0,
        applications: applications.rows[0]?.total || 0,
      },
      jobs: jobs.rows, // Prosljeđujemo liste poslova
    });
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
    res.status(500).send('Error loading admin dashboard');
  }
});

// Ruta za logout koristeći POST metodu
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).send('An error occurred while logging out.');
    }
    res.redirect('/login'); // Preusmjeravanje na login stranicu
  });
});
app.get('/login', (req, res) => {
  res.render('login'); // Pretpostavljamo da imaš `login.ejs`
});



// User dashboard
app.get('/user-dashboard', ensureLoggedIn, (req, res) => {
  res.render('user-dashboard', { user: req.session.user });
});

// Pokretanje servera
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
