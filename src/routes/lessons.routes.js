const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const {
  getLessons,
  createLesson,
  updateLesson,
  deleteLesson
} = require('../controllers/lessons.controller');

const router = express.Router();

router.get('/', getLessons);
router.post('/', authenticate, authorizeRoles('Admin'), createLesson);
router.put('/:id', authenticate, authorizeRoles('Admin'), updateLesson);
router.delete('/:id', authenticate, authorizeRoles('Admin'), deleteLesson);

module.exports = router;
