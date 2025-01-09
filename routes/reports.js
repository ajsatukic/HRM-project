const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logoPath = path.join(__dirname, '../public/images/logo.jpg'); // Provjerite tačnost putanje

// Funkcija za generisanje PDF izvještaja
async function generateReport(jobId, reportData) {
  const reportsDir = path.join(__dirname, '../reports');
  const filePath = path.join(reportsDir, `job_${jobId}_report.pdf`);

  // Provjera da li folder 'reports' postoji
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  // Dodavanje logotipa
  try {
    doc.image(logoPath, doc.page.width - 100, 20, { width: 80 }); // Postavite širinu logotipa
  } catch (err) {
    console.error('Error loading logo image:', err);
  }

  // Naslov izvještaja
  doc
    .fontSize(20)
    .fillColor('#4c275f')
    .text(`Report for Job ID: ${jobId}`, { align: 'center' });
  doc.moveDown(2);

  // Detalji konkursa
  if (reportData.length > 0) {
    const jobDetails = reportData[0];
    doc
      .fontSize(14)
      .fillColor('#000000')
      .text(`Job Title: ${jobDetails.job_title}`, { underline: true });
    doc.fontSize(12).text(`Description: ${jobDetails.job_description}`);
    doc.moveDown(1);
  }

  // Detalji o kandidatima
  doc
    .fontSize(16)
    .fillColor('#4c275f')
    .text('Candidate Details:', { underline: true });
  doc.moveDown();

  if (reportData.length === 0) {
    doc.fontSize(12).text('No candidates applied for this job.');
  } else {
    reportData.forEach((candidate) => {
      doc.fontSize(12).text(`Candidate Name: ${candidate.first_name || 'N/A'} ${candidate.last_name || ''}`);
      doc.fontSize(12).text(`Skills: ${candidate.skills || 'N/A'}`);
      doc.fontSize(12).text(`Experience: ${candidate.experience || 'N/A'}`);
      doc.fontSize(12).text(`Education: ${candidate.education || 'N/A'}`);
      doc.fontSize(12).text(`Rating: ${candidate.rating || 'N/A'}`);
      doc.fontSize(12).text(`Application Status: ${candidate.application_status || 'N/A'}`);
      doc.moveDown(1);
    });
  }

  // Detalji o intervjuima
  doc
    .fontSize(16)
    .fillColor('#4c275f')
    .text('Interview Details:', { underline: true });
  doc.moveDown();

  reportData.forEach((candidate) => {
    if (candidate.interview_status) {
      doc.fontSize(12).text(`Candidate ID: ${candidate.candidate_id}`);
      doc.fontSize(12).text(`Interview Status: ${candidate.interview_status}`);
      doc.fontSize(12).text(`Interview Date: ${candidate.interview_date || 'N/A'}`);
      doc.fontSize(12).text(`Location: ${candidate.interview_location || 'N/A'}`);
      doc.fontSize(12).text(`Notes: ${candidate.interview_notes || 'N/A'}`);
      doc.moveDown(1);
    }
  });

  doc.end();
  return filePath;
}

// Ruta za generisanje izvještaja za konkurs
router.get('/:job_id/generate-report', async (req, res) => {
  const { job_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         j.job_id,
         j.title AS job_title,
         j.description AS job_description,
         c.candidate_id,
         c.skills,
         c.experience,
         c.education,
         a.status AS application_status,
         a.rating,
         u.first_name,
         u.last_name,
         i.status AS interview_status,
         i.scheduled_at AS interview_date,
         i.location AS interview_location,
         i.notes AS interview_notes
       FROM jobs j
       LEFT JOIN applications a ON j.job_id = a.job_id
       LEFT JOIN candidates c ON a.candidate_id = c.candidate_id
       LEFT JOIN users u ON c.user_id = u.user_id
       LEFT JOIN interviews i ON j.job_id = i.job_id AND c.candidate_id = i.candidate_id
       WHERE j.job_id = $1`,
      [job_id]
    );

    const reportData = result.rows;

    // Poziv funkcije za generisanje izvještaja
    const filePath = await generateReport(job_id, reportData);

    // Preuzimanje fajla
    res.download(filePath, `job_${job_id}_report.pdf`, (err) => {
  if (err) {
    console.error('Error sending file:', err);
    res.status(500).send('Error generating report');
  } else {
    console.log('Report sent successfully.');
  }
});

  } catch (err) {
    console.error('Error generating PDF report:', err);
    res.status(500).json({ success: false, message: 'Error generating PDF report' });
  }
});

module.exports = router;
