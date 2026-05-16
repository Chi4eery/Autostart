const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const { markBookingProgress } = require('../controllers/progress.controller');

const router = express.Router();

router.put('/bookings/:id', authenticate, authorizeRoles('Admin', 'Instructor'), markBookingProgress);

module.exports = router;
