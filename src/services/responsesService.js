import grpc from '@grpc/grpc-js';
import { verifyToken } from '../utils/auth.js';
import { ResponseModel } from '../models/responseModel.js';

export const ResponsesServiceImpl = {
  // Create a new response
  async CreateResponse(call, callback) {
    try {
      const { formId, answers, respondentName, respondentEmail, token } = call.request;
      
      // Validate authentication
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      // Validate input
      if (!formId || !answers || answers.length === 0) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Form ID and at least one answer are required'
        });
      }

      // Create response
      const responseData = {
        answers,
        respondentName: respondentName || '',
        respondentEmail: respondentEmail || ''
      };

      const response = await ResponseModel.create(formId, responseData);
      
      callback(null, {
        id: response.id,
        formId: response.formId,
        respondentName: response.respondentName,
        respondentEmail: response.respondentEmail,
        answers: response.answers,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });

    } catch (error) {
      console.error('CreateResponse error:', error);
      
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

  // Get a response by ID
  async GetResponse(call, callback) {
    try {
      const { formId, responseId, token } = call.request;
      
      // Validate authentication
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const response = await ResponseModel.findById(formId, responseId);
      
      if (!response) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: `Response with ID ${responseId} does not exist for form ${formId}`
        });
      }

      callback(null, {
        id: response.id,
        formId: response.formId,
        respondentName: response.respondentName,
        respondentEmail: response.respondentEmail,
        answers: response.answers,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });

    } catch (error) {
      console.error('GetResponse error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // List all responses for a form
  async ListResponses(call, callback) {
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

      const responses = await ResponseModel.findAll(formId);
      
      const formattedResponses = responses.map(response => ({
        id: response.id,
        formId: response.formId,
        respondentName: response.respondentName,
        respondentEmail: response.respondentEmail,
        answers: response.answers,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      }));

      callback(null, { responses: formattedResponses });

    } catch (error) {
      console.error('ListResponses error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Update a response
  async UpdateResponse(call, callback) {
    try {
      const { formId, responseId, answers, respondentName, respondentEmail, token } = call.request;
      
      // Validate authentication
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const responseData = {};
      
      if (answers !== undefined) responseData.answers = answers;
      if (respondentName !== undefined) responseData.respondentName = respondentName;
      if (respondentEmail !== undefined) responseData.respondentEmail = respondentEmail;

      const response = await ResponseModel.update(formId, responseId, responseData);
      
      if (!response) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: `Response with ID ${responseId} does not exist for form ${formId}`
        });
      }

      callback(null, {
        id: response.id,
        formId: response.formId,
        respondentName: response.respondentName,
        respondentEmail: response.respondentEmail,
        answers: response.answers,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      });

    } catch (error) {
      console.error('UpdateResponse error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Delete a response
  async DeleteResponse(call, callback) {
    try {
      const { formId, responseId, token } = call.request;
      
      // Validate authentication
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const deleted = await ResponseModel.delete(formId, responseId);
      
      if (!deleted) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: `Response with ID ${responseId} does not exist for form ${formId}`
        });
      }

      callback(null, {
        success: true,
        message: 'Response deleted successfully'
      });

    } catch (error) {
      console.error('DeleteResponse error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  }
};
