const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const {
  getInstructors,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  getMyInstructorLessons,
  createMyInstructorLesson
} = require('../controllers/instructors.controller');

const router = express.Router();

router.get('/my-lessons', authenticate, authorizeRoles('Instructor', 'Admin'), getMyInstructorLessons);
router.post('/my-lessons', authenticate, authorizeRoles('Instructor'), createMyInstructorLesson);
router.get('/', getInstructors);
router.post('/', authenticate, authorizeRoles('Admin'), createInstructor);
router.put('/:id', authenticate, authorizeRoles('Admin'), updateInstructor);
router.delete('/:id', authenticate, authorizeRoles('Admin'), deleteInstructor);

module.exports = router;
