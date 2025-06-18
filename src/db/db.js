import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize database connection and ensure tables exist
export const initializeDb = async () => {
    const db = await open({
        filename: path.join(__dirname, '../../forms.db'),
        driver: sqlite3.Database
    });

    // Create users table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sessions table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        userId INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users (id)
      )
    `);

    // Create forms table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS forms (
        id INTEGER PRIMARY KEY,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users (id)
      )
    `);

    // Create questions table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY,
        formId INTEGER NOT NULL,
        questionText TEXT NOT NULL,
        questionType TEXT NOT NULL,
        required BOOLEAN DEFAULT FALSE,
        options TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (formId) REFERENCES forms (id) ON DELETE CASCADE
      )
    `);

    // Create responses table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY,
        formId INTEGER NOT NULL,
        respondentName TEXT,
        respondentEmail TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (formId) REFERENCES forms (id) ON DELETE CASCADE
      )
    `);

    // Create answer_values table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS answer_values (
        id INTEGER PRIMARY KEY,
        responseId INTEGER NOT NULL,
        questionId INTEGER NOT NULL,
        answerText TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (responseId) REFERENCES responses (id) ON DELETE CASCADE,
        FOREIGN KEY (questionId) REFERENCES questions (id) ON DELETE CASCADE
      )
    `);

    return db;
};

/**
 * Execute database operations with automatic connection management
 * @param {Function} callback - Async function that receives db connection and performs operations
 * @returns {Promise<*>} - The result of the callback function
 */
export const withDb = async (callback) => {
    const db = await initializeDb();
    try {
        return await callback(db);
    } finally {
        await db.close();
    }
};

// User management functions
export const userDb = {
    async createUser(email, password, name) {
        return withDb(async (db) => {
            // Check if email already exists
            const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
            if (existingUser) {
                throw new Error('Email already exists');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await db.run(
                'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
                [email, hashedPassword, name]
            );

            // Get and return the created user with timestamps from database
            return await db.get(
                'SELECT id, email, name, createdAt, updatedAt FROM users WHERE id = ?',
                [result.lastID]
            );
        });
    },

    async getAllUsers() {
        return withDb(async (db) => {
            return await db.all('SELECT id, email, name, createdAt, updatedAt FROM users');
        });
    },

    async verifyUser(email, password) {
        return withDb(async (db) => {
            console.log('Verifying user with email:', email);

            // Get the latest user data from database
            const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

            if (!user) {
                console.log('User not found with email:', email);
                return null;
            }

            console.log('Found user ID:', user.id);

            try {
                // Use bcrypt.compare to securely compare the provided password with the stored hash
                const validPassword = await bcrypt.compare(password, user.password);
                console.log('Password verification result:', validPassword);

                if (!validPassword) {
                    console.log('Password verification failed for user:', user.id);
                    return null;
                }

                console.log('Password verified successfully for user:', user.id);
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name
                };
            } catch (error) {
                console.error('Error during password verification:', error);
                return null;
            }
        });
    },

    async getUserById(userId) {
        return withDb(async (db) => {
            const user = await db.get(
                'SELECT id, email, name, createdAt, updatedAt FROM users WHERE id = ?',
                [userId]
            );

            if (!user) {
                throw new Error('User not found');
            }

            return user;
        });
    },

    async updateUser(userId, updates) {
        return withDb(async (db) => {
            // Verify user exists
            const user = await db.get(
                'SELECT id FROM users WHERE id = ?',
                [userId]
            );

            if (!user) {
                throw new Error('User not found');
            }

            // Build the SQL update parts
            const updateFields = [];
            const values = [];

            console.log('Update fields received:', Object.keys(updates));

            if (updates.email) {
                updateFields.push('email = ?');
                values.push(updates.email);
                console.log('Will update email');
            }

            if (updates.name) {
                updateFields.push('name = ?');
                values.push(updates.name);
                console.log('Will update name');
            }

            if (updates.password) {
                try {
                    // Hash the password before storing it
                    const hashedPassword = await bcrypt.hash(updates.password, 10);
                    updateFields.push('password = ?');
                    values.push(hashedPassword);
                    console.log('Will update password, hash generated');
                } catch (error) {
                    console.error('Error hashing password during update:', error);
                    throw error;
                }
            } else {
                console.log('No password update requested');
            }

            // Always update the updatedAt timestamp
            updateFields.push('updatedAt = CURRENT_TIMESTAMP');

            // Add userId to values array for the WHERE clause
            values.push(userId);

            // Only proceed if there are fields to update
            if (updateFields.length > 0) {
                const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
                console.log('Executing SQL query:', query.replace(/\?/g, '***'));
                console.log('Number of values:', values.length);

                try {
                    const result = await db.run(query, values);
                    console.log('Update result:', result);
                    console.log('Rows modified:', result.changes);

                    if (result.changes === 0) {
                        console.warn('Warning: No rows were updated despite valid user ID');
                    }
                } catch (error) {
                    console.error('Error executing update query:', error);
                    throw error;
                }
            }

            // Verify that the password has been updated if that was requested
            if (updates.password) {
                const updatedUser = await db.get('SELECT id, password FROM users WHERE id = ?', [userId]);
                console.log('Password update verification - User found:', !!updatedUser);
            }

            // Get and return the updated user
            return await db.get(
                'SELECT id, email, name, createdAt, updatedAt FROM users WHERE id = ?',
                [userId]
            );
        });
    },

    async deleteUser(userId) {
        return withDb(async (db) => {
            // Verify user exists
            const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);

            if (!user) {
                throw new Error('User not found');
            }

            // Delete related sessions first due to foreign key constraints
            await db.run('DELETE FROM sessions WHERE userId = ?', [userId]);

            // Delete any forms created by the user
            // Note: This will cascade delete related questions and responses due to ON DELETE CASCADE
            await db.run('DELETE FROM forms WHERE userId = ?', [userId]);

            // Delete the user
            await db.run('DELETE FROM users WHERE id = ?', [userId]);

            return true;
        });
    }
};

// Session management functions
export const sessionDb = {
    async createSession(userId, token) {
        return withDb(async (db) => {
            await db.run(
                'INSERT INTO sessions (token, userId) VALUES (?, ?)',
                [token, userId]
            );
            return token;
        });
    },

    async verifySession(token) {
        return withDb(async (db) => {
            return await db.get(
                `SELECT s.*, u.email, u.name
                 FROM sessions s
                 JOIN users u ON s.userId = u.id
                 WHERE s.token = ?`,
                [token]
            );
        });
    },

    async deleteSession(token) {
        return withDb(async (db) => {
            await db.run('DELETE FROM sessions WHERE token = ?', [token]);
        });
    }
};

// Form management functions
export const formDb = {
    async createForm(userId, title, description) {
        return withDb(async (db) => {
            const result = await db.run(
                'INSERT INTO forms (userId, title, description) VALUES (?, ?, ?)',
                [userId, title, description]
            );
            // Return the created form with timestamps from database
            return await db.get('SELECT * FROM forms WHERE id = ?', [result.lastID]);
        });
    },

    async getAllForms() {
        return withDb(async (db) => {
            return await db.all('SELECT * FROM forms');
        });
    },

    async getFormById(formId) {
        return withDb(async (db) => {
            const form = await db.get('SELECT * FROM forms WHERE id = ?', [formId]);

            if (!form) {
                throw new Error('Form not found');
            }

            return form;
        });
    },

    async updateForm(formId, title, description) {
        return withDb(async (db) => {
            // First check if the form exists
            const form = await db.get('SELECT * FROM forms WHERE id = ?', [formId]);

            if (!form) {
                throw new Error('Form not found');
            }

            await db.run(
                'UPDATE forms SET title = ?, description = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
                [title, description, formId]
            );

            // Get and return the updated form details
            return await db.get('SELECT * FROM forms WHERE id = ?', [formId]);
        });
    },

    async deleteForm(formId) {
        return withDb(async (db) => {
            // First check if the form exists
            const formExists = await db.get('SELECT id FROM forms WHERE id = ?', [formId]);

            if (!formExists) {
                return false;
            }

            await db.run('DELETE FROM forms WHERE id = ?', [formId]);
            return true;
        });
    }
};
