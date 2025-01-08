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

//intervju za usera
router.get('/user-interviews', ensureLoggedIn, async (req, res) => {
  const userId = req.session.user.id; // ID korisnika iz sesije

  try {
    const interviewsResult = await pool.query(
      `SELECT 
         i.interview_id,
         i.scheduled_at,
         i.location,
         i.notes,
         i.status,
         j.title AS job_title
       FROM interviews i
       JOIN candidates c ON i.candidate_id = c.candidate_id
       JOIN jobs j ON i.job_id = j.job_id
       WHERE c.user_id = $1
       ORDER BY i.scheduled_at ASC`,
      [userId]
    );

    const interviews = interviewsResult.rows;
    res.render('user-interviews', { interviews });
  } catch (err) {
    console.error('Error fetching interviews:', err);
    res.status(500).send('Error fetching interviews');
  }
});

//azuriranje statusa accepted
router.post('/:job_id/accept', ensureLoggedIn, async (req, res) => {
  const { job_id } = req.params;
  const userId = req.session.user.id;

  try {
    const candidateResult = await pool.query(
      'SELECT candidate_id FROM candidates WHERE user_id = $1',
      [userId]
    );

    if (candidateResult.rows.length === 0) {
      console.error('Candidate not found for user ID:', userId);
      return res.status(404).send('Candidate not found');
    }

    const candidateId = candidateResult.rows[0].candidate_id;

    await pool.query(
      `UPDATE interviews 
       SET status = 'accepted' 
       WHERE job_id = $1 AND candidate_id = $2`,
      [job_id, candidateId]
    );

    console.log('Interview accepted successfully');
    res.redirect('/notifications');
  } catch (err) {
    console.error('Error accepting interview:', err);
    res.status(500).send('Error accepting interview');
  }
});

//azurirannje statusa declined
router.post('/:job_id/decline', ensureLoggedIn, async (req, res) => {
  const { job_id } = req.params;
  const userId = req.session.user.id;

  try {
    const candidateResult = await pool.query(
      'SELECT candidate_id FROM candidates WHERE user_id = $1',
      [userId]
    );

    if (candidateResult.rows.length === 0) {
      console.error('Candidate not found for user ID:', userId);
      return res.status(404).send('Candidate not found');
    }

    const candidateId = candidateResult.rows[0].candidate_id;

    await pool.query(
      `UPDATE interviews 
       SET status = 'rejected' 
       WHERE job_id = $1 AND candidate_id = $2`,
      [job_id, candidateId]
    );

    console.log('Interview declined successfully');
    res.redirect('/notifications');
  } catch (err) {
    console.error('Error declining interview:', err);
    res.status(500).send('Error declining interview');
  }
});



module.exports = router;
