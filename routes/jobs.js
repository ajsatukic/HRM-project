const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');

// Ruta za prikaz svih poslova
router.get('/', ensureLoggedIn, ensureAdmin, async (req, res) => {
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

// Ruta za prikaz forme za kreiranje posla
router.get('/create', ensureLoggedIn, ensureAdmin, (req, res) => {
  res.render('create-job');
});

// Ruta za dodavanje novog posla
router.post('/create', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { title, description, deadline } = req.body;
  const requirements = Array.isArray(req.body.required_documents)
    ? req.body.required_documents.join(', ')
    : req.body.required_documents || '';

  console.log('Received data:', { title, description, requirements, deadline });

  if (!title || !description || !deadline || !requirements) {
    console.error('Validation Error: Missing required fields');
    return res.redirect('/admin-dashboard?error=Missing+required+fields');
  }

  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime()) || deadlineDate < new Date()) {
    console.error('Validation Error: Invalid deadline format or past date', { deadline });
    return res.redirect('/admin-dashboard?error=Invalid+deadline+format+or+past+date');
  }

  if (!req.session || !req.session.user || !req.session.user.id) {
    console.error('Session Error: User not logged in', req.session);
    return res.redirect('/admin-dashboard?error=You+must+be+logged+in');
  }

  try {
    console.log('Executing SQL query...');
    const result = await pool.query(
      `
      INSERT INTO jobs (title, description, requirements, deadline, created_by, status) 
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [title, description, requirements, deadline, req.session.user.id, 'active']
    );
    console.log('Job successfully added to database:', result.rowCount);
    res.redirect('/admin-dashboard?success=Job+created+successfully');
  } catch (err) {
    console.error('Error creating job:', err);
    res.redirect('/admin-dashboard?error=Error+creating+job');
  }
});

// Ruta za brisanje posla
router.delete('/:id', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  console.log('Delete Request for Job ID:', id);

  if (isNaN(id)) {
    console.error('Invalid job ID');
    return res.status(400).json({ success: false, message: 'Invalid job ID' });
  }

  try {
    const result = await pool.query('DELETE FROM jobs WHERE job_id = $1', [id]);
    console.log('Job Deleted:', result.rowCount);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).json({ success: false, message: 'An error occurred while deleting the job.' });
  }
});

// Ruta za ažuriranje statusa poslova
router.post('/update-status', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    await pool.query(`
      UPDATE jobs
      SET status = CASE
        WHEN deadline >= CURRENT_DATE THEN 'active'
        ELSE 'expired'
      END
    `);
    res.redirect('/admin-dashboard?success=Statuses+updated');
  } catch (err) {
    console.error('Error updating statuses:', err);
    res.status(500).render('error', { message: 'Error updating statuses', error: err });
  }
});

// Ruta za filtriranje poslova po statusu
router.get('/filter', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { status } = req.query;

  if (!['active', 'expired'].includes(status)) {
    console.error('Invalid filter status:', status);
    return res.status(400).json({ success: false, message: 'Invalid status filter' });
  }

  try {
    const result = await pool.query(
      `
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
      WHERE CASE 
        WHEN deadline >= CURRENT_DATE THEN 'active'
        ELSE 'expired'
      END = $1
      ORDER BY created_at DESC
      `,
      [status]
    );

    res.json({ success: true, jobs: result.rows });
  } catch (err) {
    console.error('Error filtering jobs:', err);
    res.status(500).json({ success: false, message: 'Error filtering jobs' });
  }
});

//ruta details
router.get('/:id', ensureLoggedIn, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    console.error('Invalid job ID');
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

/// Ruta za pregled prijava na posao
router.get('/:job_id/applications', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const jobId = parseInt(req.params.job_id, 10);

  if (isNaN(jobId)) {
    console.error('Invalid job ID');
    return res.status(400).render('error', { message: 'Invalid job ID', error: { status: 400 } });
  }

  try {
    const result = await pool.query(`
      SELECT 
        a.application_id,
        a.status,
        a.applied_at,
        c.candidate_id,
        u.first_name,
        u.last_name,
        u.email,
        c.cv,
        c.skills,
        c.experience,
        c.education
      FROM applications a
      JOIN candidates c ON a.candidate_id = c.candidate_id
      JOIN users u ON c.user_id = u.user_id
      WHERE a.job_id = $1
    `, [jobId]);

    res.render('job-applications', { applications: result.rows, jobId });
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).render('error', { message: 'Error fetching applications', error: err });
  }
});

// Ruta za ocjenjivanje kandidata
router.post('/applications/:application_id/rate', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const applicationId = parseInt(req.params.application_id, 10);
  const { rating } = req.body;

  if (isNaN(applicationId) || isNaN(rating) || rating < 0 || rating > 100) {
    console.error('Invalid application ID or rating');
    return res.status(400).send('Invalid application ID or rating');
  }

  try {
    await pool.query(`
      UPDATE applications
      SET rating = $1
      WHERE application_id = $2
    `, [rating, applicationId]);

    res.redirect('back');
  } catch (err) {
    console.error('Error rating candidate:', err);
    res.status(500).send('Error rating candidate');
  }
});

// Ruta za prikaz rang-liste kandidata
router.get('/:job_id/rankings', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const jobId = parseInt(req.params.job_id, 10);

  if (isNaN(jobId)) {
    console.error('Invalid job ID');
    return res.status(400).render('error', { message: 'Invalid job ID', error: { status: 400 } });
  }

  try {
    const result = await pool.query(`
      SELECT 
        u.first_name,
        u.last_name,
        u.email,
        c.skills,
        c.experience,
        c.education,
        a.rating
      FROM applications a
      JOIN candidates c ON a.candidate_id = c.candidate_id
      JOIN users u ON c.user_id = u.user_id
      WHERE a.job_id = $1
      ORDER BY a.rating DESC NULLS LAST
    `, [jobId]);

    if (result.rows.length === 0) {
      return res.render('job-rankings', { rankings: [], jobId });
    }

    res.render('job-rankings', { rankings: result.rows, jobId });
  } catch (err) {
    console.error('Error fetching rankings:', err);
    res.status(500).render('error', { message: 'Error fetching rankings', error: err });
  }
});

//ruta za detalje kandidata koemantara i unos
router.get('/candidates/:candidate_id', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const candidateId = parseInt(req.params.candidate_id, 10);

  if (isNaN(candidateId)) {
    console.error('Invalid candidate ID');
    return res.status(400).render('error', { message: 'Invalid candidate ID', error: { status: 400 } });
  }

  try {
    // Dohvat detalja kandidata
    const candidateResult = await pool.query(`
      SELECT 
        u.first_name,
        u.last_name,
        c.job_id, 
        u.email,
        c.candidate_id,
        c.cv,
        c.skills,
        c.experience,
        c.education
      FROM candidates c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.candidate_id = $1
    `, [candidateId]);

    if (candidateResult.rows.length === 0) {
      return res.status(404).render('error', { message: 'Candidate not found', error: { status: 404 } });
    }

    // Dohvat komentara vezanih za kandidata
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

    res.render('candidate-details', {
      candidate: candidateResult.rows[0],
      comments: commentsResult.rows
    });
  } catch (err) {
    console.error('Error fetching candidate details or comments:', err);
    res.status(500).render('error', { message: 'Error fetching candidate details or comments', error: err });
  }
});


// Ruta za unos komentara
router.post('/candidates/:candidate_id/comments', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const candidateId = parseInt(req.params.candidate_id, 10);
  const { comment } = req.body;

  if (isNaN(candidateId) || !comment) {
    console.error('Invalid candidate ID or missing comment');
    return res.status(400).send('Invalid candidate ID or missing comment');
  }

  try {
    await pool.query(`
      INSERT INTO comments (candidate_id, created_by, comment, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [candidateId, req.session.user.id, comment]);

    res.redirect(`/jobs/candidates/${candidateId}`);
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).send('Error adding comment');
  }
});


//ruta za promjenu statusa
router.post('/applications/:application_id/status', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const applicationId = parseInt(req.params.application_id, 10);
  const { status } = req.body;

  if (isNaN(applicationId) || !['Registered', 'Invited for an interview', 'Shortlisted', 'Rejected'].includes(status)) {
    console.error('Invalid application ID or status');
    return res.status(400).send('Invalid application ID or status');
  }

  try {
    await pool.query(`
      UPDATE applications
      SET status = $1
      WHERE application_id = $2
    `, [status, applicationId]);

    console.log('Application status updated:', { applicationId, status });
    res.redirect('back');
  } catch (err) {
    console.error('Error updating application status:', err);
    res.status(500).send('Error updating application status');
  }
});

module.exports = router;
