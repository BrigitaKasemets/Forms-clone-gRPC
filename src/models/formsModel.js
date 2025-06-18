import { formDb } from '../db/db.js';

export const FormModel = {
    create: async (formData) => {
        // Make sure userId is available in the formData
        if (!formData.userId) {
            throw new Error('User ID is required to create a form');
        }

        const form = await formDb.createForm(
            formData.userId,
            formData.title, 
            formData.description
        );
        
        return {
            id: form.id,
            title: form.title,
            description: form.description,
            userId: form.userId,
            createdAt: form.createdAt,
            updatedAt: form.updatedAt
        };
    },

    findAll: async () => {
        try {
            const forms = await formDb.getAllForms();

            if (!forms || forms.length === 0) {
                // Log and return an empty array or handle appropriately
                console.warn('No forms found');
                return [];
            }

            return forms;

        } catch (error) {
            console.error('Error fetching forms:', error);
            throw error; // this is still meaningful if error originates from getAllForms
        }
    },


    findById: async (id) => {
        try {
            return await formDb.getFormById(id);
        } catch (error) {
            if (error.message === 'Form not found') {
                return null;
            }
            throw error;
        }
    },

    update: async (id, formData) => {
        try {
            return await formDb.updateForm(
                id,
                formData.title,
                formData.description
            );
        } catch (error) {
            if (error.message === 'Form not found') {
                return null;
            }
            throw error;
        }
    },

    delete: async (id) => {
        try {
            return await formDb.deleteForm(id);
        } catch (error) {
            console.error('Error deleting form:', error);
            return false;
        }
    }
};