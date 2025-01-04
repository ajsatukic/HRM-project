const express = require('express');
const app = express();
const port = 3000;

// Middleware za parsiranje tijela zahtjeva
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const methodOverride = require('method-override');
app.use(methodOverride('_method'));

// Povezivanje s rutama
const userRoutes = require('./routes/users');

const jobRoutes = require('./routes/jobs');
app.use('/jobs', jobRoutes);

// Postavljanje EJS kao view engine
app.set('view engine', 'ejs');

// Korištenje ruta
app.use('/users', userRoutes);

// Pokretanje servera
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
