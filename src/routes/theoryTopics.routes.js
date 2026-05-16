const express = require('express');
const { getTheoryTopics } = require('../controllers/theoryTopics.controller');

const router = express.Router();

router.get('/', getTheoryTopics);

module.exports = router;
