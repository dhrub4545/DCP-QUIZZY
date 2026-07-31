const mongoose = require('mongoose');

const QuestionAttemptSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  topic: { type: String, default: 'General' },
  options: [{ type: String }],
  userOptionIndex: { type: Number },
  userLetter: { type: String, default: '-' },
  correctAnswerLetter: { type: String, default: 'A' },
  correctOptionIndex: { type: Number, default: 0 },
  isCorrect: { type: Boolean, default: false },
  explanation: { type: String, default: '' }
});

const HistorySchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  quizTitle: { type: String, required: true },
  subject: { type: String, default: 'General' },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  correctCount: { type: Number, required: true },
  incorrectCount: { type: Number, required: true },
  accuracyPercentage: { type: Number, required: true },
  timeTakenSeconds: { type: Number, default: 0 },
  questionBreakdown: [QuestionAttemptSchema],
  completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('History', HistorySchema);
