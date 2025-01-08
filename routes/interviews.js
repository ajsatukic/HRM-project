const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');

// Ruta za dohvaćanje svih intervjua (JSON za kalendar)
router.get('/api', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM interviews');
    const events = result.rows.map(row => ({
      id: row.interview_id,
      title: `Interview with Candidate ${row.candidate_id}`,
      start: new Date(row.scheduled_at).toISOString(),
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

// Ruta za prikaz stranice s kalendarom
router.get('/calendar', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    res.render('interviews-calendar');
  } catch (err) {
    console.error('Error loading calendar page:', err);
    res.status(500).render('error', { message: 'Error loading calendar page', error: err });
  }
});


// Ažuriranje intervjua
router.put('/:id', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const interviewId = parseInt(req.params.id, 10);
  const { scheduled_at, location, notes } = req.body;

  if (!scheduled_at || !location) {
    console.error('Missing fields for interview update');
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      'UPDATE interviews SET scheduled_at = $1, location = $2, notes = $3 WHERE interview_id = $4',
      [scheduled_at, location, notes || null, interviewId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    res.json({ success: true, message: 'Interview updated successfully' });
  } catch (err) {
    console.error('Error updating interview:', err);
    res.status(500).json({ success: false, message: 'Error updating interview' });
  }
});

// Brisanje intervjua
router.delete('/:id', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const interviewId = parseInt(req.params.id, 10);

  if (isNaN(interviewId)) {
    console.error('Invalid interview ID');
    return res.status(400).json({ success: false, message: 'Invalid interview ID' });
  }

  try {
    const result = await pool.query('DELETE FROM interviews WHERE interview_id = $1', [interviewId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    res.json({ success: true, message: 'Interview deleted successfully' });
  } catch (err) {
    console.error('Error deleting interview:', err);
    res.status(500).json({ success: false, message: 'Error deleting interview' });
  }
});

module.exports = router;
