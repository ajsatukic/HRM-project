const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const router = express.Router();

// Prikaz login forme
router.get('/login', (req, res) => {
  res.render('login');
});

// Prijava korisnika
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user && (await bcrypt.compare(password, user.password))) {
      req.session.user = { id: user.user_id, role: user.role, name: `${user.first_name} ${user.last_name}` };

      if (user.role === 'admin') {
        res.redirect('/admin-dashboard');
      } else {
        res.redirect('/user-dashboard');
      }
    } else {
      res.status(401).send('Invalid email or password');
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).send('Error during login');
  }
});

// Odjava korisnika
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

// Registracija korisnika
router.post('/register', async (req, res) => {
  const { first_name, last_name, email, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (first_name, last_name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
      [first_name, last_name, email, hashedPassword, role]
    );
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).send('Error during registration');
  }
});

router.get('/sync-candidates', async (req, res) => {
  try {
      // Dodavanje korisnika koji nisu admini u tabelu `candidates`
      await pool.query(`
          INSERT INTO candidates (user_id, phone, address, skills, experience, education)
          SELECT 
              user_id,
              NULL AS phone,
              NULL AS address,
              NULL AS skills,
              NULL AS experience,
              NULL AS education
          FROM users
          WHERE role != 'admin'
            AND user_id NOT IN (SELECT user_id FROM candidates)
      `);

      res.send('All non-admin users successfully synchronized with candidates!');
  } catch (err) {
      console.error('Error synchronizing candidates:', err);
      res.status(500).send('Error synchronizing candidates');
  }
});


module.exports = router;
