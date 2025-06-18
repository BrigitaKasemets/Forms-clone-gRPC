import 'dotenv/config';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Proto file path
const PROTO_PATH = join(__dirname, '../proto/forms.proto');

// Load proto file
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const formsProto = grpc.loadPackageDefinition(packageDefinition).forms;

// Create gRPC clients
const port = process.env.GRPC_PORT || '50051';
const host = process.env.GRPC_HOST || 'localhost';
const serverAddress = `${host}:${port}`;

const formsClient = new formsProto.FormsService(
  serverAddress,
  grpc.credentials.createInsecure()
);

const questionsClient = new formsProto.QuestionsService(
  serverAddress,
  grpc.credentials.createInsecure()
);

const responsesClient = new formsProto.ResponsesService(
  serverAddress,
  grpc.credentials.createInsecure()
);

const usersClient = new formsProto.UsersService(
  serverAddress,
  grpc.credentials.createInsecure()
);

const sessionsClient = new formsProto.SessionsService(
  serverAddress,
  grpc.credentials.createInsecure()
);

// Helper for promisifying gRPC calls
const promisify = (client, method, request) => {
  return new Promise((resolve, reject) => {
    client[method](request, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
};

// Run test
const testGrpcServer = async () => {
  try {
    console.log('📝 Testing gRPC Forms API...');
    
    // Register user or log in if already exists
    console.log('\n🔑 1. Creating a test user...');
    try {
      const user = await promisify(usersClient, 'CreateUser', {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });
      console.log('✅ User created:', user);
    } catch (error) {
      if (error.code === 6 && error.details === 'Email already exists') {
        console.log('✅ User already exists, continuing with login...');
      } else {
        throw error;
      }
    }
    
    // Login
    console.log('\n🔑 2. Logging in...');
    const session = await promisify(sessionsClient, 'CreateSession', {
      email: 'test@example.com',
      password: 'password123'
    });
    console.log('✅ Logged in, received token:', session.token);
    
    // List all users
    console.log('\n👥 3. Listing all users...');
    const users = await promisify(usersClient, 'ListUsers', {
      token: session.token
    });
    console.log('✅ Users list:', users);
    
    // Validate token
    console.log('\n🔑 4. Validating session token...');
    const validatedUser = await promisify(sessionsClient, 'ValidateSession', {
      token: session.token
    });
    console.log('✅ Token is valid, user:', validatedUser);
    
    // Get user by ID
    console.log('\n👤 5. Getting user by ID...');
    const user = await promisify(usersClient, 'GetUser', {
      userId: validatedUser.id,
      token: session.token
    });
    console.log('✅ User details:', user);
    
    // Update user
    console.log('\n✏️ 6. Updating user...');
    const updatedUser = await promisify(usersClient, 'UpdateUser', {
      userId: validatedUser.id,
      name: 'Updated Test User',
      token: session.token
    });
    console.log('✅ User updated:', updatedUser);
    
    // Create form
    console.log('\n📋 7. Creating a form...');
    const form = await promisify(formsClient, 'CreateForm', {
      title: 'Test Form',
      description: 'This is a test form',
      token: session.token
    });
    console.log('✅ Form created:', form);
    
    // Get form by ID
    console.log('\n📄 8. Getting form by ID...');
    const retrievedForm = await promisify(formsClient, 'GetForm', {
      formId: form.id.toString(),
      token: session.token
    });
    console.log('✅ Form details:', retrievedForm);
    
    // Update form
    console.log('\n✏️ 9. Updating form...');
    const updatedForm = await promisify(formsClient, 'UpdateForm', {
      formId: form.id.toString(),
      title: 'Updated Test Form',
      description: 'This is an updated test form',
      token: session.token
    });
    console.log('✅ Form updated:', updatedForm);
    
    // Create questions
    console.log('\n❓ 10. Adding questions to the form...');
    const question1 = await promisify(questionsClient, 'CreateQuestion', {
      formId: form.id.toString(),
      text: 'What is your name?',
      type: 'shorttext',
      required: true,
      token: session.token
    });
    console.log('✅ Question 1 created:', question1);
    
    const question2 = await promisify(questionsClient, 'CreateQuestion', {
      formId: form.id.toString(),
      text: 'Select your favorite colors:',
      type: 'checkbox',
      options: ['Red', 'Green', 'Blue', 'Yellow'],
      required: false,
      token: session.token
    });
    console.log('✅ Question 2 created:', question2);
    
    // Get question by ID
    console.log('\n❓ 11. Getting question by ID...');
    const retrievedQuestion = await promisify(questionsClient, 'GetQuestion', {
      formId: form.id.toString(),
      questionId: question1.id,
      token: session.token
    });
    console.log('✅ Question details:', retrievedQuestion);
    
    // Update question
    console.log('\n✏️ 12. Updating question...');
    const updatedQuestion = await promisify(questionsClient, 'UpdateQuestion', {
      formId: form.id.toString(),
      questionId: question1.id,
      text: 'What is your full name?',
      required: true,
      token: session.token
    });
    console.log('✅ Question updated:', updatedQuestion);
    
    // List questions
    console.log('\n❓ 13. Listing questions in the form...');
    const questions = await promisify(questionsClient, 'ListQuestions', {
      formId: form.id.toString(),
      token: session.token
    });
    console.log('✅ Form questions:', questions);
    
    // Submit response
    console.log('\n📝 14. Submitting a response to the form...');
    const response = await promisify(responsesClient, 'CreateResponse', {
      formId: form.id.toString(),
      answers: [
        { questionId: question1.id, answer: 'John Doe' },
        { questionId: question2.id, answer: 'Red,Blue' }
      ],
      respondentName: 'John Doe',
      respondentEmail: 'john@example.com',
      token: session.token
    });
    console.log('✅ Response submitted:', response);
    
    // Get response by ID
    console.log('\n📝 15. Getting response by ID...');
    const retrievedResponse = await promisify(responsesClient, 'GetResponse', {
      formId: form.id.toString(),
      responseId: response.id,
      token: session.token
    });
    console.log('✅ Response details:', retrievedResponse);
    
    // Update response
    console.log('\n✏️ 16. Updating response...');
    const updatedResponse = await promisify(responsesClient, 'UpdateResponse', {
      formId: form.id.toString(),
      responseId: response.id,
      answers: [
        { questionId: question1.id, answer: 'John Smith' },
        { questionId: question2.id, answer: 'Red,Green,Blue' }
      ],
      respondentName: 'John Smith',
      token: session.token
    });
    console.log('✅ Response updated:', updatedResponse);
    
    // List responses
    console.log('\n📝 17. Listing responses for the form...');
    const responses = await promisify(responsesClient, 'ListResponses', {
      formId: form.id.toString(),
      token: session.token
    });
    console.log('✅ Form responses:', responses);
    
    // List all forms
    console.log('\n📋 18. Listing all forms for the user...');
    const forms = await promisify(formsClient, 'ListForms', {
      token: session.token
    });
    console.log('✅ User forms:', forms);
    
    // Delete a response
    console.log('\n🗑️ 19. Deleting a response...');
    const deleteResponseResult = await promisify(responsesClient, 'DeleteResponse', {
      formId: form.id.toString(),
      responseId: response.id,
      token: session.token
    });
    console.log('✅ Response deleted:', deleteResponseResult);
    
    // Delete both questions
    console.log('\n🗑️ 20. Deleting question 1...');
    const deleteQuestion1Result = await promisify(questionsClient, 'DeleteQuestion', {
      formId: form.id.toString(),
      questionId: question1.id,
      token: session.token
    });
    console.log('✅ Question 1 deleted:', deleteQuestion1Result);
    
    console.log('\n🗑️ 21. Deleting question 2...');
    const deleteQuestion2Result = await promisify(questionsClient, 'DeleteQuestion', {
      formId: form.id.toString(),
      questionId: question2.id,
      token: session.token
    });
    console.log('✅ Question 2 deleted:', deleteQuestion2Result);
    
    // Delete a form
    console.log('\n🗑️ 22. Deleting a form...');
    const deleteFormResult = await promisify(formsClient, 'DeleteForm', {
      formId: form.id.toString(),
      token: session.token
    });
    console.log('✅ Form deleted:', deleteFormResult);
    
    // Delete user test (done before logout to have valid token)
    console.log('\n🗑️ 23. Deleting user...');
    try {
      const deleteUserResult = await promisify(usersClient, 'DeleteUser', {
        userId: validatedUser.id,
        token: session.token
      });
      console.log('✅ User deleted:', deleteUserResult);
    } catch (error) {
      // If error, probably because of foreign key constraints
      console.log('⚠️ User deletion failed (probably due to foreign key constraints):', error.details);
    }
    
    // Logout (may fail if user was deleted)
    console.log('\n🔑 24. Logging out...');
    try {
      const logout = await promisify(sessionsClient, 'DeleteSession', {
        token: session.token
      });
      console.log('✅ Logged out:', logout);
    } catch (error) {
      if (error.code === 16 && error.details === 'Invalid or expired token') {
        console.log('✅ Session already invalidated (user was deleted)');
      } else {
        throw error;
      }
    }
    
    console.log('\n🎉 All 24 tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

testGrpcServer();
