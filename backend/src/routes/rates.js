const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const RATES_FILE = path.join(__dirname, '../data/rates.json');

const defaultRates = [
  { id: '1', role: 'Аналитик', rate: 1900 },
  { id: '2', role: 'Дизайнер', rate: 1800 },
  { id: '3', role: 'Разработчик', rate: 2500 },
  { id: '4', role: 'Тестировщик', rate: 1500 },
];

function loadRates() {
  try {
    if (fs.existsSync(RATES_FILE)) {
      return JSON.parse(fs.readFileSync(RATES_FILE, 'utf8'));
    }
  } catch { /* ignore */ }
  return [...defaultRates];
}

function saveRates(rates) {
  fs.writeFileSync(RATES_FILE, JSON.stringify(rates, null, 2), 'utf8');
}

let rates = loadRates();

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

router.get('/', (req, res) => res.json(rates));

router.post('/', (req, res) => {
  const { role, rate } = req.body;
  if (!role || !rate) return res.status(400).json({ error: 'role and rate required' });
  const item = { id: genId(), role: role.trim(), rate: Number(rate) };
  rates.push(item);
  saveRates(rates);
  res.json(item);
});

router.put('/:id', (req, res) => {
  const idx = rates.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const { role, rate } = req.body;
  rates[idx] = { ...rates[idx], role: role?.trim() || rates[idx].role, rate: Number(rate) || rates[idx].rate };
  saveRates(rates);
  res.json(rates[idx]);
});

router.delete('/:id', (req, res) => {
  const idx = rates.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  rates.splice(idx, 1);
  saveRates(rates);
  res.json({ success: true });
});

module.exports = router;
