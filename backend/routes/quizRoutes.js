const express = require('express');
const router = express.Router();
const {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  addQuestionToQuiz,
  updateQuestionInQuiz,
  deleteQuestionFromQuiz,
  getAvailableSources,
  generateCustomQuiz,
  getQuestionsByTopic,
  getStudyStructure
} = require('../controllers/quizController');

// Sources, Custom Quiz Generation & Topic-Wise Extraction (Must precede parametric :id routes)
router.get('/study-structure', getStudyStructure);
router.get('/sources', getAvailableSources);
router.get('/topic/:topicName', getQuestionsByTopic);
router.post('/generate-custom', generateCustomQuiz);

// Quiz CRUD routes
router.post('/', createQuiz);
router.get('/', getAllQuizzes);
router.get('/:id', getQuizById);
router.put('/:id', updateQuiz);
router.delete('/:id', deleteQuiz);

// Question CRUD routes
router.post('/:id/questions', addQuestionToQuiz);
router.put('/:id/questions/:questionId', updateQuestionInQuiz);
router.delete('/:id/questions/:questionId', deleteQuestionFromQuiz);

module.exports = router;
