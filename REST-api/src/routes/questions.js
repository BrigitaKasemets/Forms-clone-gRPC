// routes/questions.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { QuestionModel } from '../models/questionModel.js';

const router = express.Router({ mergeParams: true });

// Validation middleware for questions
const validateQuestion = (req, res, next) => {
  const { text, type, options } = req.body;
  const errors = [];

  if (!text) {
    errors.push({ field: 'text', message: 'Question text is required' });
  }

  if (!type) {
    errors.push({ field: 'type', message: 'Question type is required' });
  } else {
    const validTypes = ['shorttext', 'paragraph', 'multiplechoice', 'checkbox', 'dropdown'];
    if (!validTypes.includes(type)) {
      errors.push({ 
        field: 'type', 
        message: `Question type must be one of: ${validTypes.join(', ')}` 
      });
    }
    
    // Check options for choice-type questions
    if (['multiplechoice', 'checkbox', 'dropdown'].includes(type)) {
      if (!options || !Array.isArray(options) || options.length === 0) {
        errors.push({ field: 'options', message: 'Options are required for this question type' });
      }
    }
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

// Get all questions for a form
router.get('/', authenticateToken, async (req, res) => {
  try {
    const formId = req.params.formId;
    const questions = await QuestionModel.findAll(formId);
    res.status(200).json(questions);
  } catch (error) {
    if (error.message === 'Form not found') {
      return res.status(404).json({ 
        code: 404, 
        message: 'Form not found', 
        details: [{ message: `Form with ID ${req.params.formId} does not exist` }] 
      });
    }
    
    console.error('Error fetching questions:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

// Create a new question
router.post('/', authenticateToken, validateQuestion, async (req, res) => {
  try {
    const formId = req.params.formId;
    const question = await QuestionModel.create(formId, req.body);
    res.status(201).json(question);
  } catch (error) {
    if (error.message === 'Form not found') {
      return res.status(404).json({ 
        code: 404, 
        message: 'Form not found', 
        details: [{ message: `Form with ID ${req.params.formId} does not exist` }] 
      });
    }
    
    console.error('Error creating question:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

// Get a specific question
router.get('/:questionId', authenticateToken, async (req, res) => {
  try {
    const { formId, questionId } = req.params;
    const question = await QuestionModel.findById(formId, questionId);
    
    if (!question) {
      return res.status(404).json({ 
        code: 404, 
        message: 'Question not found', 
        details: [{ message: `Question with ID ${questionId} does not exist` }] 
      });
    }
    
    res.status(200).json(question);
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

// Update a question
router.patch('/:questionId', authenticateToken, async (req, res) => {
  try {
    const { formId, questionId } = req.params;
    const question = await QuestionModel.update(formId, questionId, req.body);
    
    if (!question) {
      return res.status(404).json({ 
        code: 404, 
        message: 'Question not found', 
        details: [{ message: `Question with ID ${questionId} does not exist` }] 
      });
    }
    
    res.status(200).json(question);
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

// Delete a question
router.delete('/:questionId', authenticateToken, async (req, res) => {
  try {
    const { formId, questionId } = req.params;
    const deleted = await QuestionModel.delete(formId, questionId);
    
    if (!deleted) {
      return res.status(404).json({ 
        code: 404, 
        message: 'Question not found', 
        details: [{ message: `Question with ID ${questionId} does not exist` }] 
      });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Internal server error', 
      details: [{ message: error.message }] 
    });
  }
});

export default router;