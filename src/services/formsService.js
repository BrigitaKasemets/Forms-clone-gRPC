import grpc from '@grpc/grpc-js';
import { FormModel } from '../models/formsModel.js';
import { verifyToken } from '../utils/auth.js';

export const FormsServiceImpl = {
  // Loo uus vorm
  async CreateForm(call, callback) {
    try {
      const { title, description, token } = call.request;
      
      // Valideeri autentimine
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      // Valideeri sisend
      if (!title) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Title is required'
        });
      }

      // Loo vorm
      const formData = {
        title,
        description: description || '',
        userId: user.id
      };

      const form = await FormModel.create(formData);
      
      callback(null, {
        id: form.id,
        userId: form.userId,
        title: form.title,
        description: form.description,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt
      });

    } catch (error) {
      console.error('CreateForm error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Hangi vorm
  async GetForm(call, callback) {
    try {
      const { formId, token } = call.request;
      
      // Valideeri autentimine
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const form = await FormModel.findById(formId);
      
      if (!form) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: `Form with ID ${formId} does not exist`
        });
      }

      callback(null, {
        id: form.id,
        userId: form.userId,
        title: form.title,
        description: form.description,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt
      });

    } catch (error) {
      console.error('GetForm error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Hangi kõik vormid
  async ListForms(call, callback) {
    try {
      const { token } = call.request;
      
      // Valideeri autentimine
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const allForms = await FormModel.findAll();
      
      // Filtreeri kasutaja vormid
      const userForms = allForms ? allForms.filter(form => form.userId === user.id) : [];
      
      const forms = userForms.map(form => ({
        id: form.id,
        userId: form.userId,
        title: form.title,
        description: form.description,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt
      }));

      callback(null, { forms });

    } catch (error) {
      console.error('ListForms error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Uuenda vorm
  async UpdateForm(call, callback) {
    try {
      const { formId, title, description, token } = call.request;
      
      // Valideeri autentimine
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const formData = {
        userId: user.id
      };
      
      if (title !== undefined) formData.title = title;
      if (description !== undefined) formData.description = description;

      const form = await FormModel.update(formId, formData);
      
      if (!form) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: `Form with ID ${formId} does not exist`
        });
      }

      callback(null, {
        id: form.id,
        userId: form.userId,
        title: form.title,
        description: form.description,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt
      });

    } catch (error) {
      console.error('UpdateForm error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  // Kustuta vorm
  async DeleteForm(call, callback) {
    try {
      const { formId, token } = call.request;
      
      // Valideeri autentimine
      const user = await verifyToken(token);
      if (!user) {
        return callback({
          code: grpc.status.UNAUTHENTICATED,
          message: 'Invalid or expired token'
        });
      }

      const deleted = await FormModel.delete(formId);
      
      if (!deleted) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: `Form with ID ${formId} does not exist`
        });
      }

      callback(null, {
        success: true,
        message: 'Form deleted successfully'
      });

    } catch (error) {
      console.error('DeleteForm error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  }
};