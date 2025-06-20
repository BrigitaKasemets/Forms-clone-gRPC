// models/questions.js
import { withDb } from '../db/db.js';

export const QuestionModel = {
  create: async (formId, questionData) => {
    return withDb(async (db) => {
      // First check if the form exists
      const formExists = await db.get('SELECT id FROM forms WHERE id = ?', [formId]);
      if (!formExists) {
        throw new Error('Form not found');
      }
      
      // Convert options array to JSON string if it exists
      const options = questionData.options ? JSON.stringify(questionData.options) : null;
      
      const result = await db.run(
        `INSERT INTO questions 
        (formId, questionText, questionType, required, options) 
        VALUES (?, ?, ?, ?, ?)`,
        [
          formId, 
          questionData.text, 
          questionData.type, 
          questionData.required || false,
          options
        ]
      );
      
      // Get the created question
      const question = await db.get(
        'SELECT * FROM questions WHERE id = ?', 
        [result.lastID]
      );
      
      // Parse options back to array if it exists
      return {
        id: question.id,
        text: question.questionText,
        type: question.questionType,
        required: Boolean(question.required),
        options: question.options ? JSON.parse(question.options) : [],
        createdAt: question.createdAt,
        updatedAt: question.updatedAt
      };
    });
  },
  
  findAll: async (formId) => {
    return withDb(async (db) => {
      // First check if the form exists
      const formExists = await db.get('SELECT id FROM forms WHERE id = ?', [formId]);
      if (!formExists) {
        throw new Error('Form not found');
      }
      
      const questions = await db.all(
        'SELECT * FROM questions WHERE formId = ? ORDER BY id',
        [formId]
      );
      
      // Format the response
      return questions.map(q => ({
        id: q.id,
        text: q.questionText,
        type: q.questionType,
        required: Boolean(q.required),
        options: q.options ? JSON.parse(q.options) : [],
        createdAt: q.createdAt,
        updatedAt: q.updatedAt
      }));
    });
  },
  
  findById: async (formId, questionId) => {
    return withDb(async (db) => {
      const question = await db.get(
        'SELECT * FROM questions WHERE id = ? AND formId = ?',
        [questionId, formId]
      );
      
      if (!question) {
        return null;
      }
      
      return {
        id: question.id,
        text: question.questionText,
        type: question.questionType,
        required: Boolean(question.required),
        options: question.options ? JSON.parse(question.options) : [],
        createdAt: question.createdAt,
        updatedAt: question.updatedAt
      };
    });
  },
  
  update: async (formId, questionId, questionData) => {
    return withDb(async (db) => {
      // First check if the question exists
      const questionExists = await db.get(
        'SELECT id FROM questions WHERE id = ? AND formId = ?',
        [questionId, formId]
      );
      
      if (!questionExists) {
        return null;
      }
      
      // Build the update query dynamically based on provided fields
      const updates = [];
      const params = [];
      
      if (questionData.text !== undefined) {
        updates.push('questionText = ?');
        params.push(questionData.text);
      }
      
      if (questionData.type !== undefined) {
        updates.push('questionType = ?');
        params.push(questionData.type);
      }
      
      if (questionData.required !== undefined) {
        updates.push('required = ?');
        params.push(questionData.required);
      }
      
      if (questionData.options !== undefined) {
        updates.push('options = ?');
        params.push(JSON.stringify(questionData.options));
      }
      
      if (updates.length === 0) {
        // No fields to update
        return await QuestionModel.findById(formId, questionId);
      }
      
      // Add updatedAt timestamp and query parameters
      updates.push('updatedAt = CURRENT_TIMESTAMP');
      params.push(questionId, formId);
      
      await db.run(
        `UPDATE questions SET ${updates.join(', ')} WHERE id = ? AND formId = ?`,
        params
      );
      
      // Note: This will open a new connection through withDb
      return await QuestionModel.findById(formId, questionId);
    });
  },
  
  delete: async (formId, questionId) => {
    return withDb(async (db) => {
      // First check if the question exists
      const questionExists = await db.get(
        'SELECT id FROM questions WHERE id = ? AND formId = ?',
        [questionId, formId]
      );
      
      if (!questionExists) {
        return false;
      }
      
      await db.run(
        'DELETE FROM questions WHERE id = ? AND formId = ?',
        [questionId, formId]
      );
      
      return true;
    });
  }
};