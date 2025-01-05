const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureLoggedIn, ensureAdmin } = require('../middleware/auth');

// Simulirane notifikacije
const mockNotifications = [
    { id: 1, message: 'New application received.', date: new Date('2025-01-05').toISOString().split('T')[0] },
    { id: 2, message: 'Interview scheduled for Candidate 4.', date: new Date('2025-01-06').toISOString().split('T')[0] },
  ];
    
  // Ruta za prikaz notifikacija
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          notification_id, 
          message, 
          created_by, 
          TO_CHAR(created_at, 'YYYY-MM-DD') AS formatted_date 
        FROM notifications
        ORDER BY created_at DESC
      `);
  
      res.render('notifications', { notifications: result.rows });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      res.status(500).send('Error fetching notifications');
    }
  });
  
  

module.exports = router;
