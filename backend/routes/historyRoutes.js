const express = require('express');
const router = express.Router();
const {
  saveHistoryAttempt,
  getAllHistory,
  getHistoryById,
  deleteHistoryAttempt
} = require('../controllers/historyController');

router.post('/', saveHistoryAttempt);
router.get('/', getAllHistory);
router.get('/:id', getHistoryById);
router.delete('/:id', deleteHistoryAttempt);

module.exports = router;
