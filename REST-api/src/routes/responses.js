// routes/responses.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { ResponseModel } from '../models/responseModel.js';

const router = express.Router({ mergeParams: true });

// Validation middleware for responses
const validateResponse = (req, res, next) => {
  const { answers, respondentName, respondentEmail } = req.body;
  const errors = [];

  // Required fields from the OpenAPI spec
  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    errors.push({ field: 'answers', message: 'At least one answer is required' });
  } else {
    // Validate each answer
    const invalidAnswers = answers.filter(answer => {
      return !answer.questionId || answer.answer === undefined;
    });
    
    if (invalidAnswers.length > 0) {
      errors.push({ 
        field: 'answers', 
        message: 'Each answer must have questionId and answer fields' 
      });
    }
  }

  // Optional fields validation
  if (respondentEmail !== undefined && typeof respondentEmail !== 'string') {
    errors.push({ field: 'respondentEmail', message: 'Email must be a string if provided' });
  }
  
  if (respondentName !== undefined && typeof respondentName !== 'string') {
    errors.push({ field: 'respondentName', message: 'Name must be a string if provided' });
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

// Get all responses for a form
router.get('/', authenticateToken, async (req, res) => {
  try {
    const formId = req.params.formId;
    const responses = await ResponseModel.findAll(formId);
    res.status(200).json(responses);
  } catch (error) {
    if (error.message === 'Form not found') {
      return res.status(404).json({ 
        code: 404, 
        message: 'Form not found', 
        details: [{ message: `Form with ID ${req.params.formId} does not exist` }] 
      });
    }
    
    console.error('Error fetching responses:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

// Create a new response
router.post('/', authenticateToken, validateResponse, async (req, res) => {
  try {
    const formId = req.params.formId;
    
    // Create request object with required fields and our extension fields
    const requestData = {
      answers: req.body.answers, // Required by spec
    };
    
    // Explicitly extract respondentName and respondentEmail from the request
    if (req.body.respondentName !== undefined) {
      requestData.respondentName = req.body.respondentName;
    }
    
    if (req.body.respondentEmail !== undefined) {
      requestData.respondentEmail = req.body.respondentEmail;
    }
    
    console.log('Request data being sent to model:', requestData); // Debug log
    
    const response = await ResponseModel.create(formId, requestData);
    res.status(201).json(response);
  } catch (error) {
    if (error.message === 'Form not found') {
      return res.status(404).json({ 
        code: 404, 
        message: 'Form not found', 
        details: [{ message: `Form with ID ${req.params.formId} does not exist` }] 
      });
    }
    
    if (error.message.startsWith('Question with ID')) {
      return res.status(400).json({ 
        code: 400, 
        message: 'Invalid question ID', 
        details: [{ message: error.message }] 
      });
    }
    
    console.error('Error creating response:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

// Get a specific response
router.get('/:responseId', authenticateToken, async (req, res) => {
  try {
    const { formId, responseId } = req.params;
    const response = await ResponseModel.findById(formId, responseId);
    
    if (!response) {
      return res.status(404).json({ 
        code: 404, 
        message: 'Response not found', 
        details: [{ message: `Response with ID ${responseId} does not exist` }] 
      });
    }
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching response:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

// Update a response
router.patch('/:responseId', authenticateToken, async (req, res) => {
  try {
    const { formId, responseId } = req.params;
    
    // Validate answers if they are provided
    if (req.body.answers) {
      const { answers } = req.body;
      
      if (!Array.isArray(answers)) {
        return res.status(400).json({
          code: 400,
          message: 'Validation failed',
          details: [{ field: 'answers', message: 'Answers must be an array' }]
        });
      }
      
      // In update scenario, we allow empty arrays to remove all answers
      if (answers.length > 0) {
        // Validate each answer
        const invalidAnswers = answers.filter(answer => {
          return !answer.questionId || answer.answer === undefined;
        });
        
        if (invalidAnswers.length > 0) {
          return res.status(400).json({
            code: 400,
            message: 'Validation failed',
            details: [{ 
              field: 'answers', 
              message: 'Each answer must have questionId and answer fields' 
            }]
          });
        }
      }
    }
    
    // Create update object with only allowed fields from API spec plus our extensions
    const updateData = {};
    
    if (req.body.answers !== undefined) {
      updateData.answers = req.body.answers;
    }
    
    // Our additional fields (not in OpenAPI spec but useful)
    if (req.body.respondentName !== undefined) {
      updateData.respondentName = req.body.respondentName;
    }
    
    if (req.body.respondentEmail !== undefined) {
      updateData.respondentEmail = req.body.respondentEmail;
    }
    
    const response = await ResponseModel.update(formId, responseId, updateData);
    
    if (!response) {
      return res.status(404).json({ 
        code: 404, 
        message: 'Response not found', 
        details: [{ message: `Response with ID ${responseId} does not exist` }] 
      });
    }
    
    res.status(200).json(response);
  } catch (error) {
    if (error.message.startsWith('Question with ID')) {
      return res.status(400).json({ 
        code: 400, 
        message: 'Invalid question ID', 
        details: [{ message: error.message }] 
      });
    }
    
    console.error('Error updating response:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

// Delete a response
router.delete('/:responseId', authenticateToken, async (req, res) => {
  try {
    const { formId, responseId } = req.params;
    const deleted = await ResponseModel.delete(formId, responseId);
    
    if (!deleted) {
      return res.status(404).json({ 
        code: 404, 
        message: 'Response not found', 
        details: [{ message: `Response with ID ${responseId} does not exist` }] 
      });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting response:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

export default router;