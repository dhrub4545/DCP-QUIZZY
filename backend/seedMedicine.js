const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

const Quiz = require('./models/Quiz');

async function pushMedicineToMongoDB() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in backend/.env');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    // Path to medicine.json
    const jsonPath = path.resolve(__dirname, '../medicine.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`File not found at path: ${jsonPath}`);
    }

    console.log(`Reading medicine.json from: ${jsonPath}`);
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const rawQuestions = JSON.parse(rawData);

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      throw new Error('medicine.json does not contain a valid non-empty array of questions.');
    }

    console.log(`Found ${rawQuestions.length} questions in medicine.json.`);

    // Map and sanitize questions
    const formattedQuestions = rawQuestions.map((q, idx) => ({
      questionNumber: q.questionNumber || (idx + 1),
      topic: (q.topic && q.topic.trim()) || 'General Medicine',
      questionText: q.questionText || '',
      options: Array.isArray(q.options) ? q.options : [],
      correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
      correctAnswerLetter: q.correctAnswerLetter || 'A',
      explanation: q.explanation || 'No explanation provided.',
      confidence: typeof q.confidence === 'number' ? q.confidence : 1.0
    }));

    const quizTitle = 'Medicine Comprehensive Question Bank';
    const quizSubject = 'Medicine';
    const quizDescription = `Comprehensive Medicine MCQ Question Bank containing ${formattedQuestions.length} questions across multiple topics.`;

    // Check if Quiz already exists
    let quiz = await Quiz.findOne({
      $or: [
        { subject: 'Medicine' },
        { title: quizTitle }
      ]
    });

    if (quiz) {
      console.log(`Found existing Medicine Quiz (ID: ${quiz._id}). Updating questions...`);
      quiz.title = quizTitle;
      quiz.subject = quizSubject;
      quiz.description = quizDescription;
      quiz.questions = formattedQuestions;
      quiz.questionCount = formattedQuestions.length;
      quiz.updatedAt = new Date();
    } else {
      console.log('Creating new Medicine Quiz document in MongoDB...');
      quiz = new Quiz({
        title: quizTitle,
        subject: quizSubject,
        description: quizDescription,
        questions: formattedQuestions,
        questionCount: formattedQuestions.length
      });
    }

    const savedQuiz = await quiz.save();
    console.log('\n==================================================');
    console.log('SUCCESS: Medicine JSON successfully pushed to MongoDB!');
    console.log(`Quiz ID: ${savedQuiz._id}`);
    console.log(`Title: ${savedQuiz.title}`);
    console.log(`Subject: ${savedQuiz.subject}`);
    console.log(`Total Questions Pushed: ${savedQuiz.questionCount}`);
    console.log('==================================================\n');

  } catch (error) {
    console.error('ERROR pushing medicine questions to MongoDB:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

pushMedicineToMongoDB();
