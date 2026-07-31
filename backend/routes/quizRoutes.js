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
  generateCustomQuiz
} = require('../controllers/quizController');

// Sources and Custom Quiz Generation (Must precede parametric :id routes)
router.get('/sources', getAvailableSources);
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
