const express = require('express');
const authenticate = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');
const {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial
} = require('../controllers/materials.controller');

const router = express.Router();

router.get('/', authenticate, authorizeRoles('Student', 'Instructor', 'Admin'), getMaterials);
router.post('/', authenticate, authorizeRoles('Admin'), createMaterial);
router.put('/:id', authenticate, authorizeRoles('Admin'), updateMaterial);
router.delete('/:id', authenticate, authorizeRoles('Admin'), deleteMaterial);

module.exports = router;
