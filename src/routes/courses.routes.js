const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse
} = require('../controllers/courses.controller');

const router = express.Router();

router.get('/', getCourses);
router.post('/', authenticate, authorizeRoles('Admin'), createCourse);
router.put('/:id', authenticate, authorizeRoles('Admin'), updateCourse);
router.delete('/:id', authenticate, authorizeRoles('Admin'), deleteCourse);

module.exports = router;
