const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureLoggedIn } = require('../middleware/auth'); // Middleware za provjeru prijave

// Ruta za prikaz forme za uređivanje
router.get('/edit', ensureLoggedIn, async (req, res) => {
    const userId = req.session.user.id;

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        const candidateResult = await pool.query('SELECT * FROM candidates WHERE user_id = $1', [userId]);

        const user = userResult.rows[0];
        const candidate = candidateResult.rows[0];

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Kombinovanje podataka iz obje tabele
        const profileData = {
            ...user,
            phone: candidate?.phone || '',
            address: candidate?.address || '',
            skills: candidate?.skills || '',
            experience: candidate?.experience || '',
            education: candidate?.education || '',
            cv: candidate?.cv || ''
        };

        res.render('profile', { user: profileData });
    } catch (err) {
        console.error('Error fetching user profile for editing:', err);
        res.status(500).send('Error fetching user profile for editing');
    }
});


// Ruta za ažuriranje podataka u tabelama `users` i `candidates`
// Ruta za ažuriranje podataka u tabelama `users` i `candidates`
router.post('/update', ensureLoggedIn, async (req, res) => {
    const userId = req.session.user.id;
    const { firstName, lastName, email, phone, address, skills, experience, education } = req.body;

    console.log('Received data from form:', req.body); // Praćenje podataka iz forme
    console.log('User ID from session:', userId); // Provjera korisničkog ID-a

    try {
        // Dohvati trenutne vrijednosti iz baze ako nisu poslani kroz formu
        const userData = await pool.query('SELECT first_name, last_name, email FROM users WHERE user_id = $1', [userId]);

        if (userData.rows.length === 0) {
            console.error('User not found in the database');
            return res.status(404).send('User not found');
        }

        const user = userData.rows[0];

        const firstNameToUpdate = firstName || user.first_name;
        const lastNameToUpdate = lastName || user.last_name;
        const emailToUpdate = email || user.email;

        console.log('Updating users table with:', { firstNameToUpdate, lastNameToUpdate, emailToUpdate, phone, address });

        // Ažuriraj tabelu `users`
        await pool.query(
            'UPDATE users SET first_name = $1, last_name = $2, email = $3, phone = $4, address = $5 WHERE user_id = $6',
            [firstNameToUpdate, lastNameToUpdate, emailToUpdate, phone, address, userId]
        );

        console.log('Updating candidates table with:', { skills, experience, education });

        // Ažuriraj tabelu `candidates`
        await pool.query(
            `INSERT INTO candidates (user_id, skills, experience, education, phone, address)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id) DO UPDATE 
             SET skills = $2, experience = $3, education = $4, phone = $5, address = $6`,
            [userId, skills, experience, education, phone, address]
        );

        console.log('Profile successfully updated!');
        res.redirect('/profile/edit'); // Preusmjeri nazad na profil
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).send('Error updating profile');
    }
});
  
module.exports = router;