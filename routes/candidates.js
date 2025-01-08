const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Database connection
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');

// Route: Get all candidates
router.get('/', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT user_id AS id, CONCAT(first_name, ' ', last_name) AS name, email 
      FROM users 
      WHERE role = $1
    `, ['user']);
    const candidates = result.rows;

    res.render('candidates', { candidates });
  } catch (err) {
    console.error('Error fetching candidates:', err);
    res.status(500).send('Error fetching candidates');
  }
});

//get details
router.get('/:candidate_id/details', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const candidateId = parseInt(req.params.candidate_id, 10);

  console.log('Candidate ID in Route:', candidateId);

  if (isNaN(candidateId)) {
    console.error('Invalid candidate ID');
    return res.status(400).send('Invalid candidate ID');
  }

  try {
    // Dohvat detalja kandidata iz tabele candidates
    const candidateResult = await pool.query(`
      SELECT 
        c.candidate_id,
        u.user_id, 
        CONCAT(u.first_name, ' ', u.last_name) AS name, 
        u.email, 
        c.cv, 
        c.skills, 
        c.experience, 
        c.education,
        c.job_id
      FROM candidates c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.candidate_id = $1
    `, [candidateId]);

    console.log('Candidate Result:', candidateResult.rows);

    if (candidateResult.rows.length === 0) {
      console.error('Candidate not found');
      return res.status(404).send('Candidate not found');
    }

    // Dohvat komentara
    const commentsResult = await pool.query(`
      SELECT 
        com.comment, 
        com.created_at, 
        CONCAT(u.first_name, ' ', u.last_name) AS created_by
      FROM comments com
      JOIN users u ON com.created_by = u.user_id
      WHERE com.candidate_id = $1
      ORDER BY com.created_at DESC
    `, [candidateId]);

    // Dohvat recenzija
    const reviewsResult = await pool.query(`
      SELECT 
        r.rating, 
        r.comment, 
        r.created_at, 
        CONCAT(u.first_name, ' ', u.last_name) AS created_by
      FROM reviews r
      JOIN users u ON r.created_by = u.user_id
      WHERE r.candidate_id = $1
      ORDER BY r.created_at DESC
    `, [candidateId]);

    const candidate = candidateResult.rows[0];
    const comments = commentsResult.rows;
    const reviews = reviewsResult.rows;

    console.log('Candidate details:', candidate);
    console.log('Reviews:', reviews);

    res.render('candidate-details', {
      candidate,
      comments,
      reviews, // Prosljeđivanje recenzija
      jobId: candidate.job_id, // Prosljeđivanje jobId
      userId: candidate.user_id // Prosljeđivanje user_id
    });
  } catch (err) {
    console.error('Error fetching candidate details, comments, or reviews:', err);
    res.status(500).send('Error fetching candidate details, comments, or reviews');
  }
});

// Route: Delete candidate by ID
router.post('/:user_id/delete', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const userId = parseInt(req.params.user_id, 10);

  if (isNaN(userId)) {
    console.error('Invalid user ID');
    return res.status(400).send('Invalid user ID');
  }

  try {
    // Brisanje zavisnih podataka iz povezane tabele
    await pool.query('DELETE FROM notifications WHERE created_by = $1', [userId]);
    await pool.query('DELETE FROM comments WHERE candidate_id = $1', [userId]);
    await pool.query('DELETE FROM reviews WHERE candidate_id = $1', [userId]);
    await pool.query('DELETE FROM interviews WHERE candidate_id = $1', [userId]);

    // Brisanje korisnika
    await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);

    console.log(`Candidate with ID ${userId} deleted successfully`);
    res.redirect('/candidates'); // Povratak na listu kandidata
  } catch (err) {
    console.error('Error deleting candidate:', err);
    res.status(500).send('Error deleting candidate');
  }
});


// Dodavanje komentara
router.post('/:user_id/comments', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const userId = parseInt(req.params.user_id, 10);
  const { comment } = req.body;

  console.log('User ID:', userId);
  console.log('Comment:', comment);

  if (!userId || !comment) {
    console.error('Validation Error: Missing user ID or comment');
    return res.status(400).send('Missing user ID or comment');
  }

  try {
    const candidateCheck = await pool.query('SELECT candidate_id FROM candidates WHERE user_id = $1', [userId]);
    if (candidateCheck.rows.length === 0) {
      console.error('Candidate not found for user ID:', userId);
      return res.status(404).send('Candidate not found');
    }

    const candidateId = candidateCheck.rows[0].candidate_id;

    await pool.query(`
      INSERT INTO comments (candidate_id, created_by, comment, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [candidateId, req.session.user.id, comment]);

    console.log('Comment added successfully');
    res.redirect(`/candidates/${userId}/details`);
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).send('Error adding comment');
  }
});

//zakazivanje
router.post('/interviews', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { user_id, job_id, scheduled_at, location, notes } = req.body;
  const createdBy = req.session.user.id; // ID korisnika koji zakazuje intervju

  console.log('Received interview data:', { user_id, job_id, scheduled_at, location, notes });

  if (!user_id || !job_id || !scheduled_at || !location) {
    console.error('Validation Error: Missing required fields');
    return res.status(400).send('Missing required fields');
  }

  try {
    await pool.query(`
      INSERT INTO interviews (candidate_id, job_id, scheduled_at, location, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [user_id, job_id, scheduled_at, location, notes, createdBy]);

    console.log('Interview scheduled successfully');
    res.redirect(`/candidates/${user_id}/details`);
  } catch (err) {
    console.error('Error scheduling interview:', err);
    res.status(500).send('Error scheduling interview');
  }
});


// Route: Add review for a candidate
router.post('/:user_id/reviews', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const userId = parseInt(req.params.user_id, 10);
  const { rating, comment } = req.body;

  console.log('Received data:', { userId, rating, comment });

  if (isNaN(userId) || isNaN(rating) || !comment) {
    console.error('Validation Error: Missing required fields');
    return res.status(400).send('Missing required fields');
  }

  try {
    const candidateCheck = await pool.query('SELECT candidate_id FROM candidates WHERE user_id = $1', [userId]);
    if (candidateCheck.rows.length === 0) {
      console.error('Candidate not found for user ID:', userId);
      return res.status(404).send('Candidate not found');
    }

    const candidateId = candidateCheck.rows[0].candidate_id;

    await pool.query(`
      INSERT INTO reviews (candidate_id, created_by, rating, comment, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [candidateId, req.session.user.id, rating, comment]);

    console.log('Review added successfully');
    res.redirect(`/candidates/${userId}/details`);
  } catch (err) {
    console.error('Error adding review:', err);
    res.status(500).send('Error adding review');
  }
});

module.exports = router;
