const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');

/**
 * @desc    Create a new manual Quiz
 * @route   POST /api/quizzes
 */
const createQuiz = async (req, res) => {
  try {
    const { title, subject, description, questions, isCustom, creator } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Quiz title is required.' });
    }

    const newQuiz = new Quiz({
      title: title.trim(),
      subject: subject ? subject.trim() : 'General',
      description: description ? description.trim() : '',
      questions: Array.isArray(questions) ? questions : [],
      isCustom: isCustom !== undefined ? isCustom : true,
      creator: creator ? creator.trim() : 'user'
    });

    await newQuiz.save();

    return res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      quiz: newQuiz
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error creating quiz' });
  }
};

/**
 * @desc    Get all Quizzes (Lightweight directory list)
 * @route   GET /api/quizzes
 */
const getAllQuizzes = async (req, res) => {
  try {
    const currentUserId = req.user?.id || req.user?._id || req.query.userId || 'guest';

    const quizzes = await Quiz.find(
      {},
      'title subject description questionCount questions.topic isCustom creator userId createdAt updatedAt'
    ).sort({ createdAt: -1 });

    const formattedQuizzes = quizzes
      .map(q => {
        const topicsSet = new Set();
        if (Array.isArray(q.questions)) {
          q.questions.forEach(question => {
            if (question.topic) topicsSet.add(question.topic);
          });
        }

        const titleLower = (q.title || '').toLowerCase();
        const isCustomFlag = Boolean(
          q.isCustom === true ||
          q.creator === 'user' ||
          titleLower.includes('custom') ||
          titleLower.includes('combined')
        );

        return {
          _id: q._id,
          title: q.title,
          subject: q.subject || 'General',
          description: q.description || '',
          questionCount: q.questionCount || (q.questions ? q.questions.length : 0),
          topics: Array.from(topicsSet),
          isCustom: isCustomFlag,
          creator: q.creator || 'admin',
          userId: q.userId || null,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt
        };
      })
      .filter(q => {
        // Standard admin quizzes are public for all users
        if (!q.isCustom) return true;

        // Custom quizzes are visible ONLY to the user who created them (or guest session)
        if (!q.userId || q.userId === 'guest' || q.userId === currentUserId) return true;
        return false;
      });

    return res.status(200).json({
      success: true,
      count: formattedQuizzes.length,
      quizzes: formattedQuizzes
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching quizzes' });
  }
};

/**
 * @desc    Get a single Quiz by ID
 * @route   GET /api/quizzes/:id
 */
const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    return res.status(200).json({
      success: true,
      quiz
    });
  } catch (error) {
    console.error('Error fetching quiz by ID:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching quiz' });
  }
};

/**
 * @desc    Update Quiz metadata (title, subject, description)
 * @route   PUT /api/quizzes/:id
 */
const updateQuiz = async (req, res) => {
  try {
    const { title, subject, description } = req.body;
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (title !== undefined) quiz.title = title.trim();
    if (subject !== undefined) quiz.subject = subject.trim();
    if (description !== undefined) quiz.description = description.trim();

    await quiz.save();

    return res.status(200).json({
      success: true,
      message: 'Quiz updated successfully',
      quiz
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    return res.status(500).json({ success: false, message: 'Server error updating quiz' });
  }
};

/**
 * @desc    Delete a Quiz
 * @route   DELETE /api/quizzes/:id
 */
const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (!quiz.isCustom && quiz.creator === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Standard platform quizzes cannot be deleted.'
      });
    }

    await Quiz.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting quiz' });
  }
};

/**
 * @desc    Add a new Question to a Quiz
 * @route   POST /api/quizzes/:id/questions
 */
const addQuestionToQuiz = async (req, res) => {
  try {
    const { questionText, options, correctOptionIndex, correctAnswerLetter, explanation, topic } = req.body;

    if (!questionText || !questionText.trim()) {
      return res.status(400).json({ success: false, message: 'Question text is required.' });
    }
    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 options are required.' });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    let correctIndex = Number(correctOptionIndex);
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const letter = correctAnswerLetter ? String(correctAnswerLetter).toUpperCase().trim() : (letters[correctIndex] || 'A');

    const newQuestion = {
      topic: topic ? topic.trim() : quiz.subject || 'General',
      questionText: questionText.trim(),
      options: options.map(o => String(o).trim()),
      correctOptionIndex: correctIndex,
      correctAnswerLetter: letter,
      explanation: explanation ? explanation.trim() : 'No explanation provided.',
      confidence: 1.0
    };

    quiz.questions.push(newQuestion);
    await quiz.save();

    return res.status(201).json({
      success: true,
      message: 'Question added successfully',
      quiz
    });
  } catch (error) {
    console.error('Error adding question:', error);
    return res.status(500).json({ success: false, message: 'Server error adding question' });
  }
};

/**
 * @desc    Update/Edit an existing Question in a Quiz
 * @route   PUT /api/quizzes/:id/questions/:questionId
 */
const updateQuestionInQuiz = async (req, res) => {
  try {
    const { id, questionId } = req.params;
    const { questionText, options, correctOptionIndex, correctAnswerLetter, explanation, topic } = req.body;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const question = quiz.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    if (questionText !== undefined) question.questionText = questionText.trim();
    if (topic !== undefined) question.topic = topic.trim();
    if (explanation !== undefined) question.explanation = explanation.trim();
    
    if (Array.isArray(options) && options.length >= 2) {
      question.options = options.map(o => String(o).trim());
    }

    if (correctOptionIndex !== undefined) {
      let idx = Number(correctOptionIndex);
      if (!isNaN(idx) && idx >= 0 && idx < question.options.length) {
        question.correctOptionIndex = idx;
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        question.correctAnswerLetter = letters[idx] || 'A';
      }
    }

    if (correctAnswerLetter !== undefined) {
      question.correctAnswerLetter = String(correctAnswerLetter).toUpperCase().trim();
    }

    await quiz.save();

    return res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      quiz
    });
  } catch (error) {
    console.error('Error updating question:', error);
    return res.status(500).json({ success: false, message: 'Server error updating question' });
  }
};

/**
 * @desc    Delete a Question from a Quiz
 * @route   DELETE /api/quizzes/:id/questions/:questionId
 */
const deleteQuestionFromQuiz = async (req, res) => {
  try {
    const { id, questionId } = req.params;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    quiz.questions.pull({ _id: questionId });
    await quiz.save();

    return res.status(200).json({
      success: true,
      message: 'Question deleted successfully',
      quiz
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting question' });
  }
};

/**
 * @desc    Get all available Question Sources (quizzes with summary & topic list)
 * @route   GET /api/quizzes/sources
 */
const getAvailableSources = async (req, res) => {
  try {
    const quizzes = await Quiz.find({}, 'title subject description questionCount questions.topic createdAt');
    
    const sources = quizzes.map(q => {
      const topicsSet = new Set();
      if (Array.isArray(q.questions)) {
        q.questions.forEach(question => {
          if (question.topic) topicsSet.add(question.topic);
        });
      }
      return {
        _id: q._id,
        title: q.title,
        subject: q.subject || 'General',
        description: q.description || '',
        questionCount: q.questionCount || (q.questions ? q.questions.length : 0),
        topics: Array.from(topicsSet)
      };
    });

    return res.status(200).json({
      success: true,
      sources
    });
  } catch (error) {
    console.error('Error fetching quiz sources:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching question sources' });
  }
};

/**
 * @desc    Generate a Custom Quiz combining random questions from multiple sources
 * @route   POST /api/quizzes/generate-custom
 */
const generateCustomQuiz = async (req, res) => {
  try {
    const activeUserId = req.user?.id || req.user?._id || req.body.userId || 'guest';
    const { title, subject, description, sources, saveAsQuiz, randomizeDistribution, targetTotalQuestions, destinationCategory } = req.body;

    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one question source allocation must be provided.'
      });
    }

    // High-entropy Fisher-Yates shuffle helper
    const shuffleArray = (array) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // Calculate actual source allocations (Randomized vs Exact per book)
    let processedSources = [...sources];

    if (randomizeDistribution && targetTotalQuestions > 0 && sources.length > 1) {
      // Generate random weights per source
      const randomWeights = sources.map(() => Math.random() + 0.2); // min weight 0.2 to avoid 0
      const totalWeight = randomWeights.reduce((sum, w) => sum + w, 0);

      let allocatedSoFar = 0;
      processedSources = sources.map((src, idx) => {
        if (idx === sources.length - 1) {
          return { ...src, count: Math.max(1, targetTotalQuestions - allocatedSoFar) };
        }
        const allocatedCount = Math.max(1, Math.round((randomWeights[idx] / totalWeight) * targetTotalQuestions));
        allocatedSoFar += allocatedCount;
        return { ...src, count: allocatedCount };
      });
    }

    let combinedQuestions = [];

    for (const src of processedSources) {
      const { quizId, count } = src;
      const requestedCount = Number(count) || 0;
      if (!quizId || requestedCount <= 0) continue;

      let quizDoc = null;
      if (mongoose.Types.ObjectId.isValid(quizId)) {
        quizDoc = await Quiz.findById(quizId);
      } else {
        quizDoc = await Quiz.findOne({
          $or: [{ title: quizId }, { subject: quizId }]
        });
      }

      if (quizDoc && Array.isArray(quizDoc.questions) && quizDoc.questions.length > 0) {
        // Convert subdocuments to plain objects so shuffling works seamlessly
        const rawQuestions = quizDoc.questions.map(q => (typeof q.toObject === 'function' ? q.toObject() : q));
        
        // 1. Fully shuffle ALL available questions in this source
        const fullyShuffled = shuffleArray(rawQuestions);
        
        // 2. Pick requestedCount questions randomly from the shuffled pool
        const sampled = fullyShuffled.slice(0, Math.min(requestedCount, fullyShuffled.length));

        // 3. Tag and clean questions
        const tagged = sampled.map(q => ({
          questionNumber: q.questionNumber,
          topic: q.topic || quizDoc.subject || 'General',
          questionText: q.questionText,
          options: Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [],
          correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
          correctAnswerLetter: q.correctAnswerLetter || 'A',
          explanation: q.explanation || 'No explanation provided.',
          confidence: q.confidence || 1.0
        }));

        combinedQuestions.push(...tagged);
      }
    }

    if (combinedQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid questions could be pulled from the selected sources.'
      });
    }

    // Final shuffle of combined questions across all selected sources
    combinedQuestions = shuffleArray(combinedQuestions);

    // Re-index question numbers sequentially (1 to N)
    combinedQuestions.forEach((q, idx) => {
      q.questionNumber = idx + 1;
    });

    const isStandardTarget = destinationCategory === 'standard';
    const defaultTitlePrefix = isStandardTarget ? 'Standard Practice Test' : 'Custom Combined Quiz';

    const quizTitle = (title && title.trim()) ? title.trim() : `${defaultTitlePrefix} (${combinedQuestions.length} Qs)`;
    const quizSubject = (subject && subject.trim()) ? subject.trim() : 'Mixed Practice';
    const quizDescription = (description && description.trim()) ? description.trim() : `Quiz combining questions from ${sources.length} sources.`;

    let createdQuizDoc = null;

    if (saveAsQuiz) {
      createdQuizDoc = new Quiz({
        title: quizTitle,
        subject: quizSubject,
        description: quizDescription,
        questions: combinedQuestions,
        questionCount: combinedQuestions.length,
        isCustom: !isStandardTarget,
        creator: isStandardTarget ? 'admin' : 'user',
        userId: isStandardTarget ? null : activeUserId
      });
      await createdQuizDoc.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Custom quiz generated successfully',
      quiz: createdQuizDoc || {
        _id: 'custom-' + Date.now(),
        title: quizTitle,
        subject: quizSubject,
        description: quizDescription,
        questionCount: combinedQuestions.length,
        questions: combinedQuestions
      }
    });

  } catch (error) {
    console.error('Error generating custom quiz:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error generating custom quiz' });
  }
};

module.exports = {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  addQuestionToQuiz,
  updateQuestionInQuiz,
  deleteQuestionFromQuiz,
  getAvailableSources,
  generateCustomQuiz
};

