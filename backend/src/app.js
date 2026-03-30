const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.route');
const quranRoutes = require('./routes/quran.route');
const analysisRoutes = require('./routes/analysis.route');

const app = express();

app.use(cors());
app.use(express.json());

// Mount the routes
app.use('/api/auth', authRoutes);
app.use('/api/quran', quranRoutes);
app.use('/api', analysisRoutes); // /analyze, /analyze-reference, /analyze-word-hybrid

module.exports = app;
