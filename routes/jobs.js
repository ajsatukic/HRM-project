const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');

// Ruta za prikaz svih poslova
router.get('/', ensureLoggedIn, async (req, res) => {
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

  // Validacija datuma pomoću ugrađenog `Date` objekta
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

//ruta za filtriranje
router.get('/filter', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { status } = req.query;

  if (!['active', 'expired'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status filter' });
  }

  try {
    const result = await pool.query(
      `SELECT 
        job_id, title, description, requirements, deadline, created_by, created_at,
        CASE 
          WHEN deadline >= CURRENT_DATE THEN 'active'
          ELSE 'expired'
        END AS status
      FROM jobs
      WHERE CASE 
        WHEN deadline >= CURRENT_DATE THEN 'active'
        ELSE 'expired'
      END = $1
      ORDER BY created_at DESC`,
      [status]
    );

    res.json({ success: true, jobs: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error filtering jobs' });
  }
});

// Ruta za pretragu poslova
router.get('/search', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === '') {
    console.error('Search query is missing or empty');
    return res.status(400).json({ success: false, message: 'Search query is required' });
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
      WHERE title ILIKE $1 OR description ILIKE $1
      ORDER BY created_at DESC
      `,
      [`%${query}%`]
    );

    res.json({ success: true, jobs: result.rows });
  } catch (err) {
    console.error('Error searching jobs:', err);
    res.status(500).json({ success: false, message: 'Error searching jobs' });
  }
});

// Ruta za prikaz korisničkih prijava na posao
router.get('/my-applications', ensureLoggedIn, async (req, res) => {
  const userId = req.session.user.id;

  try {
    // Dohvati ID kandidata na osnovu korisnika
    const candidateResult = await pool.query('SELECT candidate_id FROM candidates WHERE user_id = $1', [userId]);

    if (candidateResult.rows.length === 0) {
      console.error('No candidate ID found for this user.');
      return res.status(404).send('You are not registered as a candidate.');
    }

    const candidateId = candidateResult.rows[0].candidate_id;

    // Dohvati sve prijave za trenutnog kandidata
    const applicationsResult = await pool.query(
      `SELECT 
          a.application_id,
          a.status,
          a.applied_at,
          j.title AS job_title,
          j.description AS job_description,
          j.deadline
       FROM applications a
       JOIN jobs j ON a.job_id = j.job_id
       WHERE a.candidate_id = $1
       ORDER BY a.applied_at DESC`,
      [candidateId]
    );

    // Provjera postoji li prijava
    if (applicationsResult.rows.length === 0) {
      return res.render('applications', {
        user: req.session.user,
        applications: [],
        message: 'You have not applied for any jobs yet.',
      });
    }

    // Render stranice sa prijavama
    res.render('applications', {
      user: req.session.user,
      applications: applicationsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching job applications:', err);
    res.status(500).send('Error fetching job applications.');
  }
});


//ruta details za posao
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

//ruta za dohvacanje svih prijava
router.get('/applications/all', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.first_name, 
        u.last_name, 
        u.email, 
        c.skills, 
        c.experience, 
        c.education, 
        j.title AS job_title 
      FROM applications a
      JOIN candidates c ON a.candidate_id = c.candidate_id
      JOIN users u ON c.user_id = u.user_id
      JOIN jobs j ON a.job_id = j.job_id
      ORDER BY u.last_name ASC
    `);

    res.render('all-applications', { candidates: result.rows });
  } catch (err) {
    console.error('Error fetching all applications:', err);
    res.status(500).render('error', { message: 'Error fetching all applications', error: err });
  }
});

// Ruta za prijavu na posao
router.post('/:id/apply', ensureLoggedIn, async (req, res) => {
  const userId = req.session.user.id; // Dohvati ID korisnika iz sesije
  const jobId = req.params.id; // Dohvati ID posla iz URL-a

  try {
      // Provjeri da li postoji kandidat povezan s ovim korisnikom
      const candidateResult = await pool.query('SELECT candidate_id FROM candidates WHERE user_id = $1', [userId]);

      if (candidateResult.rows.length === 0) {
          console.error('Candidate not found for user ID:', userId);
          return res.status(404).send('Candidate profile not found');
      }

      const candidateId = candidateResult.rows[0].candidate_id;

      console.log('Candidate ID:', candidateId, 'Job ID:', jobId);

      // Unesi prijavu u tabelu `applications`
      await pool.query(
          `INSERT INTO applications (job_id, candidate_id, status, applied_at)
           VALUES ($1, $2, $3, NOW())`,
          [jobId, candidateId, 'applied'] // Status postavi na 'applied'
      );

      console.log('Application submitted successfully!');
      res.redirect('/applications'); // Preusmjeri na stranicu sa prijavama
  } catch (err) {
      console.error('Error applying for job:', err);
      res.status(500).send('Error applying for job');
  }
});



// Ruta za prikaz svih prijava korisnika
router.get('/', ensureLoggedIn, async (req, res) => {
  const userId = req.session.user.id;

  try {
      // Dohvati candidate_id za trenutnog korisnika
      const candidateResult = await pool.query('SELECT candidate_id FROM candidates WHERE user_id = $1', [userId]);

      if (candidateResult.rows.length === 0) {
          console.error('Candidate not found for user ID:', userId);
          return res.status(404).send('No applications found for this user');
      }

      const candidateId = candidateResult.rows[0].candidate_id;

      // Dohvati sve prijave za ovog kandidata
      const applicationsResult = await pool.query(
          `SELECT a.application_id, a.status, a.applied_at, j.title AS job_title, j.description AS job_description
           FROM applications a
           INNER JOIN jobs j ON a.job_id = j.job_id
           WHERE a.candidate_id = $1
           ORDER BY a.applied_at DESC`,
          [candidateId]
      );

      const applications = applicationsResult.rows;

      res.render('applications', { applications }); // Render stranice za prikaz prijava
  } catch (err) {
      console.error('Error fetching applications:', err);
      res.status(500).send('Error fetching applications');
  }
});

module.exports = router;
