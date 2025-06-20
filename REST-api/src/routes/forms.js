import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { FormModel } from '../models/formModel.js';

const router = express.Router();

// Validation middleware for forms
const validateForm = (req, res, next) => {
    const { title, description } = req.body;
    const errors = [];

    if (!title) {
        errors.push({ field: 'title', message: 'Title is required' });
    }

    // Description is optional, but if provided, validate it
    if (description !== undefined) {
        if (description.length > 500) {
            errors.push({ field: 'description', message: 'Description cannot exceed 500 characters' });
        }
        // You can add more description validations here if needed
    }

    if (errors.length > 0) {
        return res.status(400).json({
            code: 400,
            message: 'Validation failed',
            details: errors
        });
    }

    next();
};

// Create a new form
router.post('/', authenticateToken, validateForm, async (req, res) => {
    try {
        // Add the userId from the authenticated request
        const formData = {
            ...req.body,
            userId: req.user.id
        };
        
        const form = await FormModel.create(formData);
        res.status(201).json(form);
    } catch (error) {
        console.error('Error creating form:', error);
        res.status(500).json({ 
            code: 500, 
            message: 'Internal server error', 
            details: [{ message: error.message }] 
        });
    }
});

// Get all forms
router.get('/', authenticateToken, async (req, res) => {
    try {
        const forms = await FormModel.findAll();
        res.status(200).json(forms);
    } catch (error) {
        // If no forms are found, return a 404 with an informative message
        if (error.message === 'No forms found') {
            return res.status(404).json({
                code: 404,
                message: 'No forms found',
                details: [{ message: 'There are no forms available in the database.' }]
            });
        }

        console.error('Error fetching forms:', error);
        res.status(500).json({
            code: 500,
            message: 'Internal server error',
            details: [{ message: error.message }]
        });
    }
});

// Get a specific form by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const form = await FormModel.findById(req.params.id);
        if (!form) {
            return res.status(404).json({ 
                code: 404, 
                message: 'Form not found', 
                details: [{ message: `Form with ID ${req.params.id} does not exist` }] 
            });
        }
        res.status(200).json(form);
    } catch (error) {
        console.error('Error fetching form:', error);
        res.status(500).json({ 
            code: 500, 
            message: 'Internal server error', 
            details: [{ message: error.message }] 
        });
    }
});

// Update an existing form
router.patch('/:id', authenticateToken, validateForm, async (req, res) => {
    try {
        // Add the userId from the authenticated request
        const formData = {
            ...req.body,
            userId: req.user.id
        };
        
        const form = await FormModel.update(req.params.id, formData);
        if (!form) {
            return res.status(404).json({ 
                code: 404, 
                message: 'Form not found', 
                details: [{ message: `Form with ID ${req.params.id} does not exist` }] 
            });
        }
        res.status(200).json(form);
    } catch (error) {
        console.error('Error updating form:', error);
        res.status(500).json({ 
            code: 500, 
            message: 'Internal server error', 
            details: [{ message: error.message }] 
        });
    }
});

// Delete a form
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const deleted = await FormModel.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ 
                code: 404, 
                message: 'Form not found', 
                details: [{ message: `Form with ID ${req.params.id} does not exist` }] 
            });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting form:', error);
        res.status(500).json({ 
            code: 500, 
            message: 'Internal server error', 
            details: [{ message: error.message }] 
        });
    }
});

export default router;