const History = require('../models/History');

/**
 * @desc    Save a completed test attempt to History
 * @route   POST /api/history
 */
const saveHistoryAttempt = async (req, res) => {
  try {
    const {
      quizId,
      quizTitle,
      subject,
      score,
      totalQuestions,
      correctCount,
      incorrectCount,
      accuracyPercentage,
      timeTakenSeconds,
      questionBreakdown
    } = req.body;

    if (!quizId || !quizTitle) {
      return res.status(400).json({ success: false, message: 'quizId and quizTitle are required.' });
    }

    const userId = req.user?.id ? String(req.user.id) : 'guest';

    const newHistory = new History({
      userId,
      quizId,
      quizTitle,
      subject: subject || 'General',
      score: score || 0,
      totalQuestions: totalQuestions || 0,
      correctCount: correctCount || 0,
      incorrectCount: incorrectCount || 0,
      accuracyPercentage: accuracyPercentage || 0,
      timeTakenSeconds: timeTakenSeconds || 0,
      questionBreakdown: Array.isArray(questionBreakdown) ? questionBreakdown : []
    });

    await newHistory.save();

    return res.status(201).json({
      success: true,
      message: 'Test attempt saved to history successfully',
      history: newHistory
    });
  } catch (error) {
    console.error('Error saving test history:', error);
    return res.status(500).json({ success: false, message: 'Server error saving test history' });
  }
};

/**
 * @desc    Get user-specific past test attempts
 * @route   GET /api/history
 */
const getAllHistory = async (req, res) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : 'guest';

    let query = {};
    if (userId === 'guest') {
      query = {
        $or: [
          { userId: 'guest' },
          { userId: { $exists: false } },
          { userId: null }
        ]
      };
    } else {
      query = { userId };
    }

    const historyList = await History.find(query).sort({ completedAt: -1 });
    return res.status(200).json({
      success: true,
      count: historyList.length,
      history: historyList
    });
  } catch (error) {
    console.error('Error fetching test history:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching test history' });
  }
};

/**
 * @desc    Get a single test attempt details by ID
 * @route   GET /api/history/:id
 */
const getHistoryById = async (req, res) => {
  try {
    const attempt = await History.findById(req.params.id);
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'History attempt not found' });
    }
    return res.status(200).json({
      success: true,
      history: attempt
    });
  } catch (error) {
    console.error('Error fetching history by ID:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching history attempt' });
  }
};

/**
 * @desc    Delete a past test attempt from history
 * @route   DELETE /api/history/:id
 */
const deleteHistoryAttempt = async (req, res) => {
  try {
    const attempt = await History.findByIdAndDelete(req.params.id);
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'History attempt not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'History attempt deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting history attempt:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting history attempt' });
  }
};

module.exports = {
  saveHistoryAttempt,
  getAllHistory,
  getHistoryById,
  deleteHistoryAttempt
};
