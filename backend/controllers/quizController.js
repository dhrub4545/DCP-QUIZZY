const Quiz = require('../models/Quiz');

/**
 * @desc    Create a new manual Quiz
 * @route   POST /api/quizzes
 */
const createQuiz = async (req, res) => {
  try {
    const { title, subject, description, questions } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Quiz title is required.' });
    }

    const newQuiz = new Quiz({
      title: title.trim(),
      subject: subject ? subject.trim() : 'General',
      description: description ? description.trim() : '',
      questions: Array.isArray(questions) ? questions : []
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
    const quizzes = await Quiz.find({}, 'title subject description questionCount questions.topic createdAt updatedAt').sort({ createdAt: -1 });
    
    const formattedQuizzes = quizzes.map(q => {
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
        topics: Array.from(topicsSet),
        createdAt: q.createdAt,
        updatedAt: q.updatedAt
      };
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
    const quiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
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
    const { title, subject, description, sources, saveAsQuiz } = req.body;

    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one question source allocation must be provided.'
      });
    }

    let combinedQuestions = [];

    // Helper for Fisher-Yates random sampling
    const sampleRandom = (arr, count) => {
      const clone = [...arr];
      for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
      }
      return clone.slice(0, Math.min(count, clone.length));
    };

    for (const src of sources) {
      const { quizId, count } = src;
      const requestedCount = Number(count) || 0;
      if (!quizId || requestedCount <= 0) continue;

      const quizDoc = await Quiz.findById(quizId);
      if (quizDoc && Array.isArray(quizDoc.questions) && quizDoc.questions.length > 0) {
        const sampled = sampleRandom(quizDoc.questions, requestedCount);
        // Ensure questions retain source topic / subject tag
        const tagged = sampled.map(q => ({
          questionNumber: q.questionNumber,
          topic: q.topic || quizDoc.subject || 'General',
          questionText: q.questionText,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          correctAnswerLetter: q.correctAnswerLetter,
          explanation: q.explanation,
          confidence: q.confidence
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

    // Shuffle final combined questions array
    combinedQuestions = sampleRandom(combinedQuestions, combinedQuestions.length);
    // Re-index question numbers sequentially
    combinedQuestions.forEach((q, idx) => {
      q.questionNumber = idx + 1;
    });

    const quizTitle = (title && title.trim()) ? title.trim() : `Custom Combined Quiz (${combinedQuestions.length} Qs)`;
    const quizSubject = (subject && subject.trim()) ? subject.trim() : 'Custom Mix';
    const quizDescription = (description && description.trim()) ? description.trim() : `Custom generated quiz combining questions from ${sources.length} sources.`;

    let createdQuizDoc = null;

    if (saveAsQuiz) {
      createdQuizDoc = new Quiz({
        title: quizTitle,
        subject: quizSubject,
        description: quizDescription,
        questions: combinedQuestions,
        questionCount: combinedQuestions.length
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

