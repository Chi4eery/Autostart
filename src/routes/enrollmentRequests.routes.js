const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const {
  createEnrollmentRequest,
  getMyEnrollmentRequests,
  getEnrollmentRequests,
  updateEnrollmentRequestStatus,
  deleteEnrollmentRequest
} = require('../controllers/enrollmentRequests.controller');

const router = express.Router();

router.post('/', authenticate, authorizeRoles('Applicant', 'Student', 'Admin'), createEnrollmentRequest);
router.get('/my', authenticate, authorizeRoles('Applicant', 'Student'), getMyEnrollmentRequests);
router.get('/', authenticate, authorizeRoles('Admin'), getEnrollmentRequests);
router.put('/:id/status', authenticate, authorizeRoles('Admin'), updateEnrollmentRequestStatus);
router.delete('/:id', authenticate, authorizeRoles('Admin'), deleteEnrollmentRequest);

module.exports = router;
