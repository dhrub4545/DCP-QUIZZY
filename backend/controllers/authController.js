const User = require('../models/User');
const crypto = require('crypto');
const { generateToken } = require('../utils/jwt');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password)
    });

    await user.save();

    const token = generateToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email
    });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
