import { QuestionModel } from '../models/questionModel.js';

export const QuestionsController = {
    // Get all questions for a form
    getAllQuestions: async (req, res) => {
        try {
            const formId = req.params.formId;
            const questions = await QuestionModel.getByFormId(formId);
            res.status(200).json(questions);
        } catch (error) {
            console.error(`Error fetching questions for form ${req.params.formId}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get a specific question
    getQuestionById: async (req, res) => {
        try {
            const { formId, questionId } = req.params;
            const question = await QuestionModel.getById(formId, questionId);
            
            if (!question) {
                return res.status(404).json({ error: 'Question not found' });
            }
            
            res.status(200).json(question);
        } catch (error) {
            console.error(`Error fetching question ${req.params.questionId}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Create a new question
    createQuestion: async (req, res) => {
        try {
            const formId = req.params.formId;
            const questionData = {
                ...req.body,
                formId
            };
            
            const question = await QuestionModel.create(questionData);
            res.status(201).json(question);
        } catch (error) {
            console.error(`Error creating question for form ${req.params.formId}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Update a question
    updateQuestion: async (req, res) => {
        try {
            const { formId, questionId } = req.params;
            const questionData = {
                ...req.body,
                id: questionId,
                formId
            };
            
            const updatedQuestion = await QuestionModel.update(questionData);
            
            if (!updatedQuestion) {
                return res.status(404).json({ error: 'Question not found' });
            }
            
            res.status(200).json(updatedQuestion);
        } catch (error) {
            console.error(`Error updating question ${req.params.questionId}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Delete a question
    deleteQuestion: async (req, res) => {
        try {
            const { formId, questionId } = req.params;
            const result = await QuestionModel.delete(formId, questionId);
            
            if (!result) {
                return res.status(404).json({ error: 'Question not found' });
            }
            
            res.status(204).send();
        } catch (error) {
            console.error(`Error deleting question ${req.params.questionId}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
