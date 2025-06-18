// models/responses.js
import { withDb } from '../db/db.js';

export const ResponseModel = {
  // Create a new response for a form
  create: async (formId, responseData) => {
    return withDb(async (db) => {
      // Begin transaction
      await db.run('BEGIN TRANSACTION');
      
      try {
        // First check if the form exists
        const formExists = await db.get('SELECT id FROM forms WHERE id = ?', [formId]);
        if (!formExists) {
          throw new Error('Form not found');
        }
        
        // Validate that answers are provided
        if (!responseData.answers || !Array.isArray(responseData.answers) || responseData.answers.length === 0) {
          throw new Error('At least one answer is required');
        }
        
        // Insert the response record
        const responseResult = await db.run(
          `INSERT INTO responses (formId, respondentName, respondentEmail) 
           VALUES (?, ?, ?)`,
          [
            formId,
            responseData.respondentName || null,
            responseData.respondentEmail || null
          ]
        );
        
        const responseId = responseResult.lastID;
        
        // Insert each answer
        for (const answer of responseData.answers) {
          // Verify the question exists
          const questionExists = await db.get(
            'SELECT id FROM questions WHERE id = ? AND formId = ?', 
            [answer.questionId, formId]
          );
          
          if (!questionExists) {
            await db.run('ROLLBACK');
            throw new Error(`Question with ID ${answer.questionId} not found`);
          }
          
          // Insert the answer
          await db.run(
            `INSERT INTO answer_values (responseId, questionId, answerText) 
             VALUES (?, ?, ?)`,
            [responseId, answer.questionId, answer.answer]
          );
        }
        
        // Commit the transaction
        await db.run('COMMIT');
        
        // Get the complete response with answers
        // This will create a new connection via withDb
        return await ResponseModel.findById(formId, responseId);
      } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        throw error;
      }
    });
  },
  
  // Find all responses for a form
  findAll: async (formId) => {
    return withDb(async (db) => {
      // First check if the form exists
      const formExists = await db.get('SELECT id FROM forms WHERE id = ?', [formId]);
      if (!formExists) {
        throw new Error('Form not found');
      }
      
      // Get all responses for the form
      const responses = await db.all(
        'SELECT * FROM responses WHERE formId = ? ORDER BY createdAt DESC',
        [formId]
      );
      
      // Get all answers for these responses
      const result = [];
      
      for (const response of responses) {
        const answers = await db.all(
          `SELECT questionId, answerText AS answer 
           FROM answer_values 
           WHERE responseId = ?`,
          [response.id]
        );
        
        result.push({
          id: response.id.toString(),
          formId: response.formId.toString(),
          respondentName: response.respondentName,
          respondentEmail: response.respondentEmail,
          answers: answers.map(a => ({
            questionId: a.questionId.toString(),
            answer: a.answer
          })),
          createdAt: response.createdAt,
          updatedAt: response.updatedAt
        });
      }
      
      return result;
    });
  },
  
  // Find a specific response by ID
  findById: async (formId, responseId) => {
    return withDb(async (db) => {
      // Get the response
      const response = await db.get(
        'SELECT * FROM responses WHERE id = ? AND formId = ?',
        [responseId, formId]
      );
      
      if (!response) {
        return null;
      }
      
      // Get all answers for this response
      const answers = await db.all(
        `SELECT questionId, answerText AS answer 
         FROM answer_values 
         WHERE responseId = ?`,
        [responseId]
      );
      
      return {
        id: response.id.toString(),
        formId: response.formId.toString(),
        respondentName: response.respondentName,
        respondentEmail: response.respondentEmail,
        answers: answers.map(a => ({
          questionId: a.questionId.toString(),
          answer: a.answer
        })),
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      };
    });
  },
  
  // Update a response
  update: async (formId, responseId, responseData) => {
    return withDb(async (db) => {
      // Begin transaction
      await db.run('BEGIN TRANSACTION');
      
      try {
        // Check if the response exists
        const responseExists = await db.get(
          'SELECT id FROM responses WHERE id = ? AND formId = ?',
          [responseId, formId]
        );
        
        if (!responseExists) {
          return null;
        }
        
        // Update respondent info if provided and set updatedAt timestamp
        let updates = ['updatedAt = CURRENT_TIMESTAMP'];
        let params = [];
        
        if (responseData.respondentName !== undefined) {
          updates.push('respondentName = ?');
          params.push(responseData.respondentName);
        }
        
        if (responseData.respondentEmail !== undefined) {
          updates.push('respondentEmail = ?');
          params.push(responseData.respondentEmail);
        }
        
        params.push(responseId);
        await db.run(
          `UPDATE responses SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
        
        // Update answers if provided
        if (responseData.answers && Array.isArray(responseData.answers)) {
          // Delete existing answers
          await db.run('DELETE FROM answer_values WHERE responseId = ?', [responseId]);
          
          // Insert new answers
          for (const answer of responseData.answers) {
            // Verify the question exists
            const questionExists = await db.get(
              'SELECT id FROM questions WHERE id = ? AND formId = ?', 
              [answer.questionId, formId]
            );
            
            if (!questionExists) {
              await db.run('ROLLBACK');
              throw new Error(`Question with ID ${answer.questionId} not found`);
            }
            
            // Insert the answer
            await db.run(
              `INSERT INTO answer_values (responseId, questionId, answerText) 
               VALUES (?, ?, ?)`,
              [responseId, answer.questionId, answer.answer]
            );
          }
        }
        
        // Commit the transaction
        await db.run('COMMIT');
        
        // Get the updated response
        // This will create a new connection via withDb
        return await ResponseModel.findById(formId, responseId);
      } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        throw error;
      }
    });
  },
  
  // Delete a response
  delete: async (formId, responseId) => {
    return withDb(async (db) => {
      try {
        // Check if the response exists
        const responseExists = await db.get(
          'SELECT id FROM responses WHERE id = ? AND formId = ?',
          [responseId, formId]
        );
        
        if (!responseExists) {
          return false;
        }
        
        // Begin transaction
        await db.run('BEGIN TRANSACTION');
        
        // Delete all answers
        await db.run('DELETE FROM answer_values WHERE responseId = ?', [responseId]);
        
        // Delete the response
        await db.run('DELETE FROM responses WHERE id = ?', [responseId]);
        
        // Commit the transaction
        await db.run('COMMIT');
        
        return true;
      } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        throw error;
      }
    });
  }
};