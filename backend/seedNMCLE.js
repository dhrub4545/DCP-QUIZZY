const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load env vars from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const Quiz = require('./models/Quiz');

/**
 * Inserts Cloudinary optimization parameters (f_auto, q_auto:good, w_800, c_limit)
 * to ensure high-speed mobile delivery and low data footprint.
 */
function optimizeCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('cloudinary.com')) return url;
  if (url.includes('/f_auto,')) return url; // Already optimized
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto:good,w_800,c_limit/');
}

/**
 * Format and normalize explanation text:
 * Replaces ((pic)) with optimized markdown image syntax if image URL exists.
 */
function formatExplanationWithImages(rawExp, cloudUrl) {
  let exp = (rawExp || '').trim();
  const optUrl = optimizeCloudinaryUrl(cloudUrl);

  if (optUrl) {
    if (exp.includes('((pic))')) {
      exp = exp.replace(/\(\(pic\)\)/g, `\n\n![Medical Diagram](${optUrl})\n\n`);
    } else {
      // Append if image was provided but ((pic)) placeholder was omitted
      exp = exp ? `${exp}\n\n![Medical Diagram](${optUrl})` : `![Medical Diagram](${optUrl})`;
    }
  } else {
    // If ((pic)) is present but no image URL exists, clean it up
    exp = exp.replace(/\(\(pic\)\)/g, '').trim();
  }

  return exp || 'No explanation provided.';
}

/**
 * Normalize title from filename
 * e.g., "NMCLE - 2080 Magh set 1.json" -> "NMCLE - 2080 Magh Set 1"
 */
function getQuizTitleFromFilename(fileName) {
  const base = fileName.replace(/\.json$/i, '').trim();
  return base.replace(/\bset\s*(\d+)\b/i, (_, num) => `Set ${num}`);
}

async function seedNMCLEQuizzes() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in backend/.env');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.\n');

    const jsonDir = path.resolve(__dirname, '..', 'NMCLE_10th_edition_JSON');
    if (!fs.existsSync(jsonDir)) {
      throw new Error(`Directory not found: ${jsonDir}`);
    }

    const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} NMCLE JSON files to process in: ${jsonDir}\n`);

    let totalQuizzesProcessed = 0;
    let totalQuestionsProcessed = 0;
    let totalImagesProcessed = 0;

    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      const filePath = path.join(jsonDir, fileName);
      const quizTitle = getQuizTitleFromFilename(fileName);

      const rawContent = fs.readFileSync(filePath, 'utf8');
      let rawQuestions;
      try {
        rawQuestions = JSON.parse(rawContent);
      } catch (parseErr) {
        console.error(`  [ERROR] Failed to parse JSON in ${fileName}:`, parseErr.message);
        continue;
      }

      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        console.warn(`  [SKIP] ${fileName} has no valid question array.`);
        continue;
      }

      let fileImageCount = 0;

      const formattedQuestions = rawQuestions.map((q, idx) => {
        const cloudUrl = q.cloudanary_link || q.cloudinary_link || q.explanationPic || q.explanation_pic || q.explanationImage || q.explanation_image || null;
        const qPicUrl = q.questionpic || q.questionImage || q.questionPic || q.question_image || q.question_pic || q.image || null;

        const optCloudUrl = optimizeCloudinaryUrl(cloudUrl);
        const optQPicUrl = optimizeCloudinaryUrl(qPicUrl);

        if (optCloudUrl || optQPicUrl) {
          fileImageCount++;
          totalImagesProcessed++;
        }

        const formattedExplanation = formatExplanationWithImages(q.explanation, optCloudUrl);

        return {
          questionNumber: q.questionNumber || (idx + 1),
          topic: (q.topic && q.topic.trim()) || quizTitle,
          pageNumber: typeof q.pageNumber === 'number' ? q.pageNumber : null,
          questionText: q.questionText ? q.questionText.trim() : 'Question text unavailable',
          options: Array.isArray(q.options) && q.options.length > 0
            ? q.options.map(opt => String(opt).trim())
            : ['Option A', 'Option B', 'Option C', 'Option D'],
          correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
          correctAnswerLetter: q.correctAnswerLetter || 'A',
          explanation: formattedExplanation,
          confidence: typeof q.confidence === 'number' ? q.confidence : 1.0,
          questionImage: optQPicUrl,
          questionpic: optQPicUrl,
          image: optQPicUrl,
          cloudanary_link: optCloudUrl,
          cloudinary_link: optCloudUrl,
          explanationPic: optCloudUrl,
          explanationImage: optCloudUrl
        };
      });

      const description = `${quizTitle} (NMCLE 10th Edition Past Question Paper) with ${formattedQuestions.length} full questions, explanations, and diagrams.`;

      // Find existing Quiz by title
      let quiz = await Quiz.findOne({ title: quizTitle });

      if (quiz) {
        quiz.title = quizTitle;
        quiz.subject = 'NMCLE Past Papers';
        quiz.description = description;
        quiz.questions = formattedQuestions;
        quiz.questionCount = formattedQuestions.length;
        quiz.isCustom = false;
        quiz.creator = 'admin';
        quiz.updatedAt = new Date();
      } else {
        quiz = new Quiz({
          title: quizTitle,
          subject: 'NMCLE Past Papers',
          description: description,
          questions: formattedQuestions,
          questionCount: formattedQuestions.length,
          isCustom: false,
          creator: 'admin'
        });
      }

      const saved = await quiz.save();
      totalQuizzesProcessed++;
      totalQuestionsProcessed += formattedQuestions.length;

      console.log(
        `[${i + 1}/${files.length}] Pushed: "${saved.title}" ` +
        `(${saved.questionCount} Qs, ${fileImageCount} images) -> DB ID: ${saved._id}`
      );
    }

    console.log('\n=============================================================');
    console.log('✅ ALL NMCLE JSON SETS SUCCESSFULLY PUSHED TO MONGODB!');
    console.log(`📊 Summary:`);
    console.log(`   - Quizzes Seeded/Updated : ${totalQuizzesProcessed}`);
    console.log(`   - Total Questions Saved  : ${totalQuestionsProcessed}`);
    console.log(`   - Questions with Images  : ${totalImagesProcessed}`);
    console.log('=============================================================\n');
  } catch (error) {
    console.error('Fatal Error during NMCLE seeding:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seedNMCLEQuizzes();
