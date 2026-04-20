const express = require('express');
const router = express.Router();
const {
  loginAdmin,
  getPendingUsers,
  getAllUsers,
  approveUser,
  rejectUser,
  deleteUser,
} = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/adminMiddleware');

// Public: admin login
router.post('/login', loginAdmin);

// Protected admin routes
router.get('/pending', protectAdmin, getPendingUsers);
router.get('/all', protectAdmin, getAllUsers);
router.patch('/approve/:type/:id', protectAdmin, approveUser);
router.patch('/reject/:type/:id', protectAdmin, rejectUser);
router.delete('/delete/:type/:id', protectAdmin, deleteUser);

module.exports = router;
