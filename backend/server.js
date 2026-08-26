require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const Quiz = require('./models/Quiz');
const quizRoutes = require('./routes/quizRoutes');
const historyRoutes = require('./routes/historyRoutes');
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middleware/authMiddleware');

// Connect to MongoDB and run topic indexing synchronization
connectDB().then(() => {
  syncQuizTopics();
});

// Startup helper: ensure all existing quizzes have their lightweight `topics` field indexed
async function syncQuizTopics() {
  try {
    const quizzesNeedingSync = await Quiz.find({
      $or: [{ topics: { $exists: false } }, { topics: { $size: 0 } }]
    });
    if (quizzesNeedingSync.length > 0) {
      for (const q of quizzesNeedingSync) {
        if (q.questions && q.questions.length > 0) {
          const tSet = new Set();
          q.questions.forEach(item => {
            if (item.topic && typeof item.topic === 'string' && item.topic.trim()) {
              tSet.add(item.topic.trim());
            }
          });
          q.topics = Array.from(tSet);
          q.questionCount = q.questions.length;
          await q.save();
        }
      }
      console.log(`[Startup] Synced topics for ${quizzesNeedingSync.length} quiz record(s).`);
    }
  } catch (err) {
    console.warn('[Startup] Topic sync notice:', err.message);
  }
}

const app = express();

// Trust proxy for accurate IP tracking if behind reverse proxy
app.set('trust proxy', 1);

// Security & Performance Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Payload parsing with safe limits (prevents payload DoS)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Quizzy API Server 🚀',
    version: '1.0.0',
    status: 'Active',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      quizzes: '/api/quizzes',
      history: '/api/history',
      ai: '/api/ai'
    }
  });
});

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend service is healthy', timestamp: new Date().toISOString() });
});

// 1. Strict Auth Rate Limiter (Block IP after 10 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login/register requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.'
  }
});

// 2. AI Endpoint Rate Limiter (Max 20 AI calls per minute per IP)
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests. Please wait a moment before trying again.'
  }
});

// 3. General API Rate Limiter (Max 300 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please slow down.'
  }
});

// Apply Rate Limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/ai/', aiLimiter);
app.use('/api/', apiLimiter);

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

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (0.0.0.0 - LAN accessible)`);
  });
}

module.exports = app;
