const express = require('express');
const router = express.Router();
const xlsxGenerator = require('../services/xlsxGenerator');
const { workTypes, roles } = require('../data/dictionaries');

router.get('/health', (req, res) => {
  res.json({ status: 'smeta route ok' });
});

router.get('/dictionaries', (req, res) => {
  res.json({ workTypes, roles });
});

router.post('/export', async (req, res) => {
  try {
    const { data, options } = req.body;
    const buffer = await xlsxGenerator.generate(data, options);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=smeta.xlsx');
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to generate xlsx', detail: err.message });
  }
});

module.exports = router;
