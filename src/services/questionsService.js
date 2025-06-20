import grpc from '@grpc/grpc-js';
import { verifyToken } from '../utils/auth.js';
import { QuestionModel } from '../models/questionsModel.js';

export const QuestionsServiceImpl = {
  // Create a new question
  async CreateQuestion(call, callback) {
    try {
      const { formId, questionText, questionType, text, type, options, isRequired, required, token } = call.request;
      
      // Support both field naming conventions (questionText/questionType and text/type)
      const finalText = questionText || text;
      const finalType = questionType || type;
      const finalRequired = isRequired !== undefined ? isRequired : (required || false);
      
      // Validate authentication
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      // Validate input
      if (!formId || !finalText || !finalType) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Form ID, question text, and question type are required'
        });
      }

      // Create question
      const questionData = {
        text: finalText,
        type: finalType,
        options: options || [],
        required: finalRequired
      };

      const question = await QuestionModel.create(formId, questionData);
      
      callback(null, {
        id: question.id,
        text: question.text,
        type: question.type,
        options: question.options,
        required: question.required,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt
      });

    } catch (error) {
      console.error('CreateQuestion error:', error);
      
      if (error.message === 'Form not found') {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Form not found'
        });
      }
      
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Get a question by ID
  async GetQuestion(call, callback) {
    try {
      const { formId, questionId, token } = call.request;
      
      // Validate authentication
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const question = await QuestionModel.findById(formId, questionId);
      
      if (!question) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: `Question with ID ${questionId} does not exist in form ${formId}`
        });
      }

      callback(null, {
        id: question.id,
        text: question.text,
        type: question.type,
        options: question.options,
        required: question.required,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt
      });

    } catch (error) {
      console.error('GetQuestion error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // List all questions for a form
  async ListQuestions(call, callback) {
    try {
      const { formId, token } = call.request;
      
      // Validate authentication
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const questions = await QuestionModel.findAll(formId);
      
      const formattedQuestions = questions.map(question => ({
        id: question.id,
        text: question.text,
        type: question.type,
        options: question.options,
        required: question.required,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt
      }));

      callback(null, { questions: formattedQuestions });

    } catch (error) {
      console.error('ListQuestions error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Update a question
  async UpdateQuestion(call, callback) {
    try {
      const { formId, questionId, text, type, options, required, token } = call.request;
      
      // Validate authentication
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const questionData = {};
      
      if (text !== undefined) questionData.text = text;
      if (type !== undefined) questionData.type = type;
      if (options !== undefined) questionData.options = options;
      if (required !== undefined) questionData.required = required;

      const question = await QuestionModel.update(formId, questionId, questionData);
      
      if (!question) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: `Question with ID ${questionId} does not exist in form ${formId}`
        });
      }

      callback(null, {
        id: question.id,
        text: question.text,
        type: question.type,
        options: question.options,
        required: question.required,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt
      });

    } catch (error) {
      console.error('UpdateQuestion error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Delete a question
  async DeleteQuestion(call, callback) {
    try {
      const { formId, questionId, token } = call.request;
      
      // Validate authentication
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const deleted = await QuestionModel.delete(formId, questionId);
      
      if (!deleted) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: `Question with ID ${questionId} does not exist in form ${formId}`
        });
      }

      callback(null, {
        success: true,
        message: 'Question deleted successfully'
      });

    } catch (error) {
      console.error('DeleteQuestion error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  }
};
