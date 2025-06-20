import jwt from 'jsonwebtoken';
// The crypto module is no longer needed as we're using jwt for token generation
import { sessionDb } from '../db/db.js';

// Constants for token configuration
export const TOKEN_EXPIRATION = '24h';

// Secret key for JWT - using environment variable
// For proper security, the JWT_SECRET should be set in the .env file
const JWT_SECRET = process.env.JWT_SECRET;

// Verify JWT_SECRET is available
if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET environment variable is not set! Authentication will fail.');
    // Terminate the application since auth won't work without a secret
    process.exit(1);
}

// Generate a JWT token
const generateToken = (userId, email, name) => {
    // Create payload with available information
    const payload = { 
        userId,
        // Only include email and name if they're provided
        ...(email && { email }),
        ...(name && { name })
    };
    
    return jwt.sign(
        payload, 
        JWT_SECRET, 
        { 
            expiresIn: TOKEN_EXPIRATION,
            // Add issued at timestamp for token freshness tracking
            // and subject for user identification
            subject: userId.toString()
        }
    );
};

// Verify token middleware (JWT authentication)
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Check if token is present
    if (!token || token.trim() === '') {
        return res.status(401).json({ error: 'Empty token provided' });
    }

    try {
        // First verify JWT is valid
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Then check if session exists in database
        const session = await sessionDb.verifySession(token);

        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Add user info to request object - prefer DB values if available,
        // falling back to JWT payload if not
        req.user = {
            id: session.userId,
            email: session.email || decoded.email,
            name: session.name || decoded.name,
            token
        };
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Invalid token' });
        } else if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Session management functions
export const sessions = {
    create: async (userId, email = null, name = null) => {
        // Generate JWT with user details
        const token = generateToken(userId, email, name);
        
        // Store the session token in the database
        await sessionDb.createSession(userId, token);
        
        // Return structure should match the Session schema in OpenAPI
        return { 
            token, 
            user: {
                id: userId,
                email,
                name
            }
        };
    },

    verify: async (token) => {
        try {
            // Verify the JWT
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Also check if session exists in database
            const session = await sessionDb.verifySession(token);
            if (!session) {
                console.warn('JWT is valid but no session found in database for token');
                return null;
            }
            return session.userId;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                console.warn('Token expired:', error.message);
            } else if (error instanceof jwt.JsonWebTokenError) {
                console.warn('Invalid token:', error.message);
            } else {
                console.error('Token verification error:', error);
            }
            return null;
        }
    },

    remove: async (token) => {
        await sessionDb.deleteSession(token);
    }
};