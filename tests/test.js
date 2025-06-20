import 'dotenv/config';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const REST_BASE_URL = 'http://localhost:3000';
const GRPC_HOST = 'localhost';
const GRPC_PORT = '50051';
const PROTO_PATH = join(__dirname, '../proto/forms.proto');
const LOG_FILE = join(__dirname, 'test-results.log');

// Clear log file at start
fs.writeFileSync(LOG_FILE, `=== REST vs gRPC COMPLIANCE TEST STARTED AT ${new Date().toLocaleString('et-EE', { timeZone: 'Europe/Tallinn' })} ===\n`);
fs.appendFileSync(LOG_FILE, `REST API is the reference - gRPC must match REST behavior\n\n`);

// Test data
const TEST_EMAIL = 'testuser@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';

// Test tokens storage for authentication
let restToken = null;
let restUserId = null;
let grpcToken = null;
let testFormId = null;
let grpcFormId = null;
let testQuestionId = null;
let grpcQuestionId = null;
let testResponseId = null;
let grpcResponseId = null;

// Load gRPC proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const formsProto = grpc.loadPackageDefinition(packageDefinition).forms;

// gRPC clients
const grpcClients = {
  forms: new formsProto.FormsService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  questions: new formsProto.QuestionsService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  responses: new formsProto.ResponsesService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  users: new formsProto.UsersService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  sessions: new formsProto.SessionsService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure())
};

// REST API helper - returns response without immediate logging
async function makeRestCall(method, endpoint, data = null, useAuth = true, token = null) {
  const url = `${REST_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    
    let result;
    if (response.status === 204) {
      result = { success: true };
    } else if (response.status === 200) {
      // Check if response has content
      const text = await response.text();
      if (text) {
        try {
          result = JSON.parse(text);
        } catch (e) {
          // If JSON parsing fails, treat as plain text success
          result = { success: true, message: text };
        }
      } else {
        // Empty 200 response (like logout)
        result = { success: true };
      }
    } else {
      result = await response.json();
      if (!response.ok) {
        throw new Error(`REST ${response.status}: ${result.message || result.error || 'Unknown error'}`);
      }
    }
    
    return { success: true, data: result, request: data };
  } catch (error) {
    return { success: false, error: error.message, request: data };
  }
}

// Promisify gRPC calls - returns response without immediate logging
function promisifyGrpc(client, method, request) {
  return new Promise((resolve, reject) => {
    client[method](request, (error, response) => {
      if (error) {
        resolve({ 
          success: false, 
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }, 
          request: request 
        });
      } else {
        resolve({ success: true, data: response, request: request });
      }
    });
  });
}

// Enhanced logging function - REST is the reference, gRPC must match
function logComparisonTest(testName, restRequest, restResponse, grpcRequest, grpcResponse, restError = null, grpcError = null) {
  const separator = '='.repeat(50);
  let logMessage = `\n${separator}\n`;
  logMessage += `🔄 REST vs gRPC COMPARISON: ${testName}\n`;
  logMessage += `${separator}\n\n`;
  
  // REST API section (Reference)
  logMessage += `--- REST API (REFERENCE) ---\n`;
  logMessage += `REQUEST: ${JSON.stringify(restRequest, null, 2)}\n`;
  if (restError) {
    logMessage += `ERROR: ${restError}\n`;
  } else {
    logMessage += `RESPONSE: ${JSON.stringify(restResponse, null, 2)}\n`;
  }
  logMessage += `--- REST API lõpp ---\n\n`;
  
  // gRPC API section (Must Match)
  logMessage += `--- gRPC API (MUST MATCH REST RESPONSE) ---\n`;
  logMessage += `REQUEST: ${JSON.stringify(grpcRequest, null, 2)} (can differ from REST)\n`;
  if (grpcError) {
    logMessage += `ERROR: ${JSON.stringify({
      code: grpcError.code,
      message: grpcError.message,
      details: grpcError.details
    }, null, 2)}\n`;
  } else {
    logMessage += `RESPONSE: ${JSON.stringify(grpcResponse, null, 2)} (must match REST structure)\n`;
  }
  logMessage += `--- gRPC API lõpp ---\n\n`;
  
  fs.appendFileSync(LOG_FILE, logMessage);
  
  // Console output (shortened)
  console.log(`\n🔄 ${testName}`);
  console.log('REST:', restError ? '❌ ERROR' : '✅ SUCCESS');
  console.log('gRPC:', grpcError ? '❌ ERROR' : '✅ SUCCESS');
}

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// REST-focused comparison function - gRPC must match REST API results
async function compareRestAndGrpc(testName, restCall, grpcCall, expectErrors = false) {
  console.log(`\n🔄 ${testName}`);
  
  // Execute REST call first (this is the reference)
  const restResult = await restCall();
  
  // Execute gRPC call
  const grpcResult = await grpcCall();
  
  // Log structured comparison
  logComparisonTest(
    testName,
    restResult.request,
    restResult.success ? restResult.data : null,
    grpcResult.request, 
    grpcResult.success ? grpcResult.data : null,
    restResult.success ? null : restResult.error,
    grpcResult.success ? null : grpcResult.error
  );
  
  console.log('REST (Reference):', restResult.success ? '✅ SUCCESS' : '❌ ERROR');
  console.log('gRPC (Must Match):', grpcResult.success ? '✅ SUCCESS' : '❌ ERROR');
  
  // Determine test result - gRPC must match REST behavior
  let testPassed;
  if (expectErrors) {
    // For error handling tests, if REST fails, gRPC should also fail
    if (!restResult.success) {
      testPassed = !grpcResult.success;
      console.log('🎯 Error test: REST failed, checking if gRPC also fails...');
    } else {
      // If REST succeeds in error test, this is unexpected
      testPassed = false;
      console.log('🎯 Error test: REST unexpectedly succeeded');
    }
  } else {
    // For normal tests, gRPC must succeed if REST succeeds
    if (restResult.success) {
      testPassed = grpcResult.success;
      console.log('🎯 Normal test: REST succeeded, checking if gRPC also succeeds...');
    } else {
      // If REST fails in normal test, this is a problem
      testPassed = false;
      console.log('🎯 Normal test: REST failed (this should not happen)');
    }
  }
  
  // Additional validation: Compare response structures if both succeeded
  if (restResult.success && grpcResult.success && !expectErrors) {
    const responsesMatch = compareResponseStructures(restResult.data, grpcResult.data);
    if (!responsesMatch) {
      testPassed = false;
      console.log('⚠️ gRPC response structure does not match REST response structure');
    } else {
      console.log('✅ gRPC response structure matches REST response structure');
    }
  }
  
  // Track test result
  testResults.total++;
  if (testPassed) {
    testResults.passed++;
    console.log(`🎯 ${testName}: ✅ PASSED - gRPC matches REST behavior`);
  } else {
    testResults.failed++;
    console.log(`🎯 ${testName}: ❌ FAILED - gRPC does not match REST behavior`);
  }
  
  testResults.tests.push({
    name: testName,
    passed: testPassed,
    restSuccess: restResult.success,
    grpcSuccess: grpcResult.success,
    restError: restResult.error,
    grpcError: grpcResult.error
  });
  
  return { restResult, grpcResult };
}

// Function to compare response structures between REST and gRPC
function compareResponseStructures(restData, grpcData) {
  // If both are null/undefined, they match
  if (!restData && !grpcData) return true;
  if (!restData || !grpcData) return false;
  
  // Special case: REST returns array directly, gRPC returns object with array
  // Common patterns: REST: [items], gRPC: {items: [items]} or {users: [users]}
  if (Array.isArray(restData) && typeof grpcData === 'object' && !Array.isArray(grpcData)) {
    // Look for array properties in gRPC response
    const grpcArrayKeys = Object.keys(grpcData).filter(key => Array.isArray(grpcData[key]));
    
    if (grpcArrayKeys.length === 1) {
      // Found exactly one array property, compare with REST array
      const grpcArray = grpcData[grpcArrayKeys[0]];
      if (restData.length !== grpcArray.length) return false;
      
      // Compare first element structure if arrays are not empty
      if (restData.length > 0 && grpcArray.length > 0) {
        return compareObjectStructure(restData[0], grpcArray[0], true); // true = lenient mode
      }
      return true;
    }
  }
  
  // For arrays, compare lengths and key structures
  if (Array.isArray(restData) && Array.isArray(grpcData)) {
    if (restData.length !== grpcData.length) return false;
    
    // Compare first element structure if arrays are not empty
    if (restData.length > 0 && grpcData.length > 0) {
      return compareObjectStructure(restData[0], grpcData[0], true); // true = lenient mode
    }
    return true;
  }
  
  // For objects, compare key structures
  if (typeof restData === 'object' && typeof grpcData === 'object') {
    // Use lenient mode for single objects too - gRPC can have extra fields
    return compareObjectStructure(restData, grpcData, true); // true = lenient mode
  }
  
  // For primitive values, they should be the same type
  return typeof restData === typeof grpcData;
}

// Helper function to compare object structures (keys and types)
function compareObjectStructure(obj1, obj2, lenient = false) {
  const keys1 = Object.keys(obj1 || {});
  const keys2 = Object.keys(obj2 || {});
  
  if (lenient) {
    // In lenient mode, check if all REST keys exist in gRPC (gRPC can have extra fields)
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      
      // Type checking with number/string tolerance and null/empty string tolerance
      const type1 = typeof obj1[key];
      const type2 = typeof obj2[key];
      
      if (type1 !== type2) {
        const isNumericField = key.toLowerCase().includes('id') || 
                             key === 'count' || 
                             key === 'total' || 
                             key === 'length' ||
                             /^\d+$/.test(String(obj1[key])) || 
                             /^\d+$/.test(String(obj2[key]));
        
        const isNumberStringMismatch = (type1 === 'number' && type2 === 'string') || 
                                     (type1 === 'string' && type2 === 'number');
        
        // Allow null vs empty string mismatch (common between REST and gRPC)
        const isNullEmptyStringMismatch = 
          (obj1[key] === null && obj2[key] === '') || 
          (obj1[key] === '' && obj2[key] === null);
        
        if (!(isNumericField && isNumberStringMismatch) && !isNullEmptyStringMismatch) {
          return false;
        }
      }
    }
    return true;
  } else {
    // Strict mode: exact key count and type matching
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      
      const type1 = typeof obj1[key];
      const type2 = typeof obj2[key];
      
      if (type1 !== type2) {
        const isNumericField = key.toLowerCase().includes('id') || 
                             key === 'count' || 
                             key === 'total' || 
                             key === 'length' ||
                             /^\d+$/.test(String(obj1[key])) || 
                             /^\d+$/.test(String(obj2[key]));
        
        const isNumberStringMismatch = (type1 === 'number' && type2 === 'string') || 
                                     (type1 === 'string' && type2 === 'number');
        
        // Allow null vs empty string mismatch (common between REST and gRPC)
        const isNullEmptyStringMismatch = 
          (obj1[key] === null && obj2[key] === '') || 
          (obj1[key] === '' && obj2[key] === null);
        
        if (!(isNumericField && isNumberStringMismatch) && !isNullEmptyStringMismatch) {
          return false;
        }
      }
    }
    return true;
  }
}

// Database cleanup function
async function cleanupDatabases() {
  console.log('🧹 Cleaning up databases before tests...');
  
  try {
    // Clean gRPC database
    const grpcDbPath = join(__dirname, '../forms.db');
    const grpcDb = await open({
      filename: grpcDbPath,
      driver: sqlite3.Database
    });
    
    // Delete all data from gRPC database tables in correct order (foreign key constraints)
    // Using try-catch for each table in case it doesn't exist
    try { await grpcDb.exec('DELETE FROM sessions'); } catch (e) { /* table may not exist */ }
    try { await grpcDb.exec('DELETE FROM answer_values'); } catch (e) { /* table may not exist */ }
    try { await grpcDb.exec('DELETE FROM responses'); } catch (e) { /* table may not exist */ }
    try { await grpcDb.exec('DELETE FROM questions'); } catch (e) { /* table may not exist */ }
    try { await grpcDb.exec('DELETE FROM forms'); } catch (e) { /* table may not exist */ }
    try { await grpcDb.exec('DELETE FROM users'); } catch (e) { /* table may not exist */ }
    
    // Reset auto-increment counters (only if the table exists)
    try { await grpcDb.exec('DELETE FROM sqlite_sequence'); } catch (e) { /* table may not exist */ }
    
    await grpcDb.close();
    console.log('✅ gRPC database cleaned');
    
    // Clean REST API database
    const restDbPath = join(__dirname, '../REST-api/forms.db');
    const restDb = await open({
      filename: restDbPath,
      driver: sqlite3.Database
    });
    
    // Delete all data from REST database tables in correct order
    try { await restDb.exec('DELETE FROM sessions'); } catch (e) { /* table may not exist */ }
    try { await restDb.exec('DELETE FROM answer_values'); } catch (e) { /* table may not exist */ }
    try { await restDb.exec('DELETE FROM responses'); } catch (e) { /* table may not exist */ }
    try { await restDb.exec('DELETE FROM questions'); } catch (e) { /* table may not exist */ }
    try { await restDb.exec('DELETE FROM forms'); } catch (e) { /* table may not exist */ }
    try { await restDb.exec('DELETE FROM users'); } catch (e) { /* table may not exist */ }
    
    // Reset auto-increment counters (only if the table exists)
    try { await restDb.exec('DELETE FROM sqlite_sequence'); } catch (e) { /* table may not exist */ }
    
    await restDb.close();
    console.log('✅ REST API database cleaned');
    
    console.log('🎯 Database cleanup completed successfully\n');
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error.message);
    throw error;
  }
}

// Test User Registration
async function testUserRegistration() {
  console.log('\n==================================================');
  console.log('🧪 TEST 1: USER REGISTRATION');
  console.log('==================================================');
  
  const userData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: TEST_NAME
  };

  // Use new structured comparison
  const { restResult, grpcResult } = await compareRestAndGrpc(
    'User Registration',
    async () => makeRestCall('POST', '/users', userData, false),
    async () => promisifyGrpc(grpcClients.users, 'CreateUser', userData)
  );

  // Compare fields if both succeeded - gRPC must match REST
  if (restResult.success && grpcResult.success) {
    const fieldsToCompare = ['email', 'name'];
    
    // Log comparison results to file
    let comparisonLog = '\n=== VÄLJAD VÕRDLUS: User Registration (gRPC vs REST) ===\n';
    comparisonLog += `REST andmed (REFERENCE):\n${JSON.stringify(restResult.data, null, 2)}\n`;
    comparisonLog += `gRPC andmed (MUST MATCH):\n${JSON.stringify(grpcResult.data, null, 2)}\n\n`;
    comparisonLog += 'Väljad võrdlus (gRPC vs REST):\n';
    
    let allMatch = true;
    fieldsToCompare.forEach(field => {
      const restValue = restResult.data[field];
      const grpcValue = grpcResult.data[field];
      const match = restValue === grpcValue;
      comparisonLog += `${match ? '✅' : '❌'} ${field}: ${match ? 'ÜHESUGUNE' : `ERINEV (REST: "${restValue}", gRPC: "${grpcValue}")`}\n`;
      if (!match) allMatch = false;
    });
    comparisonLog += '===================================================\n';
    
    fs.appendFileSync(LOG_FILE, comparisonLog);
    
    if (!allMatch) {
      console.log('\n🎯 Field Comparison: ❌ gRPC fields do not match REST reference');
      // Mark this test as failed
      testResults.tests[testResults.tests.length - 1].passed = false;
      testResults.passed--;
      testResults.failed++;
    } else {
      console.log('\n🎯 Field Comparison: ✅ gRPC fields match REST reference');
    }
  }
}

// Test User Login  
async function testUserLogin() {
  console.log('\n==================================================');
  console.log('🧪 TEST 2: USER LOGIN');
  console.log('==================================================');
  
  const loginData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  };

  // Use new structured comparison
  const { restResult, grpcResult } = await compareRestAndGrpc(
    'User Login',
    async () => makeRestCall('POST', '/sessions', loginData, false),
    async () => promisifyGrpc(grpcClients.sessions, 'CreateSession', loginData)
  );

  // Store tokens for authenticated tests
  if (restResult.success && restResult.data.token) {
    restToken = restResult.data.token;
    restUserId = restResult.data.userId; // Store user ID for REST API calls
    console.log('💾 Stored REST token for future tests');
  }
  if (grpcResult.success && grpcResult.data.token) {
    grpcToken = grpcResult.data.token;
    console.log('💾 Stored gRPC token for future tests');
  }
}

// Test 3: Form Creation
async function testFormCreation() {
  console.log('\n==================================================');
  console.log('🧪 TEST 3: FORM CREATION');
  console.log('==================================================');
  
  const formData = {
    title: 'Test Form',
    description: 'This is a test form for comparison'
  };

  // Use tokens from login test
  const { restResult, grpcResult } = await compareRestAndGrpc(
    'Form Creation',
    async () => makeRestCall('POST', '/forms', formData, true, restToken),
    async () => promisifyGrpc(grpcClients.forms, 'CreateForm', { ...formData, token: grpcToken })
  );

  // Store form IDs for later tests
  if (restResult.success) {
    testFormId = restResult.data.id;
  }
  if (grpcResult.success) {
    grpcFormId = grpcResult.data.id;
  }

  // Compare fields if both succeeded - gRPC must match REST
  if (restResult.success && grpcResult.success) {
    const fieldsToCompare = ['title', 'description'];
    
    let comparisonLog = '\n=== VÄLJAD VÕRDLUS: Form Creation (gRPC vs REST) ===\n';
    comparisonLog += `REST andmed (REFERENCE):\n${JSON.stringify(restResult.data, null, 2)}\n`;
    comparisonLog += `gRPC andmed (MUST MATCH):\n${JSON.stringify(grpcResult.data, null, 2)}\n\n`;
    comparisonLog += 'Väljad võrdlus (gRPC vs REST):\n';
    
    let allMatch = true;
    fieldsToCompare.forEach(field => {
      const restValue = restResult.data[field];
      const grpcValue = grpcResult.data[field];
      const match = restValue === grpcValue;
      comparisonLog += `${match ? '✅' : '❌'} ${field}: ${match ? 'ÜHESUGUNE' : `ERINEV (REST: "${restValue}", gRPC: "${grpcValue}")`}\n`;
      if (!match) allMatch = false;
    });
    comparisonLog += '===================================================\n';
    
    fs.appendFileSync(LOG_FILE, comparisonLog);
    
    if (!allMatch) {
      console.log('\n🎯 Field Comparison: ❌ gRPC fields do not match REST reference');
      // Mark this test as failed
      testResults.tests[testResults.tests.length - 1].passed = false;
      testResults.passed--;
      testResults.failed++;
    } else {
      console.log('\n🎯 Field Comparison: ✅ gRPC fields match REST reference');
    }
  }
}

// Test 3.5: User Management
async function testUserManagement() {
  console.log('\n==================================================');
  console.log('🧪 TEST 3.5: USER MANAGEMENT');
  console.log('==================================================');
  
  // List all users
  await compareRestAndGrpc(
    'List All Users',
    async () => makeRestCall('GET', '/users', null, true, restToken),
    async () => promisifyGrpc(grpcClients.users, 'ListUsers', { token: grpcToken })
  );

  // Get current user details
  await compareRestAndGrpc(
    'Get Current User Details',
    async () => makeRestCall('GET', `/users/${restUserId}`, null, true, restToken),
    async () => promisifyGrpc(grpcClients.sessions, 'ValidateSession', { token: grpcToken })
  );

  // Update user
  const userUpdateData = {
    name: 'Updated Test User',
    email: TEST_EMAIL // Keep same email
  };

  await compareRestAndGrpc(
    'Update User',
    async () => makeRestCall('PATCH', `/users/${restUserId}`, userUpdateData, true, restToken),
    async () => promisifyGrpc(grpcClients.users, 'UpdateUser', { 
      ...userUpdateData, 
      token: grpcToken 
    })
  );
}

// Test 4: Question Creation
async function testQuestionCreation() {
  console.log('\n==================================================');
  console.log('🧪 TEST 4: QUESTION CREATION');
  console.log('==================================================');
  
  // Check if we have valid form IDs from form creation test
  if (!testFormId || !grpcFormId) {
    console.log('⚠️ No form IDs available from form creation test');
    console.log(`   REST form ID: ${testFormId}`);
    console.log(`   gRPC form ID: ${grpcFormId}`);
    
    // Try to use fallback IDs (assuming forms with ID 1 exist)
    const fallbackFormId = 1;
    console.log(`   Using fallback form ID: ${fallbackFormId}`);
    
    if (!testFormId) testFormId = fallbackFormId;
    if (!grpcFormId) grpcFormId = fallbackFormId;
  }
  
  // Test 1: Text question
  const textQuestionData = {
    questionText: 'What is your favorite color?',
    questionType: 'text',
    isRequired: true
  };

  // REST API uses different field names than gRPC
  const restTextQuestionData = {
    text: 'What is your favorite color?',
    type: 'shorttext', // REST API uses 'shorttext' not 'text'
    required: true
  };

  // gRPC API field names (based on proto definition)
  const grpcTextQuestionData = {
    formId: grpcFormId.toString(),
    text: 'What is your favorite color?',
    type: 'text',
    required: true,
    token: grpcToken
  };

  const { restResult: restText, grpcResult: grpcText } = await compareRestAndGrpc(
    'Question Creation (Text)',
    async () => makeRestCall('POST', `/forms/${testFormId}/questions`, restTextQuestionData, true, restToken),
    async () => promisifyGrpc(grpcClients.questions, 'CreateQuestion', grpcTextQuestionData)
  );

  // Store first question IDs
  if (restText.success) {
    testQuestionId = restText.data.id;
  }
  if (grpcText.success) {
    grpcQuestionId = grpcText.data.id;
  }

  // Test 2: Multiple choice question
  const choiceQuestionData = {
    questionText: 'Which colors do you like?',
    questionType: 'checkbox',
    isRequired: false,
    options: ['Red', 'Blue', 'Green', 'Yellow']
  };

  // REST API uses different field names
  const restChoiceQuestionData = {
    text: 'Which colors do you like?',
    type: 'checkbox',
    required: false,
    options: ['Red', 'Blue', 'Green', 'Yellow']
  };

  // gRPC API field names (based on proto definition)
  const grpcChoiceQuestionData = {
    formId: grpcFormId.toString(),
    text: 'Which colors do you like?',
    type: 'checkbox',
    required: false,
    options: ['Red', 'Blue', 'Green', 'Yellow'],
    token: grpcToken
  };

  await compareRestAndGrpc(
    'Question Creation (Checkbox)',
    async () => makeRestCall('POST', `/forms/${testFormId}/questions`, restChoiceQuestionData, true, restToken),
    async () => promisifyGrpc(grpcClients.questions, 'CreateQuestion', grpcChoiceQuestionData)
  );

  // Compare fields if both text questions succeeded - gRPC must match REST
  if (restText.success && grpcText.success) {
    // Note: REST and gRPC both use 'text', 'type', 'required' in their responses
    const fieldMappings = [
      { rest: 'text', grpc: 'text' },
      { rest: 'type', grpc: 'type' },
      { rest: 'required', grpc: 'required' }
    ];
    
    let comparisonLog = '\n=== VÄLJAD VÕRDLUS: Question Creation (Text) (gRPC vs REST) ===\n';
    comparisonLog += `REST andmed (REFERENCE):\n${JSON.stringify(restText.data, null, 2)}\n`;
    comparisonLog += `gRPC andmed (MUST MATCH):\n${JSON.stringify(grpcText.data, null, 2)}\n\n`;
    comparisonLog += 'Väljad võrdlus (both APIs use same field names in response):\n';
    
    let allMatch = true;
    fieldMappings.forEach(mapping => {
      const restValue = restText.data[mapping.rest];
      const grpcValue = grpcText.data[mapping.grpc];
      
      // Special handling for type field (REST: 'shorttext', gRPC: 'text')
      let match;
      if (mapping.rest === 'type') {
        match = (restValue === 'shorttext' && grpcValue === 'text') || restValue === grpcValue;
      } else {
        match = restValue === grpcValue;
      }
      
      comparisonLog += `${match ? '✅' : '❌'} ${mapping.rest}: ${match ? 'ÜHESUGUNE' : `ERINEV (REST: "${restValue}", gRPC: "${grpcValue}")`}\n`;
      if (!match) allMatch = false;
    });
    comparisonLog += '===================================================\n';
    
    fs.appendFileSync(LOG_FILE, comparisonLog);
    
    if (!allMatch) {
      console.log('\n🎯 Field Comparison: ❌ gRPC fields do not match REST reference');
      // Find the text question test result and mark it as failed
      const textQuestionTest = testResults.tests.find(t => t.name === 'Question Creation (Text)');
      if (textQuestionTest && textQuestionTest.passed) {
        textQuestionTest.passed = false;
        testResults.passed--;
        testResults.failed++;
      }
    } else {
      console.log('\n🎯 Field Comparison: ✅ gRPC fields match REST reference');
    }
  }
}

// Test 5: Response Creation
async function testResponseCreation() {
  console.log('\n==================================================');
  console.log('🧪 TEST 5: RESPONSE CREATION');
  console.log('==================================================');
  
  if (!testFormId || !grpcFormId) {
    console.log('⚠️ Skipping response test - no form IDs available');
    return;
  }
  
  const responseData = {
    answers: [
      {
        questionId: testQuestionId,
        answer: 'Blue'  // Both REST and gRPC use 'answer', not 'answerText'
      }
    ]
  };

  const grpcResponseData = {
    formId: grpcFormId.toString(),
    answers: [
      {
        questionId: grpcQuestionId ? grpcQuestionId.toString() : '1',
        answer: 'Blue'  // gRPC also uses 'answer'
      }
    ],
    token: grpcToken
  };

  const { restResult, grpcResult } = await compareRestAndGrpc(
    'Response Creation',
    async () => makeRestCall('POST', `/forms/${testFormId}/responses`, responseData, true, restToken),
    async () => promisifyGrpc(grpcClients.responses, 'CreateResponse', grpcResponseData)
  );

  // Store response IDs for later tests
  if (restResult.success) {
    testResponseId = restResult.data.id;
  }
  if (grpcResult.success) {
    grpcResponseId = grpcResult.data.id;
  }
}

// Test 6: Data Retrieval
async function testDataRetrieval() {
  console.log('\n==================================================');
  console.log('🧪 TEST 6: DATA RETRIEVAL');
  console.log('==================================================');
  
  // Test getting forms list
  await compareRestAndGrpc(
    'Get Forms List',
    async () => makeRestCall('GET', '/forms', null, true, restToken),
    async () => promisifyGrpc(grpcClients.forms, 'ListForms', { token: grpcToken })
  );

  // Test getting specific form
  if (testFormId && grpcFormId) {
    await compareRestAndGrpc(
      'Get Specific Form',
      async () => makeRestCall('GET', `/forms/${testFormId}`, null, true, restToken),
      async () => promisifyGrpc(grpcClients.forms, 'GetForm', { formId: grpcFormId.toString(), token: grpcToken })
    );
  }

  // Test getting questions list
  if (testFormId && grpcFormId) {
    await compareRestAndGrpc(
      'Get Questions List',
      async () => makeRestCall('GET', `/forms/${testFormId}/questions`, null, true, restToken),
      async () => promisifyGrpc(grpcClients.questions, 'ListQuestions', { formId: grpcFormId.toString(), token: grpcToken })
    );
  }

  // Test getting specific question (using first question ID from creation)
  await compareRestAndGrpc(
    'Get Specific Question Details',
    async () => makeRestCall('GET', `/forms/${testFormId || 1}/questions/1`, null, true, restToken),
    async () => promisifyGrpc(grpcClients.questions, 'GetQuestion', { 
      formId: (grpcFormId || 1).toString(), 
      questionId: '1', 
      token: grpcToken 
    })
  );

  // Test getting responses list
  if (testFormId && grpcFormId) {
    await compareRestAndGrpc(
      'Get Responses List',
      async () => makeRestCall('GET', `/forms/${testFormId}/responses`, null, true, restToken),
      async () => promisifyGrpc(grpcClients.responses, 'ListResponses', { formId: grpcFormId.toString(), token: grpcToken })
    );
  }

  // Test getting specific response details (using first response ID)
  await compareRestAndGrpc(
    'Get Specific Response Details',
    async () => makeRestCall('GET', `/forms/${testFormId || 1}/responses/1`, null, true, restToken),
    async () => promisifyGrpc(grpcClients.responses, 'GetResponse', { 
      formId: (grpcFormId || 1).toString(), 
      responseId: '1', 
      token: grpcToken 
    })
  );
}

// Test 7: Data Updates  
async function testDataUpdates() {
  console.log('\n==================================================');
  console.log('🧪 TEST 7: DATA UPDATES');
  console.log('==================================================');
  
  if (!testFormId || !grpcFormId) {
    console.log('⚠️ Skipping update tests - no form IDs available');
    return;
  }
  
  // Test form update
  const updateData = {
    title: 'Updated Test Form',
    description: 'This form has been updated'
  };

  await compareRestAndGrpc(
    'Form Update',
    async () => makeRestCall('PATCH', `/forms/${testFormId}`, updateData, true, restToken),
    async () => promisifyGrpc(grpcClients.forms, 'UpdateForm', { 
      formId: grpcFormId.toString(), 
      ...updateData, 
      token: grpcToken 
    })
  );

  // Test updating specific question (using fallback ID)
  await compareRestAndGrpc(
    'Update Specific Question',
    async () => makeRestCall('PATCH', `/forms/${testFormId || 1}/questions/${testQuestionId || 1}`, {
      questionText: 'Updated: What is your favorite color?',
      questionType: 'text',
      isRequired: false
    }, true, restToken),
    async () => promisifyGrpc(grpcClients.questions, 'UpdateQuestion', { 
      formId: (grpcFormId || 1).toString(),
      questionId: (grpcQuestionId || 1).toString(),
      questionText: 'Updated: What is your favorite color?',
      questionType: 'text',
      isRequired: false,
      token: grpcToken 
    })
  );

  // Test updating specific response (using fallback ID)
  await compareRestAndGrpc(
    'Update Specific Response',
    async () => makeRestCall('PATCH', `/forms/${testFormId || 1}/responses/${testResponseId || 1}`, {
      answers: [
        {
          questionId: testQuestionId || 1,
          answer: 'Updated: Purple'  // Use 'answer' not 'answerText'
        }
      ]
    }, true, restToken),
    async () => promisifyGrpc(grpcClients.responses, 'UpdateResponse', {
      formId: (grpcFormId || 1).toString(),
      responseId: (grpcResponseId || 1).toString(),
      answers: [
        {
          questionId: (grpcQuestionId || 1).toString(),
          answer: 'Updated: Purple'  // Use 'answer' not 'answerText'
        }
      ],
      token: grpcToken
    })
  );
}

// Test 8: Error Handling
async function testErrorHandling() {
  console.log('\n==================================================');
  console.log('🧪 TEST 8: ERROR HANDLING');
  console.log('==================================================');
  
  // Test accessing non-existent form (should return errors - expected behavior)
  await compareRestAndGrpc(
    'Get Non-existent Form (Expected Error)',
    async () => makeRestCall('GET', '/forms/99999', null, true, restToken),
    async () => promisifyGrpc(grpcClients.forms, 'GetForm', { formId: '99999', token: grpcToken }),
    true // expectErrors = true
  );
  
  // Test unauthorized access (should return errors - expected behavior)
  await compareRestAndGrpc(
    'Unauthorized Access (Expected Error)',
    async () => makeRestCall('GET', '/forms', null, false),
    async () => promisifyGrpc(grpcClients.forms, 'ListForms', { token: 'invalid-token' }),
    true // expectErrors = true
  );

  // Test invalid form data (should return errors - expected behavior)
  await compareRestAndGrpc(
    'Invalid Form Data (Expected Error)',
    async () => makeRestCall('POST', '/forms', { title: '' }, true, restToken),
    async () => promisifyGrpc(grpcClients.forms, 'CreateForm', { title: '', token: grpcToken }),
    true // expectErrors = true
  );

  // Test accessing non-existent question (should return errors - expected behavior)
  if (testFormId && grpcFormId) {
    await compareRestAndGrpc(
      'Get Non-existent Question (Expected Error)',
      async () => makeRestCall('GET', `/forms/${testFormId}/questions/99999`, null, true, restToken),
      async () => promisifyGrpc(grpcClients.questions, 'GetQuestion', { 
        formId: grpcFormId.toString(), 
        questionId: '99999', 
        token: grpcToken 
      }),
      true // expectErrors = true
    );
  }

  // Test accessing non-existent response (should return errors - expected behavior)
  if (testFormId && grpcFormId) {
    await compareRestAndGrpc(
      'Get Non-existent Response (Expected Error)',
      async () => makeRestCall('GET', `/forms/${testFormId}/responses/99999`, null, true, restToken),
      async () => promisifyGrpc(grpcClients.responses, 'GetResponse', { 
        formId: grpcFormId.toString(), 
        responseId: '99999', 
        token: grpcToken 
      }),
      true // expectErrors = true
    );
  }
}

// Test 9: Data Deletion
async function testDataDeletion() {
  console.log('\n==================================================');
  console.log('🧪 TEST 9: DATA DELETION');
  console.log('==================================================');
  
  // Test deleting specific response (using ID 1 if we don't have stored IDs)
  await compareRestAndGrpc(
    'Delete Specific Response',
    async () => makeRestCall('DELETE', `/forms/${testFormId || 1}/responses/${testResponseId || 1}`, null, true, restToken),
    async () => promisifyGrpc(grpcClients.responses, 'DeleteResponse', { 
      formId: (grpcFormId || 1).toString(), 
      responseId: (grpcResponseId || 1).toString(), 
      token: grpcToken 
    })
  );

  // Test deleting specific question (using ID 1 if we don't have stored IDs)
  await compareRestAndGrpc(
    'Delete Specific Question',
    async () => makeRestCall('DELETE', `/forms/${testFormId || 1}/questions/${testQuestionId || 1}`, null, true, restToken),
    async () => promisifyGrpc(grpcClients.questions, 'DeleteQuestion', { 
      formId: (grpcFormId || 1).toString(), 
      questionId: (grpcQuestionId || 1).toString(), 
      token: grpcToken 
    })
  );

  // Test deleting form
  if (testFormId && grpcFormId) {
    await compareRestAndGrpc(
      'Form Deletion',
      async () => makeRestCall('DELETE', `/forms/${testFormId}`, null, true, restToken),
      async () => promisifyGrpc(grpcClients.forms, 'DeleteForm', { formId: grpcFormId.toString(), token: grpcToken })
    );
  }
}

// Test 11: Session Management
async function testSessionManagement() {
  console.log('\n==================================================');
  console.log('🧪 TEST 11: SESSION MANAGEMENT');
  console.log('==================================================');
  
  // Test logout/end session
  await compareRestAndGrpc(
    'End Session (Logout)',
    async () => makeRestCall('DELETE', '/sessions', null, true, restToken),
    async () => promisifyGrpc(grpcClients.sessions, 'DeleteSession', { token: grpcToken })
  );
}

// Test 12: User Deletion
async function testUserDeletion() {
  console.log('\n==================================================');
  console.log('🧪 TEST 12: USER DELETION');  
  console.log('==================================================');
  
  // Since session management test logged out, we need to log in again
  console.log('🔐 Logging in again to get fresh tokens for user deletion...');
  
  const loginData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  };

  // Get fresh tokens for both APIs and store user IDs
  const restLoginResult = await makeRestCall('POST', '/sessions', loginData, false);
  const grpcLoginResult = await promisifyGrpc(grpcClients.sessions, 'CreateSession', loginData);

  let freshRestToken = null;
  let freshGrpcToken = null;
  let userIdForDeletion = null;

  if (restLoginResult.success && restLoginResult.data.token) {
    freshRestToken = restLoginResult.data.token;
    userIdForDeletion = restLoginResult.data.userId; // Get user ID from login response
    console.log('✅ REST login successful - got fresh token and user ID:', userIdForDeletion);
  } else {
    console.log('❌ REST login failed:', restLoginResult.error);
  }

  if (grpcLoginResult.success && grpcLoginResult.data.token) {
    freshGrpcToken = grpcLoginResult.data.token;
    console.log('✅ gRPC login successful - got fresh token');
  } else {
    console.log('❌ gRPC login failed:', grpcLoginResult.error);
  }

  // Test deleting current user with fresh tokens using specific user ID
  await compareRestAndGrpc(
    'Delete Current User',
    async () => makeRestCall('DELETE', `/users/${userIdForDeletion}`, null, true, freshRestToken),
    async () => promisifyGrpc(grpcClients.users, 'DeleteUser', { token: freshGrpcToken })
  );
}

// Test 10: Performance Comparison
async function testPerformance() {
  console.log('\n==================================================');
  console.log('🧪 TEST 10: PERFORMANCE COMPARISON');
  console.log('==================================================');
  
  if (!testFormId || !grpcFormId) {
    console.log('⚠️ Skipping performance tests - no form IDs available');
    return;
  }
  
  const iterations = 5; // Reduced for faster testing
  
  console.log(`⏱️ Testing performance with ${iterations} iterations each...`);
  
  // REST API Performance
  console.log('📊 Measuring REST API performance...');
  const restStartTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    await makeRestCall('GET', `/forms/${testFormId}`, null, true, restToken);
  }
  
  const restDuration = Date.now() - restStartTime;
  console.log(`REST API: ${restDuration}ms total, ${(restDuration/iterations).toFixed(2)}ms average`);

  // gRPC API Performance
  console.log('📊 Measuring gRPC API performance...');
  const grpcStartTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    await promisifyGrpc(grpcClients.forms, 'GetForm', {
      formId: grpcFormId.toString(),
      token: grpcToken
    });
  }
  
  const grpcDuration = Date.now() - grpcStartTime;
  console.log(`gRPC API: ${grpcDuration}ms total, ${(grpcDuration/iterations).toFixed(2)}ms average`);

  // Compare performance
  const fasterAPI = restDuration < grpcDuration ? 'REST' : 'gRPC';
  const speedupPercentage = ((Math.max(restDuration, grpcDuration) - Math.min(restDuration, grpcDuration)) / Math.max(restDuration, grpcDuration) * 100).toFixed(1);
  
  console.log(`🏆 Performance comparison: ${fasterAPI} API is ${speedupPercentage}% faster`);
  
  // Log performance comparison
  let perfLog = '\n=== PERFORMANCE COMPARISON ===\n';
  perfLog += `REST API: ${restDuration}ms total, ${(restDuration/iterations).toFixed(2)}ms average\n`;
  perfLog += `gRPC API: ${grpcDuration}ms total, ${(grpcDuration/iterations).toFixed(2)}ms average\n`;
  perfLog += `Faster API: ${fasterAPI} (${speedupPercentage}% faster)\n`;
  perfLog += '==============================\n';
  
  fs.appendFileSync(LOG_FILE, perfLog);
  
  // Mark as passed - performance comparison is informational
  testResults.total++;
  testResults.passed++;
  testResults.tests.push({
    name: 'Performance Comparison',
    passed: true,
    restSuccess: true,
    grpcSuccess: true
  });
  
  console.log(`🎯 Performance Comparison: ✅ COMPLETED`);
}

// Execute tests
async function runTests() {
  console.log('🚀 Starting REST vs gRPC Compliance Tests...');
  console.log('📋 REST API is the reference standard - gRPC must match REST behavior');
  console.log(`📝 Detailed logs will be saved to: ${LOG_FILE}`);
  
  try {
    // Cleanup databases before running tests
    await cleanupDatabases();
    
    await testUserRegistration();
    await testUserLogin();
    await testFormCreation();
    await testUserManagement();
    await testQuestionCreation();
    await testResponseCreation();
    await testDataRetrieval();
    await testDataUpdates();
    await testErrorHandling();
    await testPerformance();
    await testDataDeletion();
    await testSessionManagement();
    await testUserDeletion();
    
    // Final test summary
    console.log('\n' + '='.repeat(60));
    console.log('REST vs gRPC COMPLIANCE TEST RESULTS');
    console.log('='.repeat(60));
    console.log('REST API is the reference - gRPC must match REST behavior');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed (gRPC matches REST): ${testResults.passed} ✅`);
    console.log(`Failed (gRPC differs from REST): ${testResults.failed} ❌`);
    console.log('');
    
    // Detail each test result
    testResults.tests.forEach(test => {
      console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
      if (!test.passed) {
        if (!test.restSuccess) console.log(`   REST Error: ${test.restError}`);
        if (!test.grpcSuccess) console.log(`   gRPC Error: ${test.grpcError.message || test.grpcError}`);
        if (test.restSuccess && test.grpcSuccess) {
          console.log(`   Both APIs succeeded but gRPC response differs from REST`);
        }
      }
    });
    
    console.log('');
    if (testResults.failed === 0) {
      console.log('🎉 All tests PASSED! gRPC API perfectly matches REST API behavior.');
    } else {
      console.log(`⚠️  ${testResults.failed} test(s) FAILED. gRPC API does not match REST API.`);
    }
    
    console.log(`📖 Check ${LOG_FILE} for detailed comparison results.`);
    
    // Exit with error code if tests failed
    if (testResults.failed > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();
