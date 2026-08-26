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
  explanation: { type: String, default: '' },
  questionImage: { type: String, default: null },
  questionpic: { type: String, default: null },
  image: { type: String, default: null },
  cloudanary_link: { type: String, default: null },
  cloudinary_link: { type: String, default: null },
  explanationPic: { type: String, default: null },
  explanationImage: { type: String, default: null }
});

const HistorySchema = new mongoose.Schema({
  userId: { type: String, default: 'guest', index: true },
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

// Compound index for instant user-specific history sorting & retrieval
HistorySchema.index({ userId: 1, completedAt: -1 });
HistorySchema.index({ completedAt: -1 });

module.exports = mongoose.model('History', HistorySchema);
