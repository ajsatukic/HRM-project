const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Povezivanje s bazom
const { ensureLoggedIn } = require('../middleware/auth'); // Middleware za provjeru prijave

// Ruta za dohvaćanje notifikacija specifičnih za korisnika
router.get('/', ensureLoggedIn, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const notifications = await pool.query(
      `SELECT message, created_at FROM notifications WHERE created_by = $1 ORDER BY created_at DESC`,
      [userId]
    );

    // Formatiranje datuma na backendu
    const formattedNotifications = notifications.rows.map(notification => {
      return {
        message: notification.message,
        created_at: new Date(notification.created_at).toLocaleString() // Lokalizovani format datuma i vremena
      };
    });

    res.render('notifications', { notifications: formattedNotifications });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).send('Error fetching notifications');
  }
});

module.exports = router;
