import jwt from 'jsonwebtoken';
import { userDb } from '../db/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = async (token) => {
  try {
    if (!token) {
      return null;
    }

    // Verify the token signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get the user from the database
    const user = await userDb.getUserById(decoded.userId);
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
};
