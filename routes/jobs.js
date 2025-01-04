const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');

// Ruta za prikaz svih konkursa
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        job_id, 
        title, 
        description, 
        requirements, 
        deadline, 
        created_by, 
        created_at,
        CASE 
          WHEN deadline >= CURRENT_DATE THEN 'active'
          ELSE 'expired'
        END AS status
      FROM jobs
      ORDER BY created_at DESC
    `);
    res.render('jobs', { jobs: result.rows });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).render('error', { message: 'Error fetching jobs', error: err });
  }
});

// Ruta za prikaz forme za kreiranje konkursa
router.get('/create', ensureLoggedIn, ensureAdmin, (req, res) => {
  res.render('create-job');
});

// Ruta za dodavanje novog konkursa
router.post('/create', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { title, description, requirements, deadline, created_by } = req.body;

  try {
    await pool.query(
      'INSERT INTO jobs (title, description, requirements, deadline, created_by, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [title, description, requirements, deadline, created_by, 'active']
    );
    res.redirect('/jobs');
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).render('error', { message: 'Error creating job', error: err });
  }
});

// Ruta za ažuriranje statusa konkursa
router.post('/update-status', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    await pool.query(`
      UPDATE jobs
      SET status = CASE
        WHEN deadline >= CURRENT_DATE THEN 'active'
        ELSE 'expired'
      END
    `);
    res.redirect('/jobs');
  } catch (err) {
    console.error('Error updating statuses:', err);
    res.status(500).render('error', { message: 'Error updating statuses', error: err });
  }
});

// Ruta za prikaz detalja konkursa
router.get('/:id', ensureLoggedIn, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).render('error', { message: 'Invalid job ID', error: { status: 400 } });
  }

  try {
    const result = await pool.query('SELECT * FROM jobs WHERE job_id = $1', [id]);
    const job = result.rows[0];

    if (!job) {
      return res.status(404).render('error', { message: 'Job not found', error: { status: 404 } });
    }

    res.render('job-details', { job });
  } catch (err) {
    console.error('Error fetching job details:', err);
    res.status(500).render('error', { message: 'Error fetching job details', error: err });
  }
});

// Ruta za prijavu na konkurs (forma)
router.get('/:id/apply', ensureLoggedIn, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM jobs WHERE job_id = $1', [id]);
    const job = result.rows[0];

    if (!job) {
      return res.status(404).render('error', { message: 'Job not found', error: { status: 404 } });
    }

    res.render('apply-job', { job });
  } catch (err) {
    console.error('Error fetching job details for application:', err);
    res.status(500).render('error', { message: 'Error fetching job details for application', error: err });
  }
});

// Ruta za prijavu kandidata na konkurs
router.post('/:id/apply', ensureLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { candidate_id } = req.body;

  try {
    if (!id || !candidate_id) {
      return res.status(400).render('error', { message: 'Job ID or Candidate ID is missing.', error: { status: 400 } });
    }

    await pool.query(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES ($1, $2, $3)',
      [id, candidate_id, 'pending']
    );

    res.send('Application submitted successfully!');
  } catch (err) {
    console.error('Error submitting application:', err);
    res.status(500).render('error', { message: 'Error submitting application', error: err });
  }
});

// Ruta za prikaz svih prijava na konkurs
router.get('/:id/applications', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT a.application_id, a.status, a.applied_at, c.cv, c.skills, c.experience, c.education 
      FROM applications a
      JOIN candidates c ON a.candidate_id = c.candidate_id
      WHERE a.job_id = $1
    `, [id]);

    res.render('job-applications', { applications: result.rows });
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).render('error', { message: 'Error fetching applications', error: err });
  }
});

// Ruta za pretragu konkursa
router.get('/search', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === '') {
    return res.status(400).render('error', { message: 'Search query cannot be empty.', error: { status: 400 } });
  }

  try {
    const result = await pool.query(`
      SELECT 
        job_id, 
        title, 
        description, 
        requirements, 
        deadline, 
        created_by, 
        created_at,
        CASE 
          WHEN deadline >= CURRENT_DATE THEN 'active'
          ELSE 'expired'
        END AS status
      FROM jobs
      WHERE title ILIKE $1 OR description ILIKE $1
      ORDER BY created_at DESC
    `, [`%${query}%`]);

    if (result.rows.length === 0) {
      return res.status(404).render('error', { message: 'No jobs found for the given search query.', error: { status: 404 } });
    }

    res.render('jobs', { jobs: result.rows });
  } catch (err) {
    console.error('Error searching jobs:', err);
    res.status(500).render('error', { message: 'Error searching jobs.', error: err });
  }
});


// Ruta za prikaz arhiviranih konkursa
router.get('/archived', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        job_id, 
        title, 
        description, 
        requirements, 
        deadline, 
        created_by, 
        created_at,
        'expired' AS status
      FROM jobs
      WHERE deadline < CURRENT_DATE
      ORDER BY created_at DESC
    `);

    res.render('archived-jobs', { jobs: result.rows });
  } catch (err) {
    console.error('Error fetching archived jobs:', err);
    res.status(500).render('error', { message: 'Error fetching archived jobs', error: err });
  }
});

module.exports = router;
