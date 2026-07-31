const express = require('express');
const router = express.Router();
const { getQuestionExplanation, handleAiChat } = require('../controllers/aiController');

router.post('/explain', getQuestionExplanation);
router.post('/chat', handleAiChat);

module.exports = router;
