const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Ruta za dohvaćanje svih korisnika
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.render('users', { users: result.rows }); // Prosljeđivanje podataka EJS predlošku
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching users');
  }
});

// Ruta za dodavanje novog korisnika
router.post('/', async (req, res) => {
    const { email, password, role } = req.body;
    console.log('Form Data:', req.body); // Ispis unesenih podataka
    try {
      await pool.query(
        'INSERT INTO users (email, password, role, created_at) VALUES ($1, $2, $3, NOW())',
        [email, password, role]
      );
      res.redirect('/users');
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).send('Error adding user');
    }
  });
  
// Ruta za prikaz forme za uređivanje korisnika
router.get('/:id/edit', async (req, res) => {
    const { id } = req.params;
  
    try {
      const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
      const user = result.rows[0];
  
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      res.render('edit-user', { user });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error fetching user');
    }
  });
  
// Ruta za ažuriranje korisnika
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { email, role } = req.body;

    try {
        await pool.query(
            'UPDATE users SET email = $1, role = $2 WHERE user_id = $3',
            [email, role, id]
        );
        res.redirect('/users'); // Nakon ažuriranja, vraćamo se na listu korisnika
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating user');
    }
});

// Ruta za brisanje korisnika
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM users WHERE user_id = $1', [id]);
    res.redirect('/users'); // Nakon brisanja, vrati se na listu korisnika
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting user');
  }
});

// Ruta za prikaz detalja korisnika
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('user-details', { user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching user details');
  }
});

module.exports = router;
