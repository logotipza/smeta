const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const smetaRoutes = require('./routes/smeta');
const ratesRoutes = require('./routes/rates');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/smeta', smetaRoutes);
app.use('/api/rates', ratesRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
