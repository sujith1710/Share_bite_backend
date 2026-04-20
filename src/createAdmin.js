/**
 * One-time script to create an admin account in MongoDB.
 * Run with: node src/createAdmin.js
 * Delete this file after use for security.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const ADMIN_EMAIL = 'admin@sharebite.com';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMIN_NAME = 'Super Admin';

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  const existing = await Admin.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log('⚠️  Admin already exists:', ADMIN_EMAIL);
    process.exit(0);
  }

  const admin = new Admin({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  await admin.save();
  console.log('🎉 Admin created successfully!');
  console.log('   Email   :', ADMIN_EMAIL);
  console.log('   Password:', ADMIN_PASSWORD);
  process.exit(0);
}

createAdmin().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
