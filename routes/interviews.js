const express = require('express');
const router = express.Router();
const pool = require('../config/db');

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
router.post('/', async (req, res) => {
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

module.exports = router;



// Ažuriranje intervjua
router.put('/:id', async (req, res) => {
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

// Brisanje intervjua
router.delete('/:id', async (req, res) => {
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
