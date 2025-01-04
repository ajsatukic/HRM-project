// Provjerava da li je korisnik prijavljen
function ensureLoggedIn(req, res, next) {
    if (req.session && req.session.user) {
      return next();
    } else {
      res.redirect('/auth/login');
    }
  }
  
  // Provjerava da li je prijavljeni korisnik admin
  function ensureAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
      return next();
    } else {
      res.status(403).send('Access denied. Admins only.');
    }
  }
  
  module.exports = { ensureLoggedIn, ensureAdmin };
  