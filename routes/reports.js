const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

// Funkcija za generisanje PDF izvještaja
async function generateReport(jobId, reportData) {
  const reportsDir = path.join(__dirname, '../reports');
  const filePath = path.join(reportsDir, `job_${jobId}_report.pdf`);

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(filePath));

  // Dodavanje loga
  const logoPath = path.join(__dirname, '../public/images/logo.jpg');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 30, { width: 80 });
  }

  // Naslov izvještaja
  doc
    .fontSize(22)
    .fillColor('#4c275f')
    .text(`Job Report`, { align: 'center' })
    .moveDown(1);
  doc
    .fontSize(16)
    .text(`Report for Job ID: ${jobId}`, { align: 'center' })
    .moveDown(2);

  // Detalji konkursa
  if (reportData.length > 0) {
    const jobDetails = reportData[0];
    doc
      .fontSize(14)
      .fillColor('#000000')
      .text(`Job Title: ${jobDetails.job_title}`, { underline: true })
      .moveDown(0.5);
    doc.text(`Description: ${jobDetails.job_description}`);
    doc.text(`Deadline: ${new Date(jobDetails.deadline).toLocaleDateString()}`);
    doc.text(`Created by: ${jobDetails.created_by}`);
    doc.moveDown(1);
  }

  // Dodavanje linije
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#cccccc').moveDown(2);

  // Detalji o kandidatima
  doc
    .fontSize(16)
    .fillColor('#4c275f')
    .text('Candidate Details:', { underline: true })
    .moveDown();

  if (reportData.length === 0) {
    doc.fontSize(12).text('No candidates applied for this job.');
  } else {
    reportData.forEach((candidate, index) => {
      doc
        .fontSize(12)
        .text(`${index + 1}. Candidate: ${candidate.first_name} ${candidate.last_name}`)
        .text(`    Email: ${candidate.email}`)
        .text(`    Skills: ${candidate.skills || 'N/A'}`)
        .text(`    Experience: ${candidate.experience || 'N/A'}`)
        .text(`    Education: ${candidate.education || 'N/A'}`)
        .text(`    Application Status: ${candidate.application_status}`)
        .text(`    Interview Status: ${candidate.interview_status || 'Pending'}`)
        .text(`    Rating: ${candidate.rating || 'N/A'}`)
        .moveDown(1);
    });
  }

  // Dodavanje grafikona
  const chartBuffer = await generateChart(reportData);
  doc.addPage();
  doc.image(chartBuffer, { fit: [500, 300], align: 'center' });
  doc.text('Application Status Distribution', { align: 'center' });

  doc.end();
  return filePath;
}

// Funkcija za generisanje grafikona
async function generateChart(reportData) {
  const chartCanvas = new ChartJSNodeCanvas({ width: 600, height: 400 });

  const statusCounts = reportData.reduce((counts, candidate) => {
    counts[candidate.application_status] =
      (counts[candidate.application_status] || 0) + 1;
    return counts;
  }, {});

  const chartConfig = {
    type: 'pie',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [
        {
          label: 'Application Status Distribution',
          data: Object.values(statusCounts),
          backgroundColor: ['#4caf50', '#ff9800', '#f44336', '#2196f3'],
        },
      ],
    },
  };

  return await chartCanvas.renderToBuffer(chartConfig);
}

// Ruta za generisanje izvještaja za konkurs
router.get('/:job_id/generate-report', async (req, res) => {
    console.log('Received Job ID:', req.params.job_id); // Dodajte ovaj log
    const { job_id } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT
         j.job_id,
         j.title AS job_title,
         j.description AS job_description,
         j.deadline,
         u.first_name || ' ' || u.last_name AS created_by,
         c.candidate_id,
         c.skills,
         c.experience,
         c.education,
         u.email,
         a.status AS application_status,
         a.rating,
         i.status AS interview_status,
         i.scheduled_at AS interview_date,
         i.location AS interview_location,
         i.notes AS interview_notes
       FROM jobs j
       LEFT JOIN users u ON j.created_by = u.user_id
       LEFT JOIN applications a ON j.job_id = a.job_id
       LEFT JOIN candidates c ON a.candidate_id = c.candidate_id
       LEFT JOIN interviews i ON j.job_id = i.job_id AND c.candidate_id = i.candidate_id
       WHERE j.job_id = $1`,
      [job_id]
    );

    const reportData = result.rows;

    // Poziv funkcije za generisanje izvještaja
    const filePath = await generateReport(job_id, reportData);

    // Preuzimanje fajla
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="job_${job_id}_report.pdf"`);
    res.download(filePath, (err) => {
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
