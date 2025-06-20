import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { userDb } from '../db/db.js';

const router = express.Router();

// Parooli valideerimise funktsioon
const validatePassword = (password) => {
  const errors = [];
  
  // Minimaalne pikkus (vähemalt 8 tähemärki)
  if (password.length < 8) {
    errors.push('Parool peab olema vähemalt 8 tähemärki pikk');
  }
  
  // Nõuded keerukusele - vähemalt 3 järgnevast 4 kategooriast:
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const complexityCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars].filter(Boolean).length;
  
  if (complexityCount < 3) {
    errors.push('Password must be at least 8 characters long, Password must contain at least 3 of the following: uppercase letters, lowercase letters, numbers, special characters');
  }
  
  // Kontrolli, et parool ei oleks liiga lihtne või levinud
  const commonPasswords = ['password', 'password123', '123456', 'qwerty', 'admin', 'welcome', 'parool'];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a different one.');
  }
  
  return errors;
};

// Register new user
router.post('/', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        message: 'Missing required fields: email, password, and name are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Invalid email format'
      });
    }
    
    // Validate password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      // Ühenda kõik veateated üheks sõnumiks vastavalt olemasolevale formaadile
      const errorMessage = 'Password validation failed: ' + passwordErrors.join(', ');
      
      return res.status(400).json({
        message: errorMessage
      });
    }

    const user = await userDb.createUser(email, password, name);

    // Return user with original timestamps
    res.status(201).json(user);
  } catch (error) {
    if (error.message === 'Email already exists') {
      res.status(409).json({ 
        message: 'Email already exists'
      });
    } else {
      console.error('User creation error:', error);
      res.status(500).json({ 
        message: error.message || 'Internal server error'
      });
    }
  }
});

// Get all users
router.get('/', authenticateToken, async (req, res) => {
    try {
        const users = await userDb.getAllUsers();
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register new user
router.post('/', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validate required fields
        if (!email || !password || !name) {
            return res.status(400).json({
                message: 'Missing required fields: email, password, and name are required'
            });
        }

        const user = await userDb.createUser(email, password, name);

        // Return user with original timestamps
        res.status(201).json(user);
    } catch (error) {
        if (error.message === 'Email already exists') {
            res.status(409).json({ error: error.message });
        } else {
            console.error('User creation error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Get user by ID
router.get('/:userId', authenticateToken, async (req, res) => {
    try {
        const user = await userDb.getUserById(req.params.userId);
        res.status(200).json(user);
    } catch (error) {
        if (error.message === 'User not found') {
            res.status(404).json({ error: 'User not found' });
        } else {
            console.error('Error fetching user:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Update user
router.patch('/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        const { email, name, password } = req.body;

        // Create update object with all provided fields
        const updateData = {};
        if (email) updateData.email = email;
        if (name) updateData.name = name;

        // Only include password if it was provided and validate it
        if (password) {
            // Validate password strength if it's being updated
            const passwordErrors = validatePassword(password);
            if (passwordErrors.length > 0) {
                const errorMessage = 'Password validation failed: ' + passwordErrors.join(', ');
                return res.status(400).json({
                    message: errorMessage
                });
            }

            updateData.password = password;
        }

        console.log('Fields being updated:', Object.keys(updateData));

        // Update the user with all provided fields
        const updatedUser = await userDb.updateUser(userId, updateData);

        // Return user with database-provided timestamps
        res.status(200).json({
            ...updatedUser,
            passwordUpdated: !!password
        });
    } catch (error) {
        if (error.message === 'User not found') {
            res.status(404).json({ error: 'User not found' });
        } else {
            console.error('Error updating user:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Delete user
router.delete('/:userId', authenticateToken, async (req, res) => {
    try {
        let userId = req.params.userId;

        // Handle the special "me" identifier by using the authenticated user's ID
        if (userId === 'me') {
            userId = req.user.userId; // Get the ID from the JWT token payload
        }

        // Convert the ID to a number to ensure consistent type comparison with the database
        userId = Number(userId);

        // Validate that we have a valid numeric ID
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const result = await userDb.deleteUser(userId);
        
        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting user ${req.params.userId}:`, error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

export default router;

