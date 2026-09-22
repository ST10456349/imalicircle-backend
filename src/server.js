// server.js
// Entry point for the iMali Circle REST API (Express + PostgreSQL).
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const stokvelRoutes = require('./routes/stokvels');
const syncRoutes = require('./routes/sync');

const app = express();
app.use(cors());
app.use(express.json());

// Simple request logger so behaviour is visible during marking/demo.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/stokvels', stokvelRoutes);
app.use('/sync', syncRoutes);
app.use('/debug', require('./routes/debug'));

// Catch-all error handler so a thrown error never crashes the whole process.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`iMali Circle API listening on port ${PORT}`));
}

module.exports = app;
