// Provjerava da li je korisnik prijavljen
function ensureLoggedIn(req, res, next) {
  console.log('Session Data:', req.session); // Ispis trenutne sesije za debug
  if (req.session && req.session.user) {
    return next(); // Ako postoji sesija i korisnik, prelazi na sljedeći middleware
  }
  console.warn('Unauthorized access attempt detected.'); // Log upozorenja za neovlašteni pristup
  res.status(401).redirect('/login'); // Ako nije prijavljen, preusmjerava na login stranicu
}

// Provjerava da li je korisnik administrator
function ensureAdmin(req, res, next) {
  console.log('Session User:', req.session.user); // Ispis trenutne sesije za debug
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next(); // Ako je korisnik admin, prelazi na sljedeći middleware
  }
  console.warn('Access denied. User is not an admin.'); // Log upozorenja za zabranjeni pristup
  res.status(403).send('Access denied. Admins only.'); // Ako nije admin, vraća grešku
}

module.exports = { ensureLoggedIn, ensureAdmin };
