import { userDb } from '../db/db.js';

export const UserModel = {
    create: async (email, password, name) => {
        try {
            const user = await userDb.createUser(email, password, name);
            // Align with OpenAPI User schema
            return {
                id: user.id.toString(),
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };
        } catch (error) {
            throw error; // Re-throw for controller to handle
        }
    },

    getAll: async () => {
        try {
            const users = await userDb.getAllUsers();
            // Align with OpenAPI User schema
            return users.map(user => ({
                id: user.id.toString(),
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }));
        } catch (error) {
            throw error;
        }
    },

    getById: async (id) => {
        try {
            const user = await userDb.getUserById(id);
            // Align with OpenAPI User schema
            return {
                id: user.id.toString(),
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };
        } catch (error) {
            throw error;
        }
    },

    update: async (id, userData) => {
        try {
            const user = await userDb.updateUser(id, userData);
            // Align with OpenAPI User schema
            return {
                id: user.id.toString(),
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };
        } catch (error) {
            throw error;
        }
    },

    delete: async (id) => {
        try {
            const result = await userDb.deleteUser(id);
            return result;
        } catch (error) {
            throw error;
        }
    }
};