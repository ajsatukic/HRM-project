const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth'); // Import middleware-a

// Dohvaćanje svih intervjua
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM interviews');
    const events = result.rows.map(row => ({
      id: row.interview_id,
      title: `Interview with Candidate ${row.candidate_id}`,
      start: row.scheduled_at,
      extendedProps: {
        location: row.location,
        notes: row.notes,
      },
    }));

    res.json(events);
  } catch (err) {
    console.error('Error fetching interviews:', err);
    res.status(500).json({ success: false, message: 'Error fetching interviews' });
  }
});

// Dodavanje novog intervjua
router.post('/', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { candidate_id, job_id, scheduled_at, location, notes } = req.body;

  if (!candidate_id || !job_id || !scheduled_at || !location) {
    console.error('Missing required fields:', { candidate_id, job_id, scheduled_at, location });
    return res.redirect('/admin-dashboard?error=Missing+required+fields');
  }

  try {
    await pool.query(
      `INSERT INTO interviews (candidate_id, job_id, scheduled_at, location, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [candidate_id, job_id, scheduled_at, location, notes || null]
    );
    res.redirect('/admin-dashboard?success=Interview+scheduled+successfully');
  } catch (err) {
    console.error('Error scheduling interview:', err);
    res.redirect('/admin-dashboard?error=Error+scheduling+interview');
  }
});

// Ažuriranje intervjua
router.put('/:id', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const interviewId = parseInt(req.params.id, 10);
  const { scheduled_at, location, notes } = req.body;

  try {
    const result = await pool.query(
      'UPDATE interviews SET scheduled_at = $1, location = $2, notes = $3 WHERE interview_id = $4',
      [scheduled_at, location, notes, interviewId]
    );

    res.json({ success: true, message: 'Interview updated successfully' });
  } catch (err) {
    console.error('Error updating interview:', err);
    res.status(500).json({ success: false, message: 'Error updating interview' });
  }
});

// Ruta za dodavanje review-a za kandidata
router.post('/candidates/:candidate_id/reviews', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const candidateId = parseInt(req.params.candidate_id, 10);
  const { rating, comment } = req.body;

  if (isNaN(candidateId) || !rating || !comment) {
    console.error('Missing required fields for review:', { candidateId, rating, comment });
    return res.status(400).send('Missing required fields');
  }

  try {
    await pool.query(`
      INSERT INTO reviews (candidate_id, created_by, rating, comment, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [candidateId, req.session.user.id, rating, comment]);

    res.redirect(`/jobs/candidates/${candidateId}`);
  } catch (err) {
    console.error('Error adding review:', err);
    res.status(500).send('Error adding review');
  }
});

// Ruta za prikaz stranice s kalendarom
router.get('/calendar', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    res.render('interviews-calendar'); // Naziv EJS fajla za kalendar
  } catch (err) {
    console.error('Error loading calendar page:', err);
    res.status(500).render('error', { message: 'Error loading calendar page', error: err });
  }
});

// Ruta za dohvaćanje intervjua (za kalendar)
router.get('/api', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM interviews');
    const events = result.rows.map(row => ({
      id: row.interview_id,
      title: `Interview with Candidate ${row.candidate_id}`,
      start: row.scheduled_at,
      extendedProps: {
        location: row.location,
        notes: row.notes,
      },
    }));
    res.json(events);
  } catch (err) {
    console.error('Error fetching interviews:', err);
    res.status(500).json({ success: false, message: 'Error fetching interviews' });
  }
});

// Ruta za brisanje intervjua
router.delete('/:id', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const interviewId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query('DELETE FROM interviews WHERE interview_id = $1', [interviewId]);
    res.json({ success: true, message: 'Interview deleted successfully' });
  } catch (err) {
    console.error('Error deleting interview:', err);
    res.status(500).json({ success: false, message: 'Error deleting interview' });
  }
});

module.exports = router;
