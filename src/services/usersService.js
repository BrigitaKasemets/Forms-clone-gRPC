import grpc from '@grpc/grpc-js';
import { verifyToken } from '../utils/auth.js';
import { UserModel } from '../models/userModel.js';

export const UsersServiceImpl = {
  // Create a new user (register)
  async CreateUser(call, callback) {
    try {
      const { email, password, name } = call.request;
      
      // Validate input
      if (!email || !password || !name) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Email, password, and name are required'
        });
      }

      // Check email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Invalid email format'
        });
      }

      // Check password length
      if (password.length < 6) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Password must be at least 6 characters'
        });
      }

      try {
        const user = await UserModel.create(email, password, name);
        
        callback(null, {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          passwordUpdated: false
        });
      } catch (error) {
        if (error.message === 'Email already exists') {
          return callback({
            code: grpc.status.ALREADY_EXISTS,
            message: 'Email already exists'
          });
        }
        throw error;
      }

    } catch (error) {
      console.error('CreateUser error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Get a user by ID
  async GetUser(call, callback) {
    try {
      const { userId, token } = call.request;
      
      // Validate authentication
      const authenticatedUser = await verifyToken(token);
      if (!authenticatedUser) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      // Only allow users to fetch their own data or admin users
      if (authenticatedUser.id.toString() !== userId.toString() && authenticatedUser.role !== 'admin') {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'You can only access your own user data'
        });
      }

      try {
        const user = await UserModel.getById(userId);
        
        callback(null, {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          passwordUpdated: false // This will need a more sophisticated way to track in a real app
        });
      } catch (error) {
        if (error.message === 'User not found') {
          return callback({
            code: grpc.status.NOT_FOUND,
            message: 'User not found'
          });
        }
        throw error;
      }

    } catch (error) {
      console.error('GetUser error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // List all users (admin only feature)
  async ListUsers(call, callback) {
    try {
      const { token } = call.request;
      
      // Validate authentication
      const authenticatedUser = await verifyToken(token);
      if (!authenticatedUser) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      // In a real application, you would check for admin role here
      // For this demo, we'll allow all authenticated users to list users
      
      const users = await UserModel.getAll();
      
      const formattedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        passwordUpdated: false
      }));

      callback(null, { users: formattedUsers });

    } catch (error) {
      console.error('ListUsers error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Update a user
  async UpdateUser(call, callback) {
    try {
      const { userId, email, password, name, token } = call.request;
      
      // Validate authentication
      const authenticatedUser = await verifyToken(token);
      if (!authenticatedUser) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      // Only allow users to update their own data
      if (authenticatedUser.id.toString() !== userId.toString()) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'You can only update your own user data'
        });
      }

      const userData = {};
      let passwordUpdated = false;
      
      if (email !== undefined && email !== '') {
        // Check email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Invalid email format'
          });
        }
        userData.email = email;
      }
      
      if (password !== undefined && password !== '') {
        // Check password length
        if (password.length < 6) {
          return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Password must be at least 6 characters'
          });
        }
        userData.password = password;
        passwordUpdated = true;
      }
      
      if (name !== undefined && name !== '') userData.name = name;

      try {
        const user = await UserModel.update(userId, userData);
        
        callback(null, {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          passwordUpdated
        });
      } catch (error) {
        if (error.message === 'User not found') {
          return callback({
            code: grpc.status.NOT_FOUND,
            message: 'User not found'
          });
        }
        throw error;
      }

    } catch (error) {
      console.error('UpdateUser error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Delete a user
  async DeleteUser(call, callback) {
    try {
      const { userId, token } = call.request;
      
      // Validate authentication
      const authenticatedUser = await verifyToken(token);
      if (!authenticatedUser) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      // Only allow users to delete their own account
      if (authenticatedUser.id.toString() !== userId.toString()) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'You can only delete your own account'
        });
      }

      try {
        const deleted = await UserModel.delete(userId);
        
        if (!deleted) {
          return callback({
            code: grpc.status.NOT_FOUND,
            message: 'User not found'
          });
        }

        callback(null, {
          success: true,
          message: 'User deleted successfully'
        });
      } catch (error) {
        throw error;
      }

    } catch (error) {
      console.error('DeleteUser error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  }
};
