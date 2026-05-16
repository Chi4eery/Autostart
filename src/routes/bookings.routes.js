const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const {
  createBooking,
  cancelBooking,
  getMyBookings,
  getBookings
} = require('../controllers/bookings.controller');

const router = express.Router();

router.post('/', authenticate, authorizeRoles('Student'), createBooking);
router.get('/my', authenticate, getMyBookings);
router.put('/:id/cancel', authenticate, authorizeRoles('Student', 'Admin'), cancelBooking);
router.get('/', authenticate, authorizeRoles('Admin'), getBookings);

module.exports = router;
