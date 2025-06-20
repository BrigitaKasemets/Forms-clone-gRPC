import { ResponseModel } from '../models/responseModel.js';

export const ResponsesController = {
    // Get all responses for a form
    getAllResponses: async (req, res) => {
        try {
            const formId = req.params.formId;
            const responses = await ResponseModel.findAll(formId);
            res.status(200).json(responses);
        } catch (error) {
            console.error(`Error fetching responses for form ${req.params.formId}:`, error);
            
            if (error.message === 'Form not found') {
                return res.status(404).json({ error: 'Form not found' });
            }
            
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get a specific response
    getResponseById: async (req, res) => {
        try {
            const { formId, responseId } = req.params;
            const response = await ResponseModel.findById(formId, responseId);
            
            if (!response) {
                return res.status(404).json({ error: 'Response not found' });
            }
            
            res.status(200).json(response);
        } catch (error) {
            console.error(`Error fetching response ${req.params.responseId}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Create a new response
    createResponse: async (req, res) => {
        try {
            const formId = req.params.formId;
            const responseData = req.body; // Contains answers array as required in OpenAPI
            
            const response = await ResponseModel.create(formId, responseData);
            res.status(201).json(response);
        } catch (error) {
            console.error(`Error creating response for form ${req.params.formId}:`, error);
            
            if (error.message === 'Form not found') {
                return res.status(404).json({ error: 'Form not found' });
            } else if (error.message.includes('Question with ID') && error.message.includes('not found')) {
                return res.status(400).json({ error: error.message });
            } else if (error.message.includes('At least one answer is required')) {
                return res.status(400).json({ error: error.message });
            }
            
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update a response
    updateResponse: async (req, res) => {
        try {
            const { formId, responseId } = req.params;
            const responseData = req.body; // Contains answers array as specified in OpenAPI
            
            const updatedResponse = await ResponseModel.update(formId, responseId, responseData);
            
            if (!updatedResponse) {
                return res.status(404).json({ error: 'Response not found' });
            }
            
            res.status(200).json(updatedResponse);
        } catch (error) {
            console.error(`Error updating response ${req.params.responseId}:`, error);
            
            if (error.message.includes('Question with ID') && error.message.includes('not found')) {
                return res.status(400).json({ error: error.message });
            }
            
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Delete a response
    deleteResponse: async (req, res) => {
        try {
            const { formId, responseId } = req.params;
            const result = await ResponseModel.delete(formId, responseId);
            
            if (!result) {
                return res.status(404).json({ error: 'Response not found' });
            }
            
            res.status(204).send();
        } catch (error) {
            console.error(`Error deleting response ${req.params.responseId}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
