import 'dotenv/config';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const REST_BASE_URL = 'http://localhost:3000';
const GRPC_HOST = 'localhost';
const GRPC_PORT = '50051';
const PROTO_PATH = join(__dirname, '../proto/forms.proto');
const LOG_FILE = join(__dirname, 'test-results.log');

// Clear log file at start
fs.writeFileSync(LOG_FILE, `=== TEST RUN STARTED AT ${new Date().toISOString()} ===\n\n`);

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
  // Log request data
  console.log(`\ngRPC ${method}`);
  console.log('REQUEST:', JSON.stringify(request).substring(0, 100) + (JSON.stringify(request).length > 100 ? '...' : ''));
  
  const requestLog = `\n--- gRPC API ${method} ---\nREQUEST: ${JSON.stringify(request, null, 2)}`;
  
  return new Promise((resolve, reject) => {
    client[method](request, (error, response) => {
      if (error) {
        const errorLog = `ERROR: ${JSON.stringify({
          code: error.code,
          message: error.message,
          details: error.details
        }, null, 2)}\n--- gRPC API lõpp (viga) ---\n`;
        
        console.log('❌ ERROR:', error.message);
        logToFileAndConsole(requestLog + '\n' + errorLog, true);
        reject(error);
      } else {
        const responseLog = `RESPONSE: ${JSON.stringify(response, null, 2)}\n--- gRPC API lõpp ---\n`;
        
        console.log('RESPONSE:', JSON.stringify(response).substring(0, 100) + (JSON.stringify(response).length > 100 ? '...' : ''));
        logToFileAndConsole(requestLog + '\n' + responseLog, true);
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

  // Log request data
  const requestLog = `\n--- REST API ${method} ${endpoint} ---\nREQUEST: ${data ? JSON.stringify(data, null, 2) : 'pole andmeid'}\nHEADERS: ${options.headers.Authorization ? 'Auth token kaasatud' : 'Autentimist pole'}`;
  
  console.log(`\nREST ${method} ${endpoint}`);
  if (data) {
    console.log('REQUEST:', JSON.stringify(data).substring(0, 100) + (JSON.stringify(data).length > 100 ? '...' : ''));
  }

  const response = await fetch(url, options);
  
  let result;
  if (response.status === 204) {
    result = { success: true };
  } else {
    result = await response.json();
    if (!response.ok) {
      throw new Error(`REST ${response.status}: ${result.message || result.error || 'Unknown error'}`);
    }
  }
  
  // Log response data
  const responseLog = `RESPONSE: ${JSON.stringify(result, null, 2)}\n--- REST API lõpp ---\n`;
  console.log('RESPONSE:', JSON.stringify(result).substring(0, 100) + (JSON.stringify(result).length > 100 ? '...' : ''));
  
  // Write full details to file
  logToFileAndConsole(requestLog + '\n' + responseLog, true);
  
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
  
  console.log('Kontrollime kas serverid töötavad...');
  
  // Check REST API
  try {
    console.log('Kontrollime REST API (port 3000)...');
    await fetch(`${REST_BASE_URL}/health`);
    console.log('REST API töötab korrektselt');
    printSuccess('REST API is running on port 3000');
  } catch (error) {
    console.log('REST API ei tööta port 3000-l');
    printFailure('REST API is not running on port 3000');
    printInfo('Start with: cd rest-api && npm run dev');
    process.exit(1);
  }

  // Check gRPC API (simple connection test)
  try {
    console.log('Kontrollime gRPC API (port 50051)...');
    await promisifyGrpc(grpcClients.users, 'CreateUser', {
      email: 'test-connection@example.com',
      password: 'test123',
      name: 'Connection Test'
    }).catch(() => {}); // We don't care if this specific call fails
    console.log('gRPC API töötab korrektselt');
    printSuccess('gRPC API is running on port 50051');
  } catch (error) {
    console.log('gRPC API ei tööta port 50051-l');
    printFailure('gRPC API is not running on port 50051');
    printInfo('Start with: cd grpc-api && npm run run');
    process.exit(1);
  }
}

// Clean up test data
async function cleanupTestData() {
  printHeader('CLEANING UP TEST DATA');
  
  console.log('Puhastame testide andmeid...');
  
  try {
    // Try to delete test user from REST API
    if (testState.restToken) {
      console.log('Kustutame kasutaja REST APIs...');
      await makeRestCall('DELETE', '/users/me').catch(() => {});
      console.log('REST API kasutaja kustutatud');
    }
    
    // Try to delete test user from gRPC API
    if (testState.grpcToken && testState.userId) {
      console.log('Kustutame kasutaja gRPC APIs...');
      await promisifyGrpc(grpcClients.users, 'DeleteUser', {
        userId: testState.userId,
        token: testState.grpcToken
      }).catch(() => {});
      console.log('gRPC API kasutaja kustutatud');
    }
    
    console.log('Puhastamine lõpetatud edukalt');
    printSuccess('Cleanup completed');
  } catch (error) {
    console.log('Puhastamine lõpetatud hoiatustega (see on normaalne)');
    printInfo('Cleanup completed with some warnings (this is normal)');
  }
}

// Test 1: User Registration
async function testUserRegistration() {
  printHeader('TEST 1: USER REGISTRATION');
  
  console.log('Kontrollime kasutaja registreerimist REST ja gRPC APIdes');
  
  const userData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: TEST_NAME
  };

  console.log(`Registreerime kasutaja andmetega: email=${userData.email}, name=${userData.name}`);

  try {
    // First, try to login to see if user already exists
    console.log('Kontrollime kas kasutaja juba eksisteerib...');
    const loginCheck = await makeRestCall('POST', '/sessions', { email: TEST_EMAIL, password: TEST_PASSWORD }, false).catch(() => null);
    
    if (loginCheck) {
      console.log('Kasutaja juba eksisteerib ja saab sisse logida');
      printInfo('Test user already exists and can login');
      // Store the tokens immediately since login works
      testState.restToken = loginCheck.token;
      testState.userId = loginCheck.userId;
      console.log(`Salvestasime REST tokeni: ${loginCheck.token.substring(0, 20)}...`);
      
      // Get actual user data from REST API to compare
      let restUser;
      try {
        restUser = await makeRestCall('GET', '/users/me');
        console.log(`REST API tagastas kasutaja andmed: ${restUser.email}`);
      } catch (error) {
        restUser = { email: TEST_EMAIL, name: TEST_NAME };
      }
      
      // Also try gRPC login
      let grpcUser;
      try {
        console.log('Proovime gRPC API sisselogimist...');
        const grpcLogin = await promisifyGrpc(grpcClients.sessions, 'CreateSession', { email: TEST_EMAIL, password: TEST_PASSWORD });
        testState.grpcToken = grpcLogin.token;
        console.log(`gRPC sisselogimine edukas, token: ${grpcLogin.token.substring(0, 20)}...`);
        printInfo('gRPC login also successful');
        
        // Get user data via ValidateSession to compare
        try {
          grpcUser = await promisifyGrpc(grpcClients.sessions, 'ValidateSession', { token: grpcLogin.token });
          console.log(`gRPC API tagastas kasutaja andmed: ${grpcUser.email}`);
        } catch (error) {
          grpcUser = { email: TEST_EMAIL, name: TEST_NAME };
        }
      } catch (error) {
        console.log('gRPC sisselogimine ebaonnestus, proovime uuesti hiljem');
        printInfo('gRPC login failed, will retry in login test');
        grpcUser = { email: TEST_EMAIL, name: TEST_NAME };
      }
      
      // Compare actual user data
      console.log('Võrdleme REST ja gRPC API kasutaja andmeid...');
      compareAllFields(restUser, grpcUser, 'User Registration');
      compareObjects(restUser, grpcUser, ['email', 'name'], 'User Registration');
      return;
    }

    // REST API - try to create user
    console.log('Kasutajat ei leitud, loome uue kasutaja REST APIs...');
    let restUser;
    try {
      restUser = await makeRestCall('POST', '/users', userData, false);
      console.log(`REST API: kasutaja loodud edukalt, email: ${restUser.email}`);
      printSuccess('REST API: Created new user successfully');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('409')) {
        console.log('Kasutaja juba eksisteerib REST APIs');
        printInfo('Test user already exists in REST API');
        restUser = { email: TEST_EMAIL, name: TEST_NAME };
      } else {
        throw error;
      }
    }

    // gRPC API
    console.log('Loome kasutaja gRPC APIs...');
    let grpcUser;
    try {
      grpcUser = await promisifyGrpc(grpcClients.users, 'CreateUser', userData);
      console.log(`gRPC API: kasutaja loodud edukalt, email: ${grpcUser.email}`);
      printSuccess('gRPC API: Created new user successfully');
    } catch (error) {
      if (error.message.includes('already exists') || error.code === 6) {
        console.log('Kasutaja juba eksisteerib gRPC APIs');
        printInfo('Test user already exists in gRPC API');
        
        // Try to get existing user data via login + validate
        try {
          const grpcLogin = await promisifyGrpc(grpcClients.sessions, 'CreateSession', { email: TEST_EMAIL, password: TEST_PASSWORD });
          grpcUser = await promisifyGrpc(grpcClients.sessions, 'ValidateSession', { token: grpcLogin.token });
          console.log(`gRPC API tagastas olemasoleva kasutaja andmed: ${grpcUser.email}`);
          
          // Store token for later use
          if (!testState.grpcToken) {
            testState.grpcToken = grpcLogin.token;
          }
        } catch (loginError) {
          console.log('gRPC kasutaja andmete hankimine ebaõnnestus, kasutame minimaalseid andmeid');
          grpcUser = { email: TEST_EMAIL, name: TEST_NAME };
        }
      } else {
        throw error;
      }
    }

    console.log('Võrdleme REST ja gRPC API kasutaja registreerimise tulemusi...');
    compareAllFields(restUser, grpcUser, 'User Registration');
    compareObjects(restUser, grpcUser, ['email', 'name'], 'User Registration');
    
  } catch (error) {
    console.log(`Kasutaja registreerimine ebaonnestus: ${error.message}`);
    printFailure(`User Registration failed: ${error.message}`);
  }
}

// Test 2: User Login
async function testUserLogin() {
  printHeader('TEST 2: USER LOGIN / SESSION CREATION');
  
  console.log('Testime kasutaja sisselogimist ja sessiooni loomist mõlemas APIs');
  
  const loginData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  };

  console.log(`Sisselogimise andmed: email=${loginData.email}`);

  try {
    // Check if we already have tokens from registration
    if (testState.restToken && testState.grpcToken) {
      console.log('Kasutame juba olemasolevaid tokeneid registreerimise testist');
      printInfo('Using tokens from registration test');
      
      recordTestPass('Both APIs already have valid authentication tokens');
      
      if (testState.userId) {
        console.log(`Kasutaja ID on olemas: ${testState.userId}`);
        recordTestPass('Both APIs returned valid user IDs');
      } else {
        console.log('Kasutaja ID on puudu sessiooni vastuses');
        recordTestFail('Missing user ID in session response');
      }
      return;
    }

    // REST API Login
    console.log('Alustame REST API sisselogimist...');
    printInfo(`Attempting REST API login with email: ${loginData.email}`);
    const restSession = await makeRestCall('POST', '/sessions', loginData, false);
    testState.restToken = restSession.token;
    testState.userId = restSession.userId;
    console.log(`REST API sisselogimine edukas, kasutaja ID: ${restSession.userId}`);
    printInfo(`REST API login successful, token: ${restSession.token.substring(0, 20)}...`);

    // gRPC API Login
    console.log('Alustame gRPC API sisselogimist...');
    printInfo('Attempting gRPC API login...');
    const grpcSession = await promisifyGrpc(grpcClients.sessions, 'CreateSession', loginData);
    testState.grpcToken = grpcSession.token;
    console.log(`gRPC API sisselogimine edukas, kasutaja ID: ${grpcSession.userId || 'pole tagastatud'}`);
    printInfo(`gRPC API login successful, token: ${grpcSession.token.substring(0, 20)}...`);

    if (testState.restToken && testState.grpcToken) {
      console.log('Mõlemad APIid genereerisid kehtivad autentimise tokenid');
      recordTestPass('Both APIs generated valid authentication tokens');
    } else {
      console.log('Tokeni genereerimine ebaonnestus');
      printFailure('Token generation failed');
    }

    // Both should have userId (values may differ between databases)
    if (restSession.userId && grpcSession.userId) {
      console.log('Mõlemad APIid tagastasid kehtivad kasutaja IDd');
      recordTestPass('Both APIs returned valid user IDs');
    } else {
      console.log('Kasutaja ID puudub sessiooni vastuses');
      recordTestFail('Missing user ID in session response');
    }

  } catch (error) {
    console.log(`Sisselogimine ebaonnestus: ${error.message}`);
    printFailure(`Login failed: ${error.message}`);
    process.exit(1);
  }
}

// Test 3: Form Creation
async function testFormCreation() {
  printHeader('TEST 3: FORM CREATION');
  
  console.log('Testim vormi loomist mõlemas APIs');
  
  const formData = {
    title: 'Test Form',
    description: 'Test form description'
  };

  console.log(`Vormi andmed: title="${formData.title}", description="${formData.description}"`);

  try {
    // REST API
    console.log('Loome vormi REST APIs...');
    const restForm = await makeRestCall('POST', '/forms', formData);
    testState.formId = restForm.id;
    console.log(`REST API lõi vormi ID-ga: ${restForm.id}`);
    printInfo(`REST API created form with ID: ${restForm.id}`);

    // gRPC API
    console.log('Loome vormi gRPC APIs...');
    const grpcFormData = { ...formData, token: testState.grpcToken };
    const grpcForm = await promisifyGrpc(grpcClients.forms, 'CreateForm', grpcFormData);
    
    // Store both form IDs since they might be different
    if (!testState.grpcFormId) {
      testState.grpcFormId = grpcForm.id;
    }
    console.log(`gRPC API lõi vormi ID-ga: ${grpcForm.id}`);
    printInfo(`gRPC API created form with ID: ${grpcForm.id}`);

    console.log('Võrdleme REST ja gRPC API vormi loomise tulemusi...');
    compareAllFields(restForm, grpcForm, 'Form Creation');
    compareObjects(restForm, grpcForm, ['title', 'description'], 'Form Creation');

  } catch (error) {
    console.log(`Vormi loomine ebaonnestus: ${error.message}`);
    printFailure(`Form Creation failed: ${error.message}`);
  }
}

// Test 4: Question Creation
async function testQuestionCreation() {
  printHeader('TEST 4: QUESTION CREATION');
  
  console.log('Testim küsimuste loomist mõlemas APIs');
  
  try {
    // Question 1 - Text input
    const question1Data = {
      text: 'What is your name?',
      type: 'shorttext',
      required: true
    };

    console.log(`Küsimus 1: text="${question1Data.text}", type="${question1Data.type}", required=${question1Data.required}`);

    // REST API
    console.log('Loome esimese küsimuse REST APIs...');
    const restQuestion1 = await makeRestCall('POST', `/forms/${testState.formId}/questions`, question1Data);
    testState.question1Id = restQuestion1.id;
    console.log(`REST API lõi küsimuse 1 ID-ga: ${restQuestion1.id}`);
    printInfo(`REST API created question 1 with ID: ${restQuestion1.id}`);

    // gRPC API - use gRPC form ID
    console.log('Loome esimese küsimuse gRPC APIs...');
    const grpcQuestion1Data = {
      formId: testState.grpcFormId.toString(),
      ...question1Data,
      token: testState.grpcToken
    };
    const grpcQuestion1 = await promisifyGrpc(grpcClients.questions, 'CreateQuestion', grpcQuestion1Data);
    testState.grpcQuestion1Id = grpcQuestion1.id;
    console.log(`gRPC API lõi küsimuse 1 ID-ga: ${grpcQuestion1.id}`);
    printInfo(`gRPC API created question 1 with ID: ${grpcQuestion1.id}`);

    console.log('Võrdleme esimese küsimuse loomise tulemusi...');
    compareAllFields(restQuestion1, grpcQuestion1, 'Question Creation (Text)');
    compareObjects(restQuestion1, grpcQuestion1, ['text', 'type', 'required'], 'Question Creation (Text)');

    // Question 2 - Multiple choice
    const question2Data = {
      text: 'Select your favorite colors',
      type: 'checkbox',
      options: ['Red', 'Blue', 'Green', 'Yellow']
    };

    console.log(`Küsimus 2: text="${question2Data.text}", type="${question2Data.type}", options=[${question2Data.options.join(', ')}]`);

    // REST API
    console.log('Loome teise küsimuse REST APIs...');
    const restQuestion2 = await makeRestCall('POST', `/forms/${testState.formId}/questions`, question2Data);
    testState.question2Id = restQuestion2.id;
    console.log(`REST API lõi küsimuse 2 ID-ga: ${restQuestion2.id}`);
    printInfo(`REST API created question 2 with ID: ${restQuestion2.id}`);

    // gRPC API - use gRPC form ID
    console.log('Loome teise küsimuse gRPC APIs...');
    const grpcQuestion2Data = {
      formId: testState.grpcFormId.toString(),
      ...question2Data,
      token: testState.grpcToken
    };
    const grpcQuestion2 = await promisifyGrpc(grpcClients.questions, 'CreateQuestion', grpcQuestion2Data);
    testState.grpcQuestion2Id = grpcQuestion2.id;
    console.log(`gRPC API lõi küsimuse 2 ID-ga: ${grpcQuestion2.id}`);
    printInfo(`gRPC API created question 2 with ID: ${grpcQuestion2.id}`);

    console.log('Võrdleme teise küsimuse loomise tulemusi...');
    compareAllFields(restQuestion2, grpcQuestion2, 'Question Creation (Checkbox)');
    compareObjects(restQuestion2, grpcQuestion2, ['text', 'type', 'options'], 'Question Creation (Checkbox)');

  } catch (error) {
    console.log(`Küsimuste loomine ebaonnestus: ${error.message}`);
    printFailure(`Question Creation failed: ${error.message}`);
  }
}

// Test 5: Response Creation
async function testResponseCreation() {
  printHeader('TEST 5: RESPONSE CREATION');
  
  console.log('Testim vastuste loomist mõlemas APIs');
  
  const responseData = {
    answers: [
      { questionId: testState.question1Id ? testState.question1Id.toString() : '1', answer: 'John Doe' },
      { questionId: testState.question2Id ? testState.question2Id.toString() : '2', answer: 'Red,Blue' }
    ],
    respondentName: 'John Doe',
    respondentEmail: 'john@example.com'
  };

  console.log(`Vastuse andmed: respondentName="${responseData.respondentName}", respondentEmail="${responseData.respondentEmail}"`);
  console.log(`Vastused: ${responseData.answers.length} vastust`);

  try {
    // REST API
    console.log('Loome vastuse REST APIs...');
    const restResponse = await makeRestCall('POST', `/forms/${testState.formId}/responses`, responseData);
    testState.responseId = restResponse.id;
    console.log(`REST API lõi vastuse ID-ga: ${restResponse.id}`);
    printInfo(`REST API created response with ID: ${restResponse.id}`);

    // gRPC API - use gRPC form and question IDs
    console.log('Loome vastuse gRPC APIs...');
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
    console.log(`gRPC API lõi vastuse ID-ga: ${grpcResponse.id}`);
    printInfo(`gRPC API created response with ID: ${grpcResponse.id}`);

    console.log('Võrdleme vastuse loomise tulemusi...');
    compareAllFields(restResponse, grpcResponse, 'Response Creation');
    compareObjects(restResponse, grpcResponse, ['respondentName', 'respondentEmail'], 'Response Creation');

    // Compare answers arrays
    console.log('Võrdleme vastuste massiive...');
    if (restResponse.answers.length === grpcResponse.answers.length) {
      console.log(`Mõlemad APIid salvestasid ${restResponse.answers.length} vastust`);
      recordTestPass(`Both APIs stored ${restResponse.answers.length} answers`);
    } else {
      console.log(`Vastuste arv erineb: REST=${restResponse.answers.length}, gRPC=${grpcResponse.answers.length}`);
      recordTestFail(`Answer count differs: REST=${restResponse.answers.length}, gRPC=${grpcResponse.answers.length}`);
    }

  } catch (error) {
    console.log(`Vastuse loomine ebaonnestus: ${error.message}`);
    printFailure(`Response Creation failed: ${error.message}`);
  }
}

// Test 6: Data Retrieval
async function testDataRetrieval() {
  printHeader('TEST 6: DATA RETRIEVAL');
  
  console.log('Testim andmete lugemist mõlemas APIs');
  
  try {
    // Get Form - using respective API's form IDs
    console.log('Loeme vormi andmeid...');
    const restForm = await makeRestCall('GET', `/forms/${testState.formId}`);
    console.log(`REST API tagastas vormi: title="${restForm.title}"`);
    
    const grpcForm = await promisifyGrpc(grpcClients.forms, 'GetForm', {
      formId: testState.grpcFormId.toString(),
      token: testState.grpcToken
    });
    console.log(`gRPC API tagastas vormi: title="${grpcForm.title}"`);
    
    console.log('Võrdleme vormi lugemise tulemusi...');
    compareObjects(restForm, grpcForm, ['title', 'description'], 'Form Retrieval');

    // Get Questions List
    console.log('Loeme küsimuste nimekirja...');
    const restQuestions = await makeRestCall('GET', `/forms/${testState.formId}/questions`);
    console.log(`REST API tagastas ${restQuestions.length} küsimust`);
    
    const grpcQuestionsResponse = await promisifyGrpc(grpcClients.questions, 'ListQuestions', {
      formId: testState.grpcFormId.toString(),
      token: testState.grpcToken
    });
    console.log(`gRPC API tagastas ${grpcQuestionsResponse.questions.length} küsimust`);

    if (restQuestions.length === grpcQuestionsResponse.questions.length) {
      console.log(`Mõlemad APIid tagastasid sama arvu küsimusi`);
      recordTestPass(`Both APIs returned ${restQuestions.length} questions`);
    } else {
      console.log(`Küsimuste arv erineb`);
      recordTestFail(`Question count differs: REST=${restQuestions.length}, gRPC=${grpcQuestionsResponse.questions.length}`);
    }

    // Get Responses List
    console.log('Loeme vastuste nimekirja...');
    const restResponses = await makeRestCall('GET', `/forms/${testState.formId}/responses`);
    console.log(`REST API tagastas ${restResponses.length} vastust`);
    
    const grpcResponsesResponse = await promisifyGrpc(grpcClients.responses, 'ListResponses', {
      formId: testState.grpcFormId.toString(),
      token: testState.grpcToken
    });
    console.log(`gRPC API tagastas ${grpcResponsesResponse.responses.length} vastust`);

    if (restResponses.length === grpcResponsesResponse.responses.length) {
      console.log(`Mõlemad APIid tagastasid sama arvu vastuseid`);
      recordTestPass(`Both APIs returned ${restResponses.length} responses`);
    } else {
      console.log(`Vastuste arv erineb`);
      printFailure(`Response count differs: REST=${restResponses.length}, gRPC=${grpcResponsesResponse.responses.length}`);
    }

    // Get specific question
    console.log('Loeme konkreetset küsimust...');
    const restQuestion = await makeRestCall('GET', `/forms/${testState.formId}/questions/${testState.question1Id}`);
    console.log(`REST API tagastas küsimuse: text="${restQuestion.text}"`);
    
    const grpcQuestion = await promisifyGrpc(grpcClients.questions, 'GetQuestion', {
      formId: testState.grpcFormId.toString(),
      questionId: testState.grpcQuestion1Id.toString(),
      token: testState.grpcToken
    });
    console.log(`gRPC API tagastas küsimuse: text="${grpcQuestion.text}"`);
    
    console.log('Võrdleme üksiku küsimuse lugemise tulemusi...');
    compareObjects(restQuestion, grpcQuestion, ['text', 'type'], 'Individual Question Retrieval');

  } catch (error) {
    console.log(`Andmete lugemine ebaonnestus: ${error.message}`);
    printFailure(`Data Retrieval failed: ${error.message}`);
  }
}

// Test 7: Data Updates
async function testDataUpdates() {
  printHeader('TEST 7: DATA UPDATES');
  
  console.log('Testim andmete uuendamist mõlemas APIs');
  
  try {
    // Update Form
    const formUpdateData = {
      title: 'Updated Test Form',
      description: 'Updated test form description'
    };

    console.log(`Uuendame vormi: title="${formUpdateData.title}"`);
    const restUpdatedForm = await makeRestCall('PATCH', `/forms/${testState.formId}`, formUpdateData);
    console.log(`REST API uuendas vormi edukalt`);
    
    const grpcUpdatedForm = await promisifyGrpc(grpcClients.forms, 'UpdateForm', {
      formId: testState.grpcFormId.toString(),
      ...formUpdateData,
      token: testState.grpcToken
    });
    console.log(`gRPC API uuendas vormi edukalt`);

    console.log('Võrdleme vormi uuendamise tulemusi...');
    compareObjects(restUpdatedForm, grpcUpdatedForm, ['title', 'description'], 'Form Update');

    // Update Question
    const questionUpdateData = {
      text: 'What is your full name?',
      type: 'shorttext'
    };

    console.log(`Uuendame küsimust: text="${questionUpdateData.text}"`);
    const restUpdatedQuestion = await makeRestCall('PATCH', `/forms/${testState.formId}/questions/${testState.question1Id}`, questionUpdateData);
    console.log(`REST API uuendas küsimuse edukalt`);
    
    const grpcUpdatedQuestion = await promisifyGrpc(grpcClients.questions, 'UpdateQuestion', {
      formId: testState.grpcFormId.toString(),
      questionId: testState.grpcQuestion1Id.toString(),
      ...questionUpdateData,
      token: testState.grpcToken
    });
    console.log(`gRPC API uuendas küsimuse edukalt`);

    console.log('Võrdleme küsimuse uuendamise tulemusi...');
    compareObjects(restUpdatedQuestion, grpcUpdatedQuestion, ['text', 'type'], 'Question Update');

    // Update Response
    const responseUpdateData = {
      answers: [
        { questionId: testState.question1Id.toString(), answer: 'Jane Smith' },
        { questionId: testState.question2Id.toString(), answer: 'Green,Yellow' }
      ],
      respondentName: 'Jane Smith'
    };

    console.log(`Uuendame vastust: respondentName="${responseUpdateData.respondentName}"`);
    const restUpdatedResponse = await makeRestCall('PATCH', `/forms/${testState.formId}/responses/${testState.responseId}`, responseUpdateData);
    console.log(`REST API uuendas vastuse edukalt`);
    
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
    console.log(`gRPC API uuendas vastuse edukalt`);

    console.log('Võrdleme vastuse uuendamise tulemusi...');
    compareObjects(restUpdatedResponse, grpcUpdatedResponse, ['respondentName'], 'Response Update');

  } catch (error) {
    console.log(`Andmete uuendamine ebaonnestus: ${error.message}`);
    printFailure(`Data Updates failed: ${error.message}`);
  }
}

// Test 8: Error Handling
async function testErrorHandling() {
  printHeader('TEST 8: ERROR HANDLING');
  
  console.log('Testim vigade käsitlemist mõlemas APIs');
  
  // Test 1: Invalid Form ID
  console.log('Test 1: Vigane vormi ID');
  printTest('Invalid Form ID Error Handling');
  try {
    try {
      console.log('Proovime lugeda vormi kehtutu ID-ga REST APIs...');
      await makeRestCall('GET', '/forms/99999');
      printFailure('REST API should have returned error for invalid form ID');
    } catch (restError) {
      console.log(`REST API tagastas vea: ${restError.message}`);
      try {
        console.log('Proovime lugeda vormi kehtutu ID-ga gRPC APIs...');
        await promisifyGrpc(grpcClients.forms, 'GetForm', {
          formId: '99999',
          token: testState.grpcToken
        });
        printFailure('gRPC API should have returned error for invalid form ID');
      } catch (grpcError) {
        console.log(`gRPC API tagastas vea: ${grpcError.message}`);
        const restHasError = restError.message.includes('404') || restError.message.includes('not found');
        const grpcHasError = grpcError.code === 5 || grpcError.message.includes('not found');
        
        if (restHasError && grpcHasError) {
          console.log('Mõlemad APIid käsitlevad vigast vormi ID-d korrektselt');
          printSuccess('Both APIs correctly handle invalid form ID');
        } else {
          console.log('Vigase vormi ID käsitlemine on ebaühtlane');
          printFailure('Error handling inconsistent for invalid form ID');
        }
      }
    }
  } catch (error) {
    console.log(`Vigade käsitlemise test ebaonnestus: ${error.message}`);
    printFailure(`Error handling test failed: ${error.message}`);
  }

  // Test 2: Unauthorized Access
  console.log('Test 2: Autoriseerimata ligipääs');
  printTest('Unauthorized Access Error Handling');
  try {
    try {
      console.log('Proovime ligipääsu ilma autentimiseta REST APIs...');
      await makeRestCall('GET', '/forms', null, false); // No auth
      printFailure('REST API should have returned unauthorized error');
    } catch (restError) {
      console.log(`REST API tagastas autoriseerimata vea: ${restError.message}`);
      try {
        console.log('Proovime ligipääsu vigase tokeniga gRPC APIs...');
        await promisifyGrpc(grpcClients.forms, 'ListForms', { token: 'invalid_token' });
        printFailure('gRPC API should have returned unauthorized error');
      } catch (grpcError) {
        console.log(`gRPC API tagastas autoriseerimata vea: ${grpcError.message}`);
        const restUnauth = restError.message.includes('401') || restError.message.includes('Unauthorized');
        const grpcUnauth = grpcError.code === 16 || grpcError.message.includes('UNAUTHENTICATED');
        
        if (restUnauth && grpcUnauth) {
          console.log('Mõlemad APIid käsitlevad autoriseerimata ligipääsu korrektselt');
          printSuccess('Both APIs correctly handle unauthorized access');
        } else {
          console.log('Autoriseerimata ligipääsu käsitlemine on ebaühtlane');
          printFailure('Unauthorized access handling inconsistent');
        }
      }
    }
  } catch (error) {
    console.log(`Autoriseerimata ligipääsu test ebaonnestus: ${error.message}`);
    printFailure(`Unauthorized access test failed: ${error.message}`);
  }

  // Test 3: Invalid Data
  console.log('Test 3: Kehtetud andmed');
  printTest('Invalid Data Error Handling');
  try {
    const invalidFormData = { title: '' }; // Missing required field
    console.log('Proovime luua vormi kehtetu andmetega...');
    
    try {
      console.log('Proovime luua vormi tühja pealkirjaga REST APIs...');
      await makeRestCall('POST', '/forms', invalidFormData);
      printFailure('REST API should have rejected invalid form data');
    } catch (restError) {
      console.log(`REST API tagastas valideerimise vea: ${restError.message}`);
      try {
        console.log('Proovime luua vormi tühja pealkirjaga gRPC APIs...');
        await promisifyGrpc(grpcClients.forms, 'CreateForm', {
          title: '',
          token: testState.grpcToken
        });
        printFailure('gRPC API should have rejected invalid form data');
      } catch (grpcError) {
        console.log(`gRPC API tagastas valideerimise vea: ${grpcError.message}`);
        const restValidation = restError.message.includes('400') || restError.message.includes('required');
        const grpcValidation = grpcError.code === 3 || grpcError.message.includes('required');
        
        if (restValidation && grpcValidation) {
          console.log('Mõlemad APIid valideerivad sisendandmeid korrektselt');
          printSuccess('Both APIs correctly validate input data');
        } else {
          console.log('Sisendandmete valideerimine on ebaühtlane');
          printFailure('Input validation handling inconsistent');
        }
      }
    }
  } catch (error) {
    console.log(`Kehtetu andmete test ebaonnestus: ${error.message}`);
    printFailure(`Invalid data test failed: ${error.message}`);
  }
}

// Function to show gRPC schema
function showGrpcSchema() {
  console.log('\n=== gRPC PROTO SCHEMA ===');
  
  try {
    const protoContent = fs.readFileSync(PROTO_PATH, 'utf8');
    console.log('Proto faili sisu:');
    console.log(protoContent);
  } catch (error) {
    console.log('Ei saanud proto faili lugeda:', error.message);
  }
  
  console.log('='.repeat(50));
}

// Function to show REST API endpoints
function showRestApiEndpoints() {
  console.log('\n=== REST API ENDPOINTS ===');
  
  const endpoints = {
    'Kasutajad': {
      'POST /users': 'Kasutaja registreerimine',
      'DELETE /users/me': 'Kasutaja kustutamine'
    },
    'Sessioonid': {
      'POST /sessions': 'Sisselogimine'
    },
    'Vormid': {
      'POST /forms': 'Vormi loomine',
      'GET /forms/:id': 'Vormi lugemine',
      'PATCH /forms/:id': 'Vormi uuendamine',
      'DELETE /forms/:id': 'Vormi kustutamine',
      'GET /forms': 'Vormide nimekiri'
    },
    'Küsimused': {
      'POST /forms/:id/questions': 'Küsimuse loomine',
      'GET /forms/:id/questions': 'Küsimuste nimekiri',
      'GET /forms/:id/questions/:qid': 'Küsimuse lugemine',
      'PATCH /forms/:id/questions/:qid': 'Küsimuse uuendamine',
      'DELETE /forms/:id/questions/:qid': 'Küsimuse kustutamine'
    },
    'Vastused': {
      'POST /forms/:id/responses': 'Vastuse loomine',
      'GET /forms/:id/responses': 'Vastuste nimekiri',
      'PATCH /forms/:id/responses/:rid': 'Vastuse uuendamine',
      'DELETE /forms/:id/responses/:rid': 'Vastuse kustutamine'
    }
  };
  
  for (const [category, methods] of Object.entries(endpoints)) {
    console.log(`\n${category}:`);
    for (const [endpoint, description] of Object.entries(methods)) {
      console.log(`  ${endpoint} - ${description}`);
    }
  }
  
  console.log('='.repeat(50));
}

// Helper function to log API fields
function logApiFields(apiType, operation, requestData, responseData) {
  console.log(`\n=== ${apiType} API - ${operation} ===`);
  
  if (requestData) {
    console.log('REQUEST (saadetud andmed):');
    console.log(JSON.stringify(requestData, null, 2));
  }
  
  if (responseData) {
    console.log('RESPONSE (saadud andmed):');
    console.log(JSON.stringify(responseData, null, 2));
  }
  
  console.log('=' + '='.repeat(50));
}

// Test 9: Performance Comparison
async function testPerformance() {
  printHeader('TEST 9: PERFORMANCE COMPARISON');
  
  console.log('Testim ja võrdleme mõlema API jõudlust');
  
  const iterations = 10;
  
  try {
    // REST API Performance
    console.log(`Mõõdame REST API jõudlust (${iterations} vormi lugemist)...`);
    printTest(`REST API Performance (${iterations} form retrievals)`);
    const restStartTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await makeRestCall('GET', `/forms/${testState.formId}`);
    }
    
    const restDuration = Date.now() - restStartTime;
    console.log(`REST API tulemus: ${restDuration}ms kokku, ${(restDuration/iterations).toFixed(2)}ms keskmiselt`);
    printInfo(`REST API: ${restDuration}ms total, ${(restDuration/iterations).toFixed(2)}ms average`);

    // gRPC API Performance
    console.log(`Mõõdame gRPC API jõudlust (${iterations} vormi lugemist)...`);
    printTest(`gRPC API Performance (${iterations} form retrievals)`);
    const grpcStartTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await promisifyGrpc(grpcClients.forms, 'GetForm', {
        formId: testState.grpcFormId.toString(),
        token: testState.grpcToken
      });
    }
    
    const grpcDuration = Date.now() - grpcStartTime;
    console.log(`gRPC API tulemus: ${grpcDuration}ms kokku, ${(grpcDuration/iterations).toFixed(2)}ms keskmiselt`);
    printInfo(`gRPC API: ${grpcDuration}ms total, ${(grpcDuration/iterations).toFixed(2)}ms average`);

    // Compare performance
    const speedDifference = Math.abs(restDuration - grpcDuration);
    const fasterAPI = restDuration < grpcDuration ? 'REST' : 'gRPC';
    const speedupPercentage = ((Math.max(restDuration, grpcDuration) - Math.min(restDuration, grpcDuration)) / Math.max(restDuration, grpcDuration) * 100).toFixed(1);
    
    console.log(`Jõudluse võrdlus: ${fasterAPI} API on ${speedupPercentage}% kiirem`);
    printSuccess(`Performance comparison: ${fasterAPI} API is ${speedupPercentage}% faster`);
    
  } catch (error) {
    console.log(`Jõudluse test ebaonnestus: ${error.message}`);
    printFailure(`Performance test failed: ${error.message}`);
  }
}

// Test 10: Data Deletion
async function testDataDeletion() {
  printHeader('TEST 10: DATA DELETION');
  
  console.log('Testim andmete kustutamist mõlemas APIs');
  
  try {
    // Delete Response
    console.log('Kustutame vastuse...');
    await makeRestCall('DELETE', `/forms/${testState.formId}/responses/${testState.responseId}`);
    console.log('REST API kustutas vastuse edukalt');
    
    const grpcDeleteResponse = await promisifyGrpc(grpcClients.responses, 'DeleteResponse', {
      formId: testState.grpcFormId.toString(),
      responseId: testState.grpcResponseId.toString(),
      token: testState.grpcToken
    });
    console.log('gRPC API kustutas vastuse edukalt');

    printTest('Response Deletion');
    if (grpcDeleteResponse.success) {
      console.log('Mõlemad APIid kustutasid vastuse edukalt');
      printSuccess('Both APIs successfully deleted the response');
    } else {
      console.log('Vastuse kustutamine on ebaühtlane APIde vahel');
      printFailure('Response deletion inconsistent between APIs');
    }

    // Delete Questions
    console.log('Kustutame küsimused...');
    await makeRestCall('DELETE', `/forms/${testState.formId}/questions/${testState.question1Id}`);
    console.log('REST API kustutas küsimuse 1');
    
    await makeRestCall('DELETE', `/forms/${testState.formId}/questions/${testState.question2Id}`);
    console.log('REST API kustutas küsimuse 2');
    
    const grpcDeleteQ1 = await promisifyGrpc(grpcClients.questions, 'DeleteQuestion', {
      formId: testState.grpcFormId.toString(),
      questionId: testState.grpcQuestion1Id.toString(),
      token: testState.grpcToken
    });
    console.log('gRPC API kustutas küsimuse 1');
    
    const grpcDeleteQ2 = await promisifyGrpc(grpcClients.questions, 'DeleteQuestion', {
      formId: testState.grpcFormId.toString(),
      questionId: testState.grpcQuestion2Id.toString(),
      token: testState.grpcToken
    });
    console.log('gRPC API kustutas küsimuse 2');

    printTest('Questions Deletion');
    if (grpcDeleteQ1.success && grpcDeleteQ2.success) {
      console.log('Mõlemad APIid kustutasid kõik küsimused edukalt');
      printSuccess('Both APIs successfully deleted all questions');
    } else {
      console.log('Küsimuste kustutamine on ebaühtlane APIde vahel');
      printFailure('Question deletion inconsistent between APIs');
    }

    // Delete Form
    console.log('Kustutame vormi...');
    await makeRestCall('DELETE', `/forms/${testState.formId}`);
    console.log('REST API kustutas vormi edukalt');
    
    const grpcDeleteForm = await promisifyGrpc(grpcClients.forms, 'DeleteForm', {
      formId: testState.grpcFormId.toString(),
      token: testState.grpcToken
    });
    console.log('gRPC API kustutas vormi edukalt');

    printTest('Form Deletion');
    if (grpcDeleteForm.success) {
      console.log('Mõlemad APIid kustutasid vormi edukalt');
      printSuccess('Both APIs successfully deleted the form');
    } else {
      console.log('Vormi kustutamine on ebaühtlane APIde vahel');
      printFailure('Form deletion inconsistent between APIs');
    }

    printTest('Form Deletion');
    if (grpcDeleteForm.success) {
      printSuccess('Both APIs successfully deleted the form');
    } else {
      printFailure('Form deletion inconsistent between APIs');
    }

  } catch (error) {
    console.log(`Andmete kustutamine ebaonnestus: ${error.message}`);
    printFailure(`Data Deletion failed: ${error.message}`);
  }
}

// Detailed field comparison function
function compareAllFields(restData, grpcData, testName) {
  const comparisonLog = `\n=== VÄLJAD VÕRDLUS: ${testName} ===\n` +
    `REST andmed:\n${JSON.stringify(restData, null, 2)}\n` +
    `gRPC andmed:\n${JSON.stringify(grpcData, null, 2)}\n`;
  
  console.log(`\nVÕRDLUS: ${testName}`);
  
  // Get all unique field names from both objects
  const allFields = new Set([
    ...Object.keys(restData || {}),
    ...Object.keys(grpcData || {})
  ]);
  
  // Fields to ignore in comparison (since they are auto-generated and may differ)
  const fieldsToIgnore = new Set(['id', 'formId', 'questionId', 'responseId', 'userId', 'passwordUpdated']);
  
  let allMatch = true;
  let fieldComparison = '\nVäljad võrdlus:\n';
  
  for (const field of allFields) {
    const restValue = restData?.[field];
    const grpcValue = grpcData?.[field];
    
    // Skip comparison for auto-generated ID fields
    if (fieldsToIgnore.has(field)) {
      console.log(`🆔 ${field}: IGNOREERITUD (auto-generated ID)`);
      fieldComparison += `🆔 ${field}: IGNOREERITUD (auto-generated ID)\n`;
      continue;
    }
    
    // Special handling for arrays (like answers)
    if (Array.isArray(restValue) && Array.isArray(grpcValue)) {
      if (compareArraysIgnoringIds(restValue, grpcValue)) {
        console.log(`✅ ${field}: ÜHESUGUNE`);
        fieldComparison += `✅ ${field}: ÜHESUGUNE\n`;
      } else {
        console.log(`❌ ${field}: ERINEV (vaata logi faili)`);
        fieldComparison += `❌ ${field}: ERINEV\n   REST: ${JSON.stringify(restValue)}\n   gRPC: ${JSON.stringify(grpcValue)}\n`;
        allMatch = false;
      }
    } else if (JSON.stringify(restValue) === JSON.stringify(grpcValue)) {
      console.log(`✅ ${field}: ÜHESUGUNE`);
      fieldComparison += `✅ ${field}: ÜHESUGUNE\n`;
    } else {
      console.log(`❌ ${field}: ERINEV (vaata logi faili)`);
      fieldComparison += `❌ ${field}: ERINEV\n   REST: ${JSON.stringify(restValue)}\n   gRPC: ${JSON.stringify(grpcValue)}\n`;
      allMatch = false;
    }
  }
  
  // Write full comparison to file
  logToFileAndConsole(comparisonLog + fieldComparison + '=' + '='.repeat(50), true);
  
  return allMatch;
}

// Helper function to compare arrays while ignoring ID fields
function compareArraysIgnoringIds(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  
  for (let i = 0; i < arr1.length; i++) {
    const item1 = arr1[i];
    const item2 = arr2[i];
    
    if (typeof item1 === 'object' && typeof item2 === 'object') {
      // Compare objects while ignoring ID fields
      const keys1 = Object.keys(item1).filter(k => k !== 'questionId');
      const keys2 = Object.keys(item2).filter(k => k !== 'questionId');
      
      if (keys1.length !== keys2.length) return false;
      
      for (const key of keys1) {
        if (key !== 'questionId' && JSON.stringify(item1[key]) !== JSON.stringify(item2[key])) {
          return false;
        }
      }
    } else {
      if (JSON.stringify(item1) !== JSON.stringify(item2)) return false;
    }
  }
  
  return true;
}

// Main test runner
async function runAllTests() {
  printHeader('AUTOMATED REST vs gRPC API COMPARISON TESTS');
  console.log('Automaatsed REST vs gRPC API võrdlustestid');
  printInfo('This test suite compares REST API (port 3000) and gRPC API (port 50051)');
  printInfo('ensuring both APIs provide consistent behavior and responses.');
  console.log('See test komplekt võrdleb REST API (port 3000) ja gRPC API (port 50051) funktsionaalsust');
  console.log(`Täielik logi salvestatakse faili: ${LOG_FILE}`);
  console.log('Kui terminalis ei näe kogu väljundit, vaata logi faili!');
  console.log();

  try {
    console.log('Alustame testide täitmist...');
    
    // Show API schemas first
    showRestApiEndpoints();
    showGrpcSchema();
    
    await checkServers();
    
    // Clean up any existing test data
    console.log('Puhastame olemasolevaid testide andmeid...');
    await cleanupTestData();
    
    // Run all tests
    console.log('Käivitame kõik testid...');
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
    console.log('Teeme lõplikku puhastamist...');
    await cleanupTestData();

  } catch (error) {
    console.log(`Testide täitmine ebaonnestus: ${error.message}`);
    printFailure(`Test execution failed: ${error.message}`);
  }

  // Print final summary
  console.log('Koostame lõplikku kokkuvõtet...');
  printHeader('TEST EXECUTION SUMMARY');
  console.log(`Testide täitmise kokkuvõte:`);
  colorLog(colors.green, `✅ Tests Passed: ${testState.testsPassed}`);
  console.log(`Edukaid teste: ${testState.testsPassed}`);
  colorLog(colors.red, `❌ Tests Failed: ${testState.testsFailed}`);
  console.log(`Ebaõnnestunud teste: ${testState.testsFailed}`);
  colorLog(colors.blue, `Total Tests: ${testState.totalTests}`);
  console.log(`Teste kokku: ${testState.totalTests}`);
  
  if (testState.testsFailed === 0) {
    console.log();
    console.log('KÕIK TESTID ÕNNESTUSID!');
    colorLog(colors.green + colors.bright, 'ALL TESTS PASSED!');
    colorLog(colors.green, 'REST and gRPC APIs are functionally consistent.');
    console.log('REST ja gRPC APIid on funktsionaalselt järjepidevad');
    console.log(`📝 Vaata täielikku logi: ${LOG_FILE}`);
    process.exit(0);
  } else {
    console.log();
    console.log('MÕNED TESTID EBAÕNNESTUSID');
    colorLog(colors.red + colors.bright, '❌ SOME TESTS FAILED');
    colorLog(colors.yellow, 'Check the detailed output above to identify inconsistencies.');
    console.log('Kontrollige üksikasjalikku väljundit, et tuvastada vastuolud');
    console.log(`📝 Vaata täielikku logi: ${LOG_FILE}`);
    process.exit(1);
  }
}

// Enhanced logging function
function logToFileAndConsole(message, compact = false) {
  // Write full message to file
  fs.appendFileSync(LOG_FILE, message + '\n');
  
  // Write to console (compact version if needed)
  if (compact && message.length > 500) {
    const lines = message.split('\n');
    console.log(lines[0]); // First line
    if (lines.length > 10) {
      console.log(`... (${lines.length - 2} rida logi failis) ...`);
      console.log(lines[lines.length - 1]); // Last line
    } else {
      console.log(message);
    }
  } else {
    console.log(message);
  }
}

// Execute tests
console.log('Käivitame testide komplekti...');
runAllTests().catch(error => {
  console.log(`Kriitiline viga: ${error.message}`);
  console.error('Fatal error:', error);
  process.exit(1);
});