const User = require('../models/User');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (!existingAdmin) {
      // Create default admin user
      const adminUser = new User({
        name: 'Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'Admin123!',
        role: 'admin',
        isActive: true,
        isVerified: true,
        shortBio: 'Campaign Administrator',
        bio: 'I am the campaign administrator for Sarah Johnson 2024.',
        position: 'Campaign Manager',
        preferences: {
          emailNotifications: true,
          commentModeration: true,
          language: 'en',
          timezone: 'UTC'
        }
      });
      
      await adminUser.save();
      console.log('✅ Default admin user created successfully');
      console.log(`📧 Email: ${adminUser.email}`);
      console.log(`🔑 Password: ${process.env.ADMIN_PASSWORD || 'Admin123!'}`);
      console.log('⚠️  Please change the password after first login!');
    } else {
      console.log('✅ Admin user already exists');
      console.log(`📧 Email: ${existingAdmin.email}`);
    }
  } catch (error) {
    console.error('❌ Error seeding admin user:', error.message);
  }
};

module.exports = seedAdmin;