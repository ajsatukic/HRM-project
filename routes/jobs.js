const express = require('express');
const router = express.Router();
const pool = require('../config/db');

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
    res.status(500).send('Error fetching jobs');
  }
});

// Ruta za prikaz forme za kreiranje konkursa
router.get('/create', (req, res) => {
  res.render('create-job');
});

// Ruta za dodavanje novog konkursa
router.post('/', async (req, res) => {
  try {
    const { title, description, requirements, deadline, created_by } = req.body;
    await pool.query(
      'INSERT INTO jobs (title, description, requirements, deadline, created_by, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [title, description, requirements, deadline, created_by, 'active']
    );
    res.redirect('/jobs');
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).send('Error creating job');
  }
});

// Ruta za ažuriranje statusa konkursa
router.post('/update-status', async (req, res) => {
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
    res.status(500).send('Error updating statuses');
  }
});

// Ruta za filtriranje konkursa po statusu
router.get('/filter', async (req, res) => {
    const { status } = req.query;
  
    try {
      const result = await pool.query(
        'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC',
        [status]
      );
      res.render('jobs', { jobs: result.rows });
    } catch (err) {
      console.error('Error filtering jobs:', err);
      res.status(500).send('Error filtering jobs');
    }
  });
  
  // Ruta za prikaz detalja konkursa
  router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
  
    if (isNaN(id)) {
      console.log('Invalid ID:', req.params.id);
      return res.status(400).send('Invalid job ID');
    }
  
    try {
      const result = await pool.query('SELECT * FROM jobs WHERE job_id = $1', [id]);
      const job = result.rows[0];
  
      if (!job) {
        return res.status(404).send('Job not found');
      }
  
      res.render('job-details', { job });
    } catch (err) {
      console.error('Error fetching job details:', err);
      res.status(500).send('Error fetching job details');
    }
  });
  

// Ruta za prikaz detalja konkursa
router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10); // Pokušaj konvertovati ID u broj
  
    if (isNaN(id)) {
      console.log('Invalid ID:', req.params.id); // Debug: prikaz originalne vrijednosti
      return res.status(400).send('Invalid job ID'); // Vraćanje greške klijentu
    }
  
    try {
      const result = await pool.query('SELECT * FROM jobs WHERE job_id = $1', [id]);
      const job = result.rows[0];
  
      if (!job) {
        return res.status(404).send('Job not found');
      }
  
      res.render('job-details', { job });
    } catch (err) {
      console.error('Error fetching job details:', err);
      res.status(500).send('Error fetching job details');
    }
  });
    
  
// Ruta za filtriranje konkursa po statusu
router.get('/filter', async (req, res) => {
    const { status } = req.query;
  
    try {
      const result = await pool.query(
        'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC',
        [status]
      );
      res.render('jobs', { jobs: result.rows });
    } catch (err) {
      console.error('Error filtering jobs:', err);
      res.status(500).send('Error filtering jobs');
    }
  });

  router.get('/active', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC', ['active']);
      res.render('active-jobs', { jobs: result.rows });
    } catch (err) {
      console.error('Error fetching active jobs:', err);
      res.status(500).send('Error fetching active jobs');
    }
  });

// Ruta za prijavu na konkurs (forma)
router.get('/:id/apply', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM jobs WHERE job_id = $1', [id]);
    const job = result.rows[0];

    if (!job) {
      return res.status(404).send('Job not found');
    }

    res.render('apply-job', { job });
  } catch (err) {
    console.error('Error fetching job details for application:', err);
    res.status(500).send('Error fetching job details for application');
  }
});

// Ruta za prijavu kandidata na konkurs
router.post('/:id/apply', async (req, res) => {
  const { id } = req.params; // ID konkursa (job_id)
  const { candidate_id } = req.body; // ID kandidata iz forme

  try {
    // Debugging podataka
    console.log('Job ID:', id); 
    console.log('Candidate ID:', candidate_id);

    // Provjeri da li su ID-evi validni
    if (!id || !candidate_id) {
      return res.status(400).send('Job ID or Candidate ID is missing.');
    }

    await pool.query(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES ($1, $2, $3)',
      [id, candidate_id, 'pending'] // Početni status
    );

    res.send('Application submitted successfully!');
  } catch (err) {
    console.error('Error submitting application:', err); // Prikaz stvarne greške
    res.status(500).send('Error submitting application');
  }
});


// Ruta za prikaz svih prijava na konkurs
router.get('/:id/applications', async (req, res) => {
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
    res.status(500).send('Error fetching applications');
  }
});

  
module.exports = router;
