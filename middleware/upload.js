const multer = require('multer');
const path = require('path');

// Konfiguracija za spremanje datoteka
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('Destination folder: uploads/cvs'); // Dodano za debuggiranje
    cb(null, 'uploads/cvs'); // Folder gdje će se datoteke čuvati
  },
  filename: function (req, file, cb) {
    const filename = `${req.session.user.id}-${Date.now()}${path.extname(file.originalname)}`;
    console.log('Generated filename:', filename); // Dodano za debuggiranje
    cb(null, filename);
  }
});

// Filter za prihvatanje samo PDF datoteka
const fileFilter = (req, file, cb) => {
  console.log('File type:', file.mimetype); // Dodano za debuggiranje
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = upload;
