const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const {
  getUsers,
  getRoles,
  getCurrentUser,
  getStaffContacts,
  updateUser
} = require('../controllers/users.controller');

const router = express.Router();

router.get('/me', authenticate, getCurrentUser);
router.get('/staff-contacts', authenticate, authorizeRoles('Student', 'Instructor', 'Admin'), getStaffContacts);
router.get('/roles', authenticate, authorizeRoles('Admin'), getRoles);
router.get('/', authenticate, authorizeRoles('Admin'), getUsers);
router.put('/:id', authenticate, authorizeRoles('Admin'), updateUser);

module.exports = router;
