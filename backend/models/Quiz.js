const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionNumber: { type: Number },
  topic: { type: String, default: 'General' },
  pageNumber: { type: Number, default: null },
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, default: 0 },
  correctAnswerLetter: { type: String, default: 'A' },
  explanation: { type: String, default: 'No explanation provided.' },
  confidence: { type: Number, default: 1.0 },
  questionImage: { type: String, default: null },
  questionpic: { type: String, default: null },
  image: { type: String, default: null },
  cloudanary_link: { type: String, default: null },
  cloudinary_link: { type: String, default: null },
  explanationPic: { type: String, default: null },
  explanationImage: { type: String, default: null }
});

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subject: { type: String, default: 'General', trim: true },
  description: { type: String, default: '', trim: true },
  questionCount: { type: Number, default: 0 },
  questions: [QuestionSchema],
  topics: [{ type: String }],
  isCustom: { type: Boolean, default: false },
  creator: { type: String, default: 'admin' },
  userId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Database Indexes for high-concurrency scaling
QuizSchema.index({ isCustom: 1, createdAt: -1 });
QuizSchema.index({ userId: 1, createdAt: -1 });
QuizSchema.index({ createdAt: -1 });

// Pre-save hook to ensure questionCount, question numbers & topics remain synced
QuizSchema.pre('save', function (next) {
  if (this.questions && Array.isArray(this.questions)) {
    this.questionCount = this.questions.length;
    const distinctTopics = new Set();
    this.questions.forEach((q, idx) => {
      q.questionNumber = idx + 1;
      if (q.topic && typeof q.topic === 'string' && q.topic.trim()) {
        distinctTopics.add(q.topic.trim());
      }
    });
    this.topics = Array.from(distinctTopics);
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Quiz', QuizSchema);
