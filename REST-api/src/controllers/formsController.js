import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';
import { FormModel } from '../models/formModel.js';

// Loome express routeri, et defineerida teed
export const router = express.Router();

// Validation middleware - kontrollib, kas vormi andmed on õiged
const validateForm = (req, res, next) => {
    const { title, description, questions } = req.body;
    const errors = [];

    // Kontrollime, kas kõik vajalikud andmed on olemas
    if (!title) {
        errors.push({ field: 'title', message: 'Title is required' });
    }

    if (!description) {
        errors.push({ field: 'description', message: 'Description is required' });
    }

    // Kui on vigu, siis tagastame need vastuses
    if (errors.length > 0) {
        return res.status(400).json({
            code: 400,
            message: 'Validation failed',
            details: errors
        });
    }

    // Kui kõik on korras, läheme järgmisse middleware'i
    next();
};

// FormsController klass, mis sisaldab kõiki formaadiga seotud tegevusi
export class FormsController {
    // Create a new form
    static async createForm(req, res) {
        try {
            // Add the userId from the authenticated request
            const formData = {
                ...req.body,
                userId: req.user.id
            };
            const form = await FormModel.create(formData);
            res.status(201).json(form);
        } catch (error) {
            console.error('Form creation error:', error);
            res.status(500).json({ code: 500, message: 'Internal server error', details: [{ message: error.message }] });
        }
    }

    // Get all forms
    static async getForms(req, res) {
        try {
            // Fetch all forms
            const forms = await FormModel.findAll();
            
            // Check if forms exists before filtering
            const userForms = forms ? forms.filter(form => form.userId === req.user.id) : [];
            
            return res.json({
                data: userForms
            });
        } catch (error) {
            console.error('Error getting forms:', error);
            return res.status(500).json({
                code: 500,
                message: 'Internal server error',
                details: [{ message: error.message }]
            });
        }
    }

    // Get form by ID
    static async getFormById(req, res) {
        try {
            const form = await FormModel.findById(req.params.id);
            if (!form) {
                return res.status(404).json({ code: 404, message: 'Form not found', details: [{ message: `Form with ID ${req.params.id} does not exist` }] });
            }
            res.json(form);
        } catch (error) {
            console.error('Error fetching form by ID:', error);
            res.status(500).json({ code: 500, message: 'Internal server error', details: [{ message: error.message }] });
        }
    }

    // Update form by ID
    static async updateForm(req, res) {
        try {
            const formData = {
                ...req.body,
                userId: req.user.id
            };
            const form = await FormModel.update(req.params.id, formData);
            if (!form) {
                return res.status(404).json({ code: 404, message: 'Form not found', details: [{ message: `Form with ID ${req.params.id} does not exist` }] });
            }
            res.json(form);
        } catch (error) {
            console.error('Error updating form:', error);
            res.status(500).json({ code: 500, message: 'Internal server error', details: [{ message: error.message }] });
        }
    }

    // Delete form by ID
    static async deleteForm(req, res) {
        try {
            const deleted = await FormModel.delete(req.params.id);
            if (!deleted) {
                return res.status(404).json({ code: 404, message: 'Form not found', details: [{ message: `Form with ID ${req.params.id} does not exist` }] });
            }
            res.status(204).send();
        } catch (error) {
            console.error('Error deleting form:', error);
            res.status(500).json({ code: 500, message: 'Internal server error', details: [{ message: error.message }] });
        }
    }
}