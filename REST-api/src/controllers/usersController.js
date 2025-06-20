import { UserModel } from '../models/userModel.js';

export const UsersController = {
    // Create a new user
    createUser: async (req, res) => {
        try {
            const { email, password, name } = req.body;
            const user = await UserModel.create(email, password, name);
            res.status(201).json(user);
        } catch (error) {
            if (error.message === 'Email already exists') {
                res.status(400).json({ error: error.message });
            } else {
                console.error('User creation error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    },

    // Get all users
    getAllUsers: async (req, res) => {
        try {
            const users = await UserModel.getAll();
            res.status(200).json(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get user by ID
    getUserById: async (req, res) => {
        try {
            const user = await UserModel.getById(req.params.id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.status(200).json(user);
        } catch (error) {
            console.error(`Error fetching user ${req.params.id}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update a user
    updateUser: async (req, res) => {
        try {
            // Log the request body to verify password is included
            console.log('User update request body:', {
                ...req.body,
                password: req.body.password ? '[REDACTED]' : undefined
            });

            const updatedUser = await UserModel.update(req.params.id, req.body);
            if (!updatedUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Indicate password changed if it was included in the request
            const response = {
                ...updatedUser,
                passwordChanged: req.body.password ? true : false
            };

            res.status(200).json(response);
        } catch (error) {
            console.error(`Error updating user ${req.params.id}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Delete a user
    deleteUser: async (req, res) => {
        try {
            const result = await UserModel.delete(req.params.id);
            if (!result) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.status(204).send();
        } catch (error) {
            console.error(`Error deleting user ${req.params.id}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
