const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const RATES_FILE = path.join(__dirname, '../data/rates.json');

function loadRates() {
  try {
    const raw = fs.readFileSync(RATES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    // Если файла нет — используем дефолтные
    return require('../data/rates').rates;
  }
}

function saveRates(rates) {
  fs.writeFileSync(RATES_FILE, JSON.stringify(rates, null, 2), 'utf8');
}

let rates = loadRates();

router.get('/', (req, res) => {
  res.json(rates);
});

router.post('/', (req, res) => {
  const { role, partner, own } = req.body;
  if (!role || rates.find((r) => r.role === role)) {
    return res.status(400).json({ error: 'Role name required or already exists' });
  }
  const newRate = { role, partner: Number(partner) || 0, own: Number(own) || 0 };
  rates.push(newRate);
  saveRates(rates);
  res.json(newRate);
});

router.put('/:role', (req, res) => {
  const roleName = decodeURIComponent(req.params.role);
  const idx = rates.findIndex((r) => r.role === roleName);
  if (idx === -1) return res.status(404).json({ error: 'Role not found' });
  const { role, partner, own } = req.body;
  rates[idx] = {
    role: role || roleName,
    partner: Number(partner) || 0,
    own: Number(own) || 0,
  };
  saveRates(rates);
  res.json(rates[idx]);
});

router.delete('/:role', (req, res) => {
  const roleName = decodeURIComponent(req.params.role);
  const idx = rates.findIndex((r) => r.role === roleName);
  if (idx === -1) return res.status(404).json({ error: 'Role not found' });
  rates.splice(idx, 1);
  saveRates(rates);
  res.json({ success: true });
});

module.exports = router;
