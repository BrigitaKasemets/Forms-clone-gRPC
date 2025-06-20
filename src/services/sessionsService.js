import grpc from '@grpc/grpc-js';
import { userDb } from '../db/db.js';
import { createSession, verifyToken, invalidateSession } from '../utils/auth.js';
import { UserModel } from '../models/userModel.js';

export const SessionsServiceImpl = {
  // Create a new session (login)
  async CreateSession(call, callback) {
    try {
      const { email, password } = call.request;
      
      // Validate input
      if (!email || !password) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Email and password are required'
        });
      }

      // Verify user credentials
      const user = await userDb.verifyUser(email, password);
      
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid email or password'
        });
      }

      // Generate and store session token securely
      const token = await createSession(user.id);

      // Store session (now properly stored in database)
      
      callback(null, {
        token,
        userId: user.id.toString()
      });

    } catch (error) {
      console.error('CreateSession error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Delete a session (logout)
  async DeleteSession(call, callback) {
    try {
      const { token } = call.request;
      
      // Validate token (even though we're logging out, we still want to make sure it's valid)
      const user = await verifyToken(token);
      
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      // Actually invalidate the token in the database - this is crucial for security!
      await invalidateSession(token);
      
      callback(null, {
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('DeleteSession error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Validate a session token
  async ValidateSession(call, callback) {
    try {
      const { token } = call.request;
      
      // Validate token
      const user = await verifyToken(token);
      
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      // Get full user data from database to include timestamps
      try {
        const fullUser = await UserModel.getById(user.id);
        
        // Return complete user info with timestamps
        callback(null, {
          id: fullUser.id,
          email: fullUser.email,
          name: fullUser.name,
          createdAt: fullUser.createdAt,
          updatedAt: fullUser.updatedAt
        });
      } catch (dbError) {
        // Fallback if database query fails
        callback(null, {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          createdAt: '',
          updatedAt: ''
        });
      }

    } catch (error) {
      console.error('ValidateSession error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  }
};
