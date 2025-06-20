import jwt from 'jsonwebtoken';
import { userDb, sessionDb } from '../db/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

export const createSession = async (userId) => {
  try {
    // Generate token
    const token = generateToken(userId);
    
    // Store token in database
    await sessionDb.createSession(userId, token);
    
    return token;
  } catch (error) {
    console.error('Session creation error:', error);
    throw error;
  }
};

export const verifyToken = async (token) => {
  try {
    if (!token) {
      return null;
    }

    // First verify the token signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if session exists in database (this is crucial for logout functionality)
    const session = await sessionDb.verifySession(token);
    
    if (!session) {
      return null; // Session doesn't exist or has been invalidated
    }
    
    return {
      id: session.userId,
      email: session.email,
      name: session.name
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
};

export const invalidateSession = async (token) => {
  try {
    await sessionDb.deleteSession(token);
    return true;
  } catch (error) {
    console.error('Session invalidation error:', error);
    throw error;
  }
};
