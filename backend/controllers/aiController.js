const { generateAiExplanation, chatWithAiTutor } = require('../services/aiService');

/**
 * @desc    Generate AI Explanation for a question
 * @route   POST /api/ai/explain
 */
const getQuestionExplanation = async (req, res) => {
  try {
    const { questionText, options, correctAnswerLetter, explanation } = req.body;

    if (!questionText) {
      return res.status(400).json({ success: false, message: 'questionText is required.' });
    }

    const aiExplanation = await generateAiExplanation({
      questionText,
      options,
      correctAnswerLetter,
      explanation
    });

    return res.status(200).json({
      success: true,
      explanation: aiExplanation
    });
  } catch (error) {
    console.error('Error generating AI explanation:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error generating AI explanation'
    });
  }
};

/**
 * @desc    Chat with AI Tutor for a question
 * @route   POST /api/ai/chat
 */
const handleAiChat = async (req, res) => {
  try {
    const { questionContext, chatHistory, userMessage, imageBase64, image } = req.body;

    if (!userMessage && !imageBase64 && !image) {
      return res.status(400).json({ success: false, message: 'userMessage or image is required.' });
    }

    const reply = await chatWithAiTutor({
      questionContext,
      chatHistory: Array.isArray(chatHistory) ? chatHistory : [],
      userMessage: userMessage || 'Please analyze this image for me.',
      imageBase64: imageBase64 || image || null
    });

    return res.status(200).json({
      success: true,
      reply
    });
  } catch (error) {
    console.error('Error handling AI tutor chat:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error in AI tutor chat'
    });
  }
};

module.exports = {
  getQuestionExplanation,
  handleAiChat
};
