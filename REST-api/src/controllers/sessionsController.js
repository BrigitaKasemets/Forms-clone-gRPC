import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { userDb } from '../db/db.js';
import { TOKEN_EXPIRATION } from '../middleware/auth.js';

// Use the same JWT secret as in auth.js
const JWT_SECRET = process.env.JWT_SECRET;

export const SessionsController = {
    // Login user and create a session
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            
            // Verify user with email and password
            const user = await userDb.verifyUser(email, password);
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Generate JWT token
            const token = jwt.sign(
                { id: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRATION }
            );

            // Send the token
            res.status(201).json({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Logout user
    logout: async (req, res) => {
        // With JWT, logout happens client-side by removing the token
        // This endpoint is mostly for API completeness
        res.status(200).send();
    },

    // Validate token and return user info
    validateSession: async (req, res) => {
        try {
            // User info is already loaded by authenticateToken middleware
            const userId = req.user.id;
            const user = await userDb.getUserById(userId);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Return user data without password
            res.status(200).json({
                id: user.id,
                email: user.email,
                name: user.name
            });
        } catch (error) {
            console.error('Session validation error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
