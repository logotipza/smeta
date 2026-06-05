const express = require('express');
const router = express.Router();
const xlsxGenerator = require('../services/xlsxGenerator');
const { rates, getRate } = require('../data/rates');
const { calculateTree, calculateTotals } = require('../calculator');

router.get('/health', (req, res) => {
  res.json({ status: 'smeta route ok' });
});

router.get('/config', (req, res) => {
  res.json({
    rates: rates.map((r) => r.role),
    rateDetails: rates,
  });
});

router.post('/calculate', (req, res) => {
  try {
    const { rows, settings, workTypes } = req.body;
    const calculated = calculateTree(rows, settings, workTypes);
    const totals = calculateTotals(calculated, settings, workTypes);
    res.json({ rows: calculated, totals });
  } catch (err) {
    console.error('Calculate error:', err);
    res.status(500).json({ error: err.message });
  }
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
