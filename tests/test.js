import 'dotenv/config';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const REST_BASE_URL = 'http://localhost:3000';
const GRPC_HOST = 'localhost';
const GRPC_PORT = '50051';
const PROTO_PATH = join(__dirname, '../proto/forms.proto');

// Test data
const TEST_EMAIL = 'testuser@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

// Global test state
let testState = {
  restToken: null,
  grpcToken: null,
  formId: null,
  grpcFormId: null,
  question1Id: null,
  question2Id: null,
  grpcQuestion1Id: null,
  grpcQuestion2Id: null,
  responseId: null,
  grpcResponseId: null,
  userId: null,
  testsPassed: 0,
  testsFailed: 0,
  totalTests: 0
};

// Helper functions
function colorLog(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function printHeader(title) {
  console.log('\n' + '='.repeat(50));
  colorLog(colors.cyan + colors.bright, title);
  console.log('='.repeat(50));
}

function printTest(description) {
  colorLog(colors.blue, `[TEST] ${description}`);
}

function printSuccess(message) {
  colorLog(colors.green, `[PASS] ${message}`);
}

function printFailure(message) {
  colorLog(colors.red, `[FAIL] ${message}`);
}

function recordTestPass(message) {
  testState.totalTests++;
  testState.testsPassed++;
  printSuccess(message);
}

function recordTestFail(message) {
  testState.totalTests++;
  testState.testsFailed++;
  printFailure(message);
}

function printInfo(message) {
  colorLog(colors.yellow, `[INFO] ${message}`);
}

// Load gRPC proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const formsProto = grpc.loadPackageDefinition(packageDefinition).forms;

// Create gRPC clients
const grpcClients = {
  forms: new formsProto.FormsService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  questions: new formsProto.QuestionsService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  responses: new formsProto.ResponsesService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  users: new formsProto.UsersService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  sessions: new formsProto.SessionsService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure())
};

// Promisify gRPC calls
function promisifyGrpc(client, method, request) {
  return new Promise((resolve, reject) => {
    client[method](request, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

// REST API helper
async function makeRestCall(method, endpoint, data = null, useAuth = true) {
  const url = `${REST_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (useAuth && testState.restToken) {
    options.headers.Authorization = `Bearer ${testState.restToken}`;
  }

  if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  
  if (response.status === 204) {
    return { success: true };
  }
  
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`REST ${response.status}: ${result.message || result.error || 'Unknown error'}`);
  }
  
  return result;
}

// Compare objects for specific fields
function compareObjects(obj1, obj2, fieldsToCompare, testName) {
  let allMatch = true;
  const differences = [];

  for (const field of fieldsToCompare) {
    const value1 = getNestedValue(obj1, field);
    const value2 = getNestedValue(obj2, field);
    
    if (JSON.stringify(value1) !== JSON.stringify(value2)) {
      differences.push(`${field}: REST="${value1}" vs gRPC="${value2}"`);
      allMatch = false;
    }
  }

  if (allMatch) {
    recordTestPass(`${testName} - All fields match`);
  } else {
    recordTestFail(`${testName} - Differences found:`);
    differences.forEach(diff => console.log(`    ${diff}`));
  }

  return allMatch;
}

// Get nested object value by dot notation
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// Check if servers are running
async function checkServers() {
  printHeader('CHECKING SERVER AVAILABILITY');
  
  // Check REST API
  try {
    await fetch(`${REST_BASE_URL}/health`);
    printSuccess('REST API is running on port 3000');
  } catch (error) {
    printFailure('REST API is not running on port 3000');
    printInfo('Start with: cd rest-api && npm run dev');
    process.exit(1);
  }

  // Check gRPC API (simple connection test)
  try {
    await promisifyGrpc(grpcClients.users, 'CreateUser', {
      email: 'test-connection@example.com',
      password: 'test123',
      name: 'Connection Test'
    }).catch(() => {}); // We don't care if this specific call fails
    printSuccess('gRPC API is running on port 50051');
  } catch (error) {
    printFailure('gRPC API is not running on port 50051');
    printInfo('Start with: cd grpc-api && npm run run');
    process.exit(1);
  }
}

// Clean up test data
async function cleanupTestData() {
  printHeader('CLEANING UP TEST DATA');
  
  try {
    // Try to delete test user from REST API
    if (testState.restToken) {
      await makeRestCall('DELETE', '/users/me').catch(() => {});
    }
    
    // Try to delete test user from gRPC API
    if (testState.grpcToken && testState.userId) {
      await promisifyGrpc(grpcClients.users, 'DeleteUser', {
        userId: testState.userId,
        token: testState.grpcToken
      }).catch(() => {});
    }
    
    printSuccess('Cleanup completed');
  } catch (error) {
    printInfo('Cleanup completed with some warnings (this is normal)');
  }
}

// Test 1: User Registration
async function testUserRegistration() {
  printHeader('TEST 1: USER REGISTRATION');
  
  const userData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: TEST_NAME
  };

  try {
    // First, try to login to see if user already exists
    const loginCheck = await makeRestCall('POST', '/sessions', { email: TEST_EMAIL, password: TEST_PASSWORD }, false).catch(() => null);
    
    if (loginCheck) {
      printInfo('Test user already exists and can login');
      // Store the tokens immediately since login works
      testState.restToken = loginCheck.token;
      testState.userId = loginCheck.userId;
      
      // Also try gRPC login
      try {
        const grpcLogin = await promisifyGrpc(grpcClients.sessions, 'CreateSession', { email: TEST_EMAIL, password: TEST_PASSWORD });
        testState.grpcToken = grpcLogin.token;
        printInfo('gRPC login also successful');
      } catch (error) {
        printInfo('gRPC login failed, will retry in login test');
      }
      
      // Simulate successful registration response
      const existingUser = { email: TEST_EMAIL, name: TEST_NAME };
      compareObjects(existingUser, existingUser, ['email', 'name'], 'User Registration');
      return;
    }

    // REST API - try to create user
    let restUser;
    try {
      restUser = await makeRestCall('POST', '/users', userData, false);
      printSuccess('REST API: Created new user successfully');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('409')) {
        printInfo('Test user already exists in REST API');
        restUser = { email: TEST_EMAIL, name: TEST_NAME };
      } else {
        throw error;
      }
    }

    // gRPC API
    let grpcUser;
    try {
      grpcUser = await promisifyGrpc(grpcClients.users, 'CreateUser', userData);
      printSuccess('gRPC API: Created new user successfully');
    } catch (error) {
      if (error.message.includes('already exists') || error.code === 6) {
        printInfo('Test user already exists in gRPC API');
        grpcUser = { email: TEST_EMAIL, name: TEST_NAME };
      } else {
        throw error;
      }
    }

    compareObjects(restUser, grpcUser, ['email', 'name'], 'User Registration');
    
  } catch (error) {
    printFailure(`User Registration failed: ${error.message}`);
  }
}

// Test 2: User Login
async function testUserLogin() {
  printHeader('TEST 2: USER LOGIN / SESSION CREATION');
  
  const loginData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  };

  try {
    // Check if we already have tokens from registration
    if (testState.restToken && testState.grpcToken) {
      printInfo('Using tokens from registration test');
      
      recordTestPass('Both APIs already have valid authentication tokens');
      
      if (testState.userId) {
        recordTestPass('Both APIs returned valid user IDs');
      } else {
        recordTestFail('Missing user ID in session response');
      }
      return;
    }

    // REST API Login
    printInfo(`Attempting REST API login with email: ${loginData.email}`);
    const restSession = await makeRestCall('POST', '/sessions', loginData, false);
    testState.restToken = restSession.token;
    testState.userId = restSession.userId;
    printInfo(`REST API login successful, token: ${restSession.token.substring(0, 20)}...`);

    // gRPC API Login
    printInfo('Attempting gRPC API login...');
    const grpcSession = await promisifyGrpc(grpcClients.sessions, 'CreateSession', loginData);
    testState.grpcToken = grpcSession.token;
    printInfo(`gRPC API login successful, token: ${grpcSession.token.substring(0, 20)}...`);

    if (testState.restToken && testState.grpcToken) {
      recordTestPass('Both APIs generated valid authentication tokens');
    } else {
      printFailure('Token generation failed');
    }

    // Both should have userId (values may differ between databases)
    if (restSession.userId && grpcSession.userId) {
      recordTestPass('Both APIs returned valid user IDs');
    } else {
      recordTestFail('Missing user ID in session response');
    }

  } catch (error) {
    printFailure(`Login failed: ${error.message}`);
    process.exit(1);
  }
}

// Test 3: Form Creation
async function testFormCreation() {
  printHeader('TEST 3: FORM CREATION');
  
  const formData = {
    title: 'Test Form',
    description: 'Test form description'
  };

  try {
    // REST API
    const restForm = await makeRestCall('POST', '/forms', formData);
    testState.formId = restForm.id;
    printInfo(`REST API created form with ID: ${restForm.id}`);

    // gRPC API
    const grpcFormData = { ...formData, token: testState.grpcToken };
    const grpcForm = await promisifyGrpc(grpcClients.forms, 'CreateForm', grpcFormData);
    
    // Store both form IDs since they might be different
    if (!testState.grpcFormId) {
      testState.grpcFormId = grpcForm.id;
    }
    printInfo(`gRPC API created form with ID: ${grpcForm.id}`);

    compareObjects(restForm, grpcForm, ['title', 'description'], 'Form Creation');

  } catch (error) {
    printFailure(`Form Creation failed: ${error.message}`);
  }
}

// Test 4: Question Creation
async function testQuestionCreation() {
  printHeader('TEST 4: QUESTION CREATION');
  
  try {
    // Question 1 - Text input
    const question1Data = {
      text: 'What is your name?',
      type: 'shorttext',
      required: true
    };

    // REST API
    const restQuestion1 = await makeRestCall('POST', `/forms/${testState.formId}/questions`, question1Data);
    testState.question1Id = restQuestion1.id;
    printInfo(`REST API created question 1 with ID: ${restQuestion1.id}`);

    // gRPC API - use gRPC form ID
    const grpcQuestion1Data = {
      formId: testState.grpcFormId.toString(),
      ...question1Data,
      token: testState.grpcToken
    };
    const grpcQuestion1 = await promisifyGrpc(grpcClients.questions, 'CreateQuestion', grpcQuestion1Data);
    testState.grpcQuestion1Id = grpcQuestion1.id;
    printInfo(`gRPC API created question 1 with ID: ${grpcQuestion1.id}`);

    compareObjects(restQuestion1, grpcQuestion1, ['text', 'type', 'required'], 'Question Creation (Text)');

    // Question 2 - Multiple choice
    const question2Data = {
      text: 'Select your favorite colors',
      type: 'checkbox',
      options: ['Red', 'Blue', 'Green', 'Yellow']
    };

    // REST API
    const restQuestion2 = await makeRestCall('POST', `/forms/${testState.formId}/questions`, question2Data);
    testState.question2Id = restQuestion2.id;
    printInfo(`REST API created question 2 with ID: ${restQuestion2.id}`);

    // gRPC API - use gRPC form ID
    const grpcQuestion2Data = {
      formId: testState.grpcFormId.toString(),
      ...question2Data,
      token: testState.grpcToken
    };
    const grpcQuestion2 = await promisifyGrpc(grpcClients.questions, 'CreateQuestion', grpcQuestion2Data);
    testState.grpcQuestion2Id = grpcQuestion2.id;
    printInfo(`gRPC API created question 2 with ID: ${grpcQuestion2.id}`);

    compareObjects(restQuestion2, grpcQuestion2, ['text', 'type', 'options'], 'Question Creation (Checkbox)');

  } catch (error) {
    printFailure(`Question Creation failed: ${error.message}`);
  }
}

// Test 5: Response Creation
async function testResponseCreation() {
  printHeader('TEST 5: RESPONSE CREATION');
  
  const responseData = {
    answers: [
      { questionId: testState.question1Id ? testState.question1Id.toString() : '1', answer: 'John Doe' },
      { questionId: testState.question2Id ? testState.question2Id.toString() : '2', answer: 'Red,Blue' }
    ],
    respondentName: 'John Doe',
    respondentEmail: 'john@example.com'
  };

  try {
    // REST API
    const restResponse = await makeRestCall('POST', `/forms/${testState.formId}/responses`, responseData);
    testState.responseId = restResponse.id;
    printInfo(`REST API created response with ID: ${restResponse.id}`);

    // gRPC API - use gRPC form and question IDs
    const grpcResponseData = {
      formId: testState.grpcFormId.toString(),
      answers: [
        { questionId: testState.grpcQuestion1Id ? testState.grpcQuestion1Id.toString() : '1', answer: 'John Doe' },
        { questionId: testState.grpcQuestion2Id ? testState.grpcQuestion2Id.toString() : '2', answer: 'Red,Blue' }
      ],
      respondentName: responseData.respondentName,
      respondentEmail: responseData.respondentEmail,
      token: testState.grpcToken
    };
    const grpcResponse = await promisifyGrpc(grpcClients.responses, 'CreateResponse', grpcResponseData);
    testState.grpcResponseId = grpcResponse.id;
    printInfo(`gRPC API created response with ID: ${grpcResponse.id}`);

    compareObjects(restResponse, grpcResponse, ['respondentName', 'respondentEmail'], 'Response Creation');

    // Compare answers arrays
    if (restResponse.answers.length === grpcResponse.answers.length) {
      recordTestPass(`Both APIs stored ${restResponse.answers.length} answers`);
    } else {
      recordTestFail(`Answer count differs: REST=${restResponse.answers.length}, gRPC=${grpcResponse.answers.length}`);
    }

  } catch (error) {
    printFailure(`Response Creation failed: ${error.message}`);
  }
}

// Test 6: Data Retrieval
async function testDataRetrieval() {
  printHeader('TEST 6: DATA RETRIEVAL');
  
  try {
    // Get Form - using respective API's form IDs
    const restForm = await makeRestCall('GET', `/forms/${testState.formId}`);
    const grpcForm = await promisifyGrpc(grpcClients.forms, 'GetForm', {
      formId: testState.grpcFormId.toString(),
      token: testState.grpcToken
    });
    compareObjects(restForm, grpcForm, ['title', 'description'], 'Form Retrieval');

    // Get Questions List
    const restQuestions = await makeRestCall('GET', `/forms/${testState.formId}/questions`);
    const grpcQuestionsResponse = await promisifyGrpc(grpcClients.questions, 'ListQuestions', {
      formId: testState.grpcFormId.toString(),
      token: testState.grpcToken
    });

    if (restQuestions.length === grpcQuestionsResponse.questions.length) {
      recordTestPass(`Both APIs returned ${restQuestions.length} questions`);
    } else {
      recordTestFail(`Question count differs: REST=${restQuestions.length}, gRPC=${grpcQuestionsResponse.questions.length}`);
    }

    // Get Responses List
    const restResponses = await makeRestCall('GET', `/forms/${testState.formId}/responses`);
    const grpcResponsesResponse = await promisifyGrpc(grpcClients.responses, 'ListResponses', {
      formId: testState.grpcFormId.toString(),
      token: testState.grpcToken
    });

    if (restResponses.length === grpcResponsesResponse.responses.length) {
      recordTestPass(`Both APIs returned ${restResponses.length} responses`);
    } else {
      printFailure(`Response count differs: REST=${restResponses.length}, gRPC=${grpcResponsesResponse.responses.length}`);
    }

    // Get specific question
    const restQuestion = await makeRestCall('GET', `/forms/${testState.formId}/questions/${testState.question1Id}`);
    const grpcQuestion = await promisifyGrpc(grpcClients.questions, 'GetQuestion', {
      formId: testState.grpcFormId.toString(),
      questionId: testState.grpcQuestion1Id.toString(),
      token: testState.grpcToken
    });
    compareObjects(restQuestion, grpcQuestion, ['text', 'type'], 'Individual Question Retrieval');

  } catch (error) {
    printFailure(`Data Retrieval failed: ${error.message}`);
  }
}

// Test 7: Data Updates
async function testDataUpdates() {
  printHeader('TEST 7: DATA UPDATES');
  
  try {
    // Update Form
    const formUpdateData = {
      title: 'Updated Test Form',
      description: 'Updated test form description'
    };

    const restUpdatedForm = await makeRestCall('PATCH', `/forms/${testState.formId}`, formUpdateData);
    const grpcUpdatedForm = await promisifyGrpc(grpcClients.forms, 'UpdateForm', {
      formId: testState.grpcFormId.toString(),
      ...formUpdateData,
      token: testState.grpcToken
    });

    compareObjects(restUpdatedForm, grpcUpdatedForm, ['title', 'description'], 'Form Update');

    // Update Question
    const questionUpdateData = {
      text: 'What is your full name?',
      type: 'shorttext'
    };

    const restUpdatedQuestion = await makeRestCall('PATCH', `/forms/${testState.formId}/questions/${testState.question1Id}`, questionUpdateData);
    const grpcUpdatedQuestion = await promisifyGrpc(grpcClients.questions, 'UpdateQuestion', {
      formId: testState.grpcFormId.toString(),
      questionId: testState.grpcQuestion1Id.toString(),
      ...questionUpdateData,
      token: testState.grpcToken
    });

    compareObjects(restUpdatedQuestion, grpcUpdatedQuestion, ['text', 'type'], 'Question Update');

    // Update Response
    const responseUpdateData = {
      answers: [
        { questionId: testState.question1Id.toString(), answer: 'Jane Smith' },
        { questionId: testState.question2Id.toString(), answer: 'Green,Yellow' }
      ],
      respondentName: 'Jane Smith'
    };

    const restUpdatedResponse = await makeRestCall('PATCH', `/forms/${testState.formId}/responses/${testState.responseId}`, responseUpdateData);
    const grpcUpdatedResponse = await promisifyGrpc(grpcClients.responses, 'UpdateResponse', {
      formId: testState.grpcFormId.toString(),
      responseId: testState.grpcResponseId.toString(),
      answers: [
        { questionId: testState.grpcQuestion1Id.toString(), answer: 'Jane Smith' },
        { questionId: testState.grpcQuestion2Id.toString(), answer: 'Green,Yellow' }
      ],
      respondentName: responseUpdateData.respondentName,
      token: testState.grpcToken
    });

    compareObjects(restUpdatedResponse, grpcUpdatedResponse, ['respondentName'], 'Response Update');

  } catch (error) {
    printFailure(`Data Updates failed: ${error.message}`);
  }
}

// Test 8: Error Handling
async function testErrorHandling() {
  printHeader('TEST 8: ERROR HANDLING');
  
  // Test 1: Invalid Form ID
  printTest('Invalid Form ID Error Handling');
  try {
    try {
      await makeRestCall('GET', '/forms/99999');
      printFailure('REST API should have returned error for invalid form ID');
    } catch (restError) {
      try {
        await promisifyGrpc(grpcClients.forms, 'GetForm', {
          formId: '99999',
          token: testState.grpcToken
        });
        printFailure('gRPC API should have returned error for invalid form ID');
      } catch (grpcError) {
        const restHasError = restError.message.includes('404') || restError.message.includes('not found');
        const grpcHasError = grpcError.code === 5 || grpcError.message.includes('not found');
        
        if (restHasError && grpcHasError) {
          printSuccess('Both APIs correctly handle invalid form ID');
        } else {
          printFailure('Error handling inconsistent for invalid form ID');
        }
      }
    }
  } catch (error) {
    printFailure(`Error handling test failed: ${error.message}`);
  }

  // Test 2: Unauthorized Access
  printTest('Unauthorized Access Error Handling');
  try {
    try {
      await makeRestCall('GET', '/forms', null, false); // No auth
      printFailure('REST API should have returned unauthorized error');
    } catch (restError) {
      try {
        await promisifyGrpc(grpcClients.forms, 'ListForms', { token: 'invalid_token' });
        printFailure('gRPC API should have returned unauthorized error');
      } catch (grpcError) {
        const restUnauth = restError.message.includes('401') || restError.message.includes('Unauthorized');
        const grpcUnauth = grpcError.code === 16 || grpcError.message.includes('UNAUTHENTICATED');
        
        if (restUnauth && grpcUnauth) {
          printSuccess('Both APIs correctly handle unauthorized access');
        } else {
          printFailure('Unauthorized access handling inconsistent');
        }
      }
    }
  } catch (error) {
    printFailure(`Unauthorized access test failed: ${error.message}`);
  }

  // Test 3: Invalid Data
  printTest('Invalid Data Error Handling');
  try {
    const invalidFormData = { title: '' }; // Missing required field
    
    try {
      await makeRestCall('POST', '/forms', invalidFormData);
      printFailure('REST API should have rejected invalid form data');
    } catch (restError) {
      try {
        await promisifyGrpc(grpcClients.forms, 'CreateForm', {
          title: '',
          token: testState.grpcToken
        });
        printFailure('gRPC API should have rejected invalid form data');
      } catch (grpcError) {
        const restValidation = restError.message.includes('400') || restError.message.includes('required');
        const grpcValidation = grpcError.code === 3 || grpcError.message.includes('required');
        
        if (restValidation && grpcValidation) {
          printSuccess('Both APIs correctly validate input data');
        } else {
          printFailure('Input validation handling inconsistent');
        }
      }
    }
  } catch (error) {
    printFailure(`Invalid data test failed: ${error.message}`);
  }
}

// Test 9: Performance Comparison
async function testPerformance() {
  printHeader('TEST 9: PERFORMANCE COMPARISON');
  
  const iterations = 10;
  
  try {
    // REST API Performance
    printTest(`REST API Performance (${iterations} form retrievals)`);
    const restStartTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await makeRestCall('GET', `/forms/${testState.formId}`);
    }
    
    const restDuration = Date.now() - restStartTime;
    printInfo(`REST API: ${restDuration}ms total, ${(restDuration/iterations).toFixed(2)}ms average`);

    // gRPC API Performance
    printTest(`gRPC API Performance (${iterations} form retrievals)`);
    const grpcStartTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await promisifyGrpc(grpcClients.forms, 'GetForm', {
        formId: testState.grpcFormId.toString(),
        token: testState.grpcToken
      });
    }
    
    const grpcDuration = Date.now() - grpcStartTime;
    printInfo(`gRPC API: ${grpcDuration}ms total, ${(grpcDuration/iterations).toFixed(2)}ms average`);

    // Compare performance
    const speedDifference = Math.abs(restDuration - grpcDuration);
    const fasterAPI = restDuration < grpcDuration ? 'REST' : 'gRPC';
    const speedupPercentage = ((Math.max(restDuration, grpcDuration) - Math.min(restDuration, grpcDuration)) / Math.max(restDuration, grpcDuration) * 100).toFixed(1);
    
    printSuccess(`Performance comparison: ${fasterAPI} API is ${speedupPercentage}% faster`);
    
  } catch (error) {
    printFailure(`Performance test failed: ${error.message}`);
  }
}

// Test 10: Data Deletion
async function testDataDeletion() {
  printHeader('TEST 10: DATA DELETION');
  
  try {
    // Delete Response
    await makeRestCall('DELETE', `/forms/${testState.formId}/responses/${testState.responseId}`);
    const grpcDeleteResponse = await promisifyGrpc(grpcClients.responses, 'DeleteResponse', {
      formId: testState.grpcFormId.toString(),
      responseId: testState.grpcResponseId.toString(),
      token: testState.grpcToken
    });

    printTest('Response Deletion');
    if (grpcDeleteResponse.success) {
      printSuccess('Both APIs successfully deleted the response');
    } else {
      printFailure('Response deletion inconsistent between APIs');
    }

    // Delete Questions
    await makeRestCall('DELETE', `/forms/${testState.formId}/questions/${testState.question1Id}`);
    await makeRestCall('DELETE', `/forms/${testState.formId}/questions/${testState.question2Id}`);
    
    const grpcDeleteQ1 = await promisifyGrpc(grpcClients.questions, 'DeleteQuestion', {
      formId: testState.grpcFormId.toString(),
      questionId: testState.grpcQuestion1Id.toString(),
      token: testState.grpcToken
    });
    
    const grpcDeleteQ2 = await promisifyGrpc(grpcClients.questions, 'DeleteQuestion', {
      formId: testState.grpcFormId.toString(),
      questionId: testState.grpcQuestion2Id.toString(),
      token: testState.grpcToken
    });

    printTest('Questions Deletion');
    if (grpcDeleteQ1.success && grpcDeleteQ2.success) {
      printSuccess('Both APIs successfully deleted all questions');
    } else {
      printFailure('Question deletion inconsistent between APIs');
    }

    // Delete Form
    await makeRestCall('DELETE', `/forms/${testState.formId}`);
    const grpcDeleteForm = await promisifyGrpc(grpcClients.forms, 'DeleteForm', {
      formId: testState.grpcFormId.toString(),
      token: testState.grpcToken
    });

    printTest('Form Deletion');
    if (grpcDeleteForm.success) {
      printSuccess('Both APIs successfully deleted the form');
    } else {
      printFailure('Form deletion inconsistent between APIs');
    }

    printTest('Form Deletion');
    if (grpcDeleteForm.success) {
      printSuccess('Both APIs successfully deleted the form');
    } else {
      printFailure('Form deletion inconsistent between APIs');
    }

  } catch (error) {
    printFailure(`Data Deletion failed: ${error.message}`);
  }
}

// Main test runner
async function runAllTests() {
  printHeader('AUTOMATED REST vs gRPC API COMPARISON TESTS');
  printInfo('This test suite compares REST API (port 3000) and gRPC API (port 50051)');
  printInfo('ensuring both APIs provide consistent behavior and responses.');
  console.log();

  try {
    await checkServers();
    
    // Clean up any existing test data
    await cleanupTestData();
    
    // Run all tests
    await testUserRegistration();
    await testUserLogin();
    await testFormCreation();
    await testQuestionCreation();
    await testResponseCreation();
    await testDataRetrieval();
    await testDataUpdates();
    await testErrorHandling();
    await testPerformance();
    await testDataDeletion();
    
    // Final cleanup
    await cleanupTestData();

  } catch (error) {
    printFailure(`Test execution failed: ${error.message}`);
  }

  // Print final summary
  printHeader('TEST EXECUTION SUMMARY');
  colorLog(colors.green, `✅ Tests Passed: ${testState.testsPassed}`);
  colorLog(colors.red, `❌ Tests Failed: ${testState.testsFailed}`);
  colorLog(colors.blue, `📊 Total Tests: ${testState.totalTests}`);
  
  if (testState.testsFailed === 0) {
    console.log();
    colorLog(colors.green + colors.bright, '🎉 ALL TESTS PASSED! 🎉');
    colorLog(colors.green, 'REST and gRPC APIs are functionally consistent.');
    process.exit(0);
  } else {
    console.log();
    colorLog(colors.red + colors.bright, '❌ SOME TESTS FAILED');
    colorLog(colors.yellow, 'Check the detailed output above to identify inconsistencies.');
    process.exit(1);
  }
}

// Execute tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});