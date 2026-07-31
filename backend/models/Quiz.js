const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionNumber: { type: Number },
  topic: { type: String, default: 'General' },
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, default: 0 },
  correctAnswerLetter: { type: String, default: 'A' },
  explanation: { type: String, default: 'No explanation provided.' },
  confidence: { type: Number, default: 1.0 }
});

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subject: { type: String, default: 'General', trim: true },
  description: { type: String, default: '', trim: true },
  questionCount: { type: Number, default: 0 },
  questions: [QuestionSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook to ensure questionCount & question numbers remain synced
QuizSchema.pre('save', function (next) {
  if (this.questions && Array.isArray(this.questions)) {
    this.questionCount = this.questions.length;
    this.questions.forEach((q, idx) => {
      q.questionNumber = idx + 1;
    });
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Quiz', QuizSchema);
