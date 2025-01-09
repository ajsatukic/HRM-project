// Provjerava da li je korisnik prijavljen
function ensureLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next(); 
  }
  console.warn('Unauthorized access attempt detected.'); 
  res.status(401).redirect('/login'); 
}

// Provjerava da li je korisnik administrator
function ensureAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next(); 
  }
  console.warn('Access denied. User is not an admin.'); 
  res.status(403).send('Access denied. Admins only.'); 
}

module.exports = { ensureLoggedIn, ensureAdmin };
