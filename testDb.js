const pool = require('./config/db');

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS trenutak');
    console.log('Povezano na bazu. Trenutno vrijeme:', res.rows[0].trenutak);
  } catch (err) {
    console.error('Greška pri povezivanju sa bazom:', err);
  }
}

testConnection();
