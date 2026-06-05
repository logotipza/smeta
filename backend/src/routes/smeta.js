const express = require('express');
const router = express.Router();
const xlsxGenerator = require('../services/xlsxGenerator');

// GET /api/smeta/health
router.get('/health', (req, res) => {
  res.json({ status: 'smeta route ok' });
});

// POST /api/smeta/export
// Body: { data: [...] }
router.post('/export', async (req, res) => {
  try {
    const { data, options } = req.body;
    const buffer = await xlsxGenerator.generate(data, options);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=smeta.xlsx');
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to generate xlsx' });
  }
});

module.exports = router;
