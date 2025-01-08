const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Povezivanje s bazom
const { ensureLoggedIn } = require('../middleware/auth'); // Middleware za provjeru prijave

// Ruta za dohvaćanje notifikacija i intervjua specifičnih za korisnika
router.get('/', ensureLoggedIn, async (req, res) => {
  const userId = req.session.user.id;

  try {
    // Dohvat notifikacija za korisnika
    const notificationsResult = await pool.query(
      `SELECT message, created_at 
       FROM notifications 
       WHERE created_by = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    // Formatiranje notifikacija
    const formattedNotifications = notificationsResult.rows.map(notification => {
      return {
        message: notification.message,
        created_at: new Date(notification.created_at).toLocaleString() // Lokalizovani format datuma i vremena
      };
    });

    // Dohvat zakazanih intervjua za korisnika
    const interviewsResult = await pool.query(
      `SELECT 
         i.job_id, 
         j.title AS job_title, 
         i.scheduled_at, 
         i.location, 
         i.status 
       FROM interviews i
       JOIN jobs j ON i.job_id = j.job_id
       WHERE i.candidate_id = (
         SELECT candidate_id FROM candidates WHERE user_id = $1
       )
       ORDER BY i.scheduled_at ASC`,
      [userId]
    );

    // Formatiranje intervjua
    const formattedInterviews = interviewsResult.rows.map(interview => {
      return {
        job_id: interview.job_id,
        job_title: interview.job_title,
        scheduled_at: new Date(interview.scheduled_at).toLocaleString(),
        location: interview.location,
        status: interview.status
      };
    });

    // Renderovanje šablona sa notifikacijama i intervjuima
    res.render('notifications', { 
      notifications: formattedNotifications, 
      interviews: formattedInterviews 
    });
  } catch (err) {
    console.error('Error fetching notifications or interviews:', err);
    res.status(500).send('Error fetching notifications or interviews');
  }
});


module.exports = router;
