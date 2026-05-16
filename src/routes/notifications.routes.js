const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const {
  getMyNotifications,
  markNotificationRead,
  createNotification
} = require('../controllers/notifications.controller');

const router = express.Router();

router.get('/my', authenticate, getMyNotifications);
router.put('/:id/read', authenticate, markNotificationRead);
router.post('/', authenticate, authorizeRoles('Admin'), createNotification);

module.exports = router;
