const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Ruta za dohvaćanje podataka za dashboard
router.get('/stats', async (req, res) => {
  try {
    const jobStats = await pool.query(`
      SELECT j.title, COUNT(a.application_id) AS application_count
      FROM jobs j
      LEFT JOIN applications a ON j.job_id = a.job_id
      GROUP BY j.title
    `);

    const candidateStats = await pool.query(`
      SELECT a.status, COUNT(*) AS count
      FROM applications a
      GROUP BY a.status
    `);

    const avgRatings = await pool.query(`
      SELECT j.title, AVG(a.rating) AS avg_rating
      FROM jobs j
      LEFT JOIN applications a ON j.job_id = a.job_id
      WHERE a.rating IS NOT NULL
      GROUP BY j.title
    `);

    console.log('Job Stats:', jobStats.rows);
    console.log('Candidate Stats:', candidateStats.rows);
    console.log('Average Ratings:', avgRatings.rows);

    res.json({
      success: true,
      data: {
        jobStats: jobStats.rows,
        candidateStats: candidateStats.rows,
        avgRatings: avgRatings.rows,
      },
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ success: false, message: 'Error fetching dashboard stats' });
  }
});

module.exports = router;
