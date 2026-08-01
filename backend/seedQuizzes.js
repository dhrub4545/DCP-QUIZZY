const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load env vars from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const Quiz = require('./models/Quiz');

const QUIZ_CONFIGS = [
  {
    fileName: 'Gynae & OBS.json',
    subject: 'Gynae & OBS',
    title: 'Gynae & OBS Comprehensive Question Bank',
    description: 'Comprehensive Gynae & OBS MCQ Question Bank containing questions across multiple topics.'
  },
  {
    fileName: 'surgery.json',
    subject: 'Surgery',
    title: 'Surgery Comprehensive Question Bank',
    description: 'Comprehensive Surgery MCQ Question Bank containing questions across multiple topics.'
  },
  {
    fileName: 'medicine.json',
    subject: 'Medicine',
    title: 'Medicine Comprehensive Question Bank',
    description: 'Comprehensive Medicine MCQ Question Bank containing questions across multiple topics.'
  },
  {
    fileName: 'pediatrics.json',
    subject: 'Pediatrics',
    title: 'Pediatrics Comprehensive Question Bank',
    description: 'Comprehensive Pediatrics MCQ Question Bank containing questions across multiple topics.'
  }
];

async function seedQuizzes() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in backend/.env');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.\n');

    for (const config of QUIZ_CONFIGS) {
      const jsonPath = path.resolve(__dirname, '..', config.fileName);
      if (!fs.existsSync(jsonPath)) {
        console.warn(`[SKIP] File not found: ${jsonPath}`);
        continue;
      }

      console.log(`Processing "${config.fileName}"...`);
      const rawData = fs.readFileSync(jsonPath, 'utf8');
      const rawQuestions = JSON.parse(rawData);

      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        console.warn(`[SKIP] ${config.fileName} does not contain a valid array of questions.`);
        continue;
      }

      const formattedQuestions = rawQuestions.map((q, idx) => ({
        questionNumber: q.questionNumber || (idx + 1),
        topic: (q.topic && q.topic.trim()) || config.subject,
        questionText: q.questionText ? q.questionText.trim() : 'Question text unavailable',
        options: Array.isArray(q.options) && q.options.length > 0 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
        correctAnswerLetter: q.correctAnswerLetter || 'A',
        explanation: q.explanation ? q.explanation.trim() : 'No explanation provided.',
        confidence: typeof q.confidence === 'number' ? q.confidence : 1.0
      }));

      const fullDescription = `${config.description.replace('questions across', `${formattedQuestions.length} questions across`)}`;

      // Check if Quiz already exists for subject or title
      let quiz = await Quiz.findOne({
        $or: [
          { subject: config.subject },
          { title: config.title }
        ]
      });

      if (quiz) {
        console.log(`  Updating existing Quiz (ID: ${quiz._id}) for subject "${config.subject}"...`);
        quiz.title = config.title;
        quiz.subject = config.subject;
        quiz.description = fullDescription;
        quiz.questions = formattedQuestions;
        quiz.questionCount = formattedQuestions.length;
        quiz.updatedAt = new Date();
      } else {
        console.log(`  Creating new Quiz document for subject "${config.subject}"...`);
        quiz = new Quiz({
          title: config.title,
          subject: config.subject,
          description: fullDescription,
          questions: formattedQuestions,
          questionCount: formattedQuestions.length
        });
      }

      const savedQuiz = await quiz.save();
      console.log(`  SUCCESS: Saved "${savedQuiz.title}" (ID: ${savedQuiz._id}) with ${savedQuiz.questionCount} questions.\n`);
    }

    console.log('==================================================');
    console.log('SUCCESS: All available quiz JSON files seeded to MongoDB!');
    console.log('==================================================\n');
  } catch (error) {
    console.error('ERROR seeding quizzes to MongoDB:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seedQuizzes();
