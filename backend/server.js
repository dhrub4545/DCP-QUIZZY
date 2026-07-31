require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const quizRoutes = require('./routes/quizRoutes');
const historyRoutes = require('./routes/historyRoutes');
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middleware/authMiddleware');

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend service is healthy' });
});

// JWT Security Verification Middleware
app.use(authMiddleware);

// API Routes
app.use('/api/quizzes', quizRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (0.0.0.0 - LAN accessible)`);
});
