const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Ngo = require('../models/Ngo');
const FoodListing = require('../models/FoodListing');

const generateAdminToken = (id) =>
  jwt.sign({ id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/admin/login
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: 'Invalid admin credentials' });

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid admin credentials' });

    const token = generateAdminToken(admin._id);
    res.json({ admin: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' }, token });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/pending  — list all pending users + NGOs
// Also includes records where status field is missing/null (pre-existing accounts)
const PENDING_QUERY = {
  $or: [
    { status: 'pending' },
    { status: { $exists: false } },
    { status: null },
  ],
};

exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.find(PENDING_QUERY).select('-password').sort({ createdAt: -1 });
    const ngos = await Ngo.find(PENDING_QUERY).select('-password').sort({ createdAt: -1 });

    res.json({
      users: users.map(u => ({ ...u.toObject(), accountType: 'user' })),
      ngos: ngos.map(n => ({ ...n.toObject(), accountType: 'ngo' })),
    });
  } catch (err) {
    console.error('getPendingUsers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/all  — list all users + NGOs with any status
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const ngos = await Ngo.find().select('-password').sort({ createdAt: -1 });

    res.json({
      users: users.map(u => ({ ...u.toObject(), accountType: 'user' })),
      ngos: ngos.map(n => ({ ...n.toObject(), accountType: 'ngo' })),
    });
  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/admin/approve/:type/:id  — approve a user or ngo
exports.approveUser = async (req, res) => {
  const { type, id } = req.params;
  try {
    let record;
    if (type === 'user') {
      record = await User.findByIdAndUpdate(id, { status: 'approved' }, { new: true }).select('-password');
    } else if (type === 'ngo') {
      record = await Ngo.findByIdAndUpdate(id, { status: 'approved' }, { new: true }).select('-password');
    } else {
      return res.status(400).json({ message: 'Invalid type. Use "user" or "ngo".' });
    }

    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: `${type.toUpperCase()} approved successfully`, record });
  } catch (err) {
    console.error('approveUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/admin/reject/:type/:id  — reject a user or ngo
exports.rejectUser = async (req, res) => {
  const { type, id } = req.params;
  try {
    let record;
    if (type === 'user') {
      record = await User.findByIdAndUpdate(id, { status: 'rejected' }, { new: true }).select('-password');
    } else if (type === 'ngo') {
      record = await Ngo.findByIdAndUpdate(id, { status: 'rejected' }, { new: true }).select('-password');
    } else {
      return res.status(400).json({ message: 'Invalid type. Use "user" or "ngo".' });
    }

    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: `${type.toUpperCase()} rejected`, record });
  } catch (err) {
    console.error('rejectUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/admin/delete/:type/:id  — delete a user or ngo
exports.deleteUser = async (req, res) => {
  const { type, id } = req.params;
  try {
    if (type === 'user') {
      await User.findByIdAndDelete(id);
    } else if (type === 'ngo') {
      await Ngo.findByIdAndDelete(id);
    } else {
      return res.status(400).json({ message: 'Invalid type. Use "user" or "ngo".' });
    }
    res.json({ message: `${type.toUpperCase()} deleted successfully` });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Food Listing Approval Logic ---

// GET /api/admin/listings/pending
exports.getPendingFoodListings = async (req, res) => {
  try {
    const listings = await FoodListing.find({ status: 'pending' })
      .populate('donorId', 'name email phone')
      .populate('claimedBy', 'name email phone')
      .sort({ updatedAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error('getPendingFoodListings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/admin/listings/approve/:id
exports.approveFoodListing = async (req, res) => {
  try {
    const listing = await FoodListing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    listing.status = 'reserved';
    await listing.save();

    // Auto-delete after 24 hours (or 20 seconds for testing if you want to see it work)
    setTimeout(async () => {
      try {
        await FoodListing.findByIdAndDelete(listing._id);
        console.log(`Listing ${listing._id} auto-deleted after approval.`);
      } catch (err) {
        console.error(`Error auto-deleting listing ${listing._id}:`, err);
      }
    }, 24 * 60 * 60 * 1000); 

    res.json({ message: 'Claim request approved!', record: listing });
  } catch (err) {
    console.error('approveFoodListing error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/admin/listings/reject/:id
exports.rejectFoodListing = async (req, res) => {
  try {
    const listing = await FoodListing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    listing.status = 'available';
    listing.claimedBy = null;
    await listing.save();

    res.json({ message: 'Claim request rejected. Listing is back to available.', record: listing });
  } catch (err) {
    console.error('rejectFoodListing error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
