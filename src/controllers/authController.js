const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (userId, userRole) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign({ id: userId, role: userRole }, secret, { expiresIn: '7d' });
};

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, role } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    // Create user with status = 'pending' (default in schema)
    const user = await User.create({ name, email, password, role });

    res.status(201).json({
      message: 'Registration successful! Your account is pending admin approval. You will be able to log in once approved.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Block login if not approved (also treat missing/null status as pending)
    if (!user.status || user.status === 'pending') {
      return res.status(403).json({ message: 'Your account is pending admin approval. Please wait for the admin to approve your registration.' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Your account registration has been rejected by the admin. Please contact support.' });
    }

    const token = generateToken(user._id, user.role);
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status }, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
