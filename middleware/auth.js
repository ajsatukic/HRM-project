// Provjerava da li je korisnik prijavljen
function ensureLoggedIn(req, res, next) {
  console.log('Session Data:', req.session); // Loguje sesiju korisnika
  if (req.session && req.session.user) {
    return next();
  } else {
    res.redirect('/auth/login');
  }
}

function ensureAdmin(req, res, next) {
  console.log('Session User:', req.session.user); // Loguje korisnika iz sesije
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  } else {
    res.status(403).send('Access denied. Admins only.');
  }
}

  
  module.exports = { ensureLoggedIn, ensureAdmin };
  