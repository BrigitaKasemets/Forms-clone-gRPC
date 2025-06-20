import 'dotenv/config';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const GRPC_HOST = 'localhost';
const GRPC_PORT = '50051';
const PROTO_PATH = join(__dirname, '../proto/forms.proto');
const LOG_FILE = join(__dirname, 'grpc-security-test.log');

// Clear log file at start
fs.writeFileSync(LOG_FILE, `=== gRPC SECURITY TEST STARTED AT ${new Date().toLocaleString('et-EE', { timeZone: 'Europe/Tallinn' })} ===\n`);

// Test data
const TEST_EMAIL = 'securitytest@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Security Test User';

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
  sessions: new formsProto.SessionsService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  forms: new formsProto.FormsService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure()),
  users: new formsProto.UsersService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure())
};

// Helper function to promisify gRPC calls
function promisifyGrpc(client, method, data) {
  return new Promise((resolve, reject) => {
    client[method](data, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

async function logMessage(message) {
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + '\n');
}

async function testLogoutSecurity() {
  await logMessage('\n🔒 TESTING LOGOUT SECURITY VULNERABILITY...');
  
  let testPassed = true;
  let token = null;
  let userId = null;
  
  try {
    // Step 1: Register user
    await logMessage('\n1️⃣ Registering test user...');
    const registerData = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME
    };
    
    try {
      const registerResult = await promisifyGrpc(grpcClients.users, 'CreateUser', registerData);
      await logMessage(`✅ User registered: ID ${registerResult.id}`);
      userId = registerResult.id;
    } catch (error) {
      if (error.code === grpc.status.ALREADY_EXISTS) {
        await logMessage('ℹ️ User already exists, continuing...');
      } else {
        await logMessage(`❌ Registration failed: ${error.message}`);
        return false;
      }
    }
    
    // Step 2: Login and get token
    await logMessage('\n2️⃣ Logging in to get token...');
    const loginData = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    };
    
    const loginResult = await promisifyGrpc(grpcClients.sessions, 'CreateSession', loginData);
    token = loginResult.token;
    await logMessage(`✅ Login successful, token: ${token.substring(0, 20)}...`);
    
    // Step 3: Create a private form
    await logMessage('\n3️⃣ Creating a private form...');
    const formData = {
      token: token,
      title: 'Secret Form',
      description: 'This is private user data'
    };
    
    const formResult = await promisifyGrpc(grpcClients.forms, 'CreateForm', formData);
    await logMessage(`✅ Private form created: ID ${formResult.id}`);
    
    // Step 4: Verify access to private form
    await logMessage('\n4️⃣ Verifying access to private form before logout...');
    const beforeLogoutAccess = await promisifyGrpc(grpcClients.forms, 'ListForms', { token: token });
    await logMessage(`✅ Before logout - can access ${beforeLogoutAccess.forms.length} forms`);
    
    // Step 5: Logout
    await logMessage('\n5️⃣ Logging out...');
    const logoutResult = await promisifyGrpc(grpcClients.sessions, 'DeleteSession', { token: token });
    await logMessage(`✅ Logout response: ${JSON.stringify(logoutResult)}`);
    
    // Step 6: 🚨 CRITICAL TEST - Try to access private data after logout
    await logMessage('\n6️⃣ 🚨 CRITICAL TEST: Attempting to access private data after logout...');
    await logMessage(`gRPC API:`);
    await logMessage(`Call: FormsService.ListForms`);
    await logMessage(`Request: {"token":"${token.substring(0, 20)}..."}`);
    
    try {
      const afterLogoutAccess = await promisifyGrpc(grpcClients.forms, 'ListForms', { token: token });
      
      // If we get here, the token is still valid - THIS IS A SECURITY VULNERABILITY!
      await logMessage(`Response: ${JSON.stringify(afterLogoutAccess)}`);
      await logMessage(`Result: ❌ Can still access private forms (🚨 VULNERABILITY!)`);
      await logMessage(`Forms visible: ${afterLogoutAccess.forms.length} forms`);
      
      if (afterLogoutAccess.forms.length > 0) {
        const form = afterLogoutAccess.forms[0];
        await logMessage(`Sample accessible form: ${JSON.stringify({
          id: form.id,
          title: form.title,
          description: form.description
        })}`);
      }
      
      await logMessage(`🚨 CRITICAL: User's private data accessible after logout!`);
      testPassed = false;
      
    } catch (error) {
      // This is the expected behavior - token should be invalid
      await logMessage(`Response: Error - ${error.message}`);
      await logMessage(`Result: ✅ Token properly invalidated after logout`);
      await logMessage(`✅ SECURE: Cannot access private data after logout`);
    }
    
  } catch (error) {
    await logMessage(`❌ Test failed with error: ${error.message}`);
    testPassed = false;
  }
  
  return testPassed;
}

async function runSecurityTests() {
  await logMessage('🔒 Starting gRPC Security Tests...');
  await logMessage('🎯 Focus: Logout Token Invalidation Vulnerability');
  
  try {
    const logoutSecurityPassed = await testLogoutSecurity();
    
    await logMessage('\n' + '='.repeat(60));
    await logMessage('🔒 gRPC SECURITY TEST RESULTS');
    await logMessage('='.repeat(60));
    
    if (logoutSecurityPassed) {
      await logMessage('✅ ALL SECURITY TESTS PASSED');
      await logMessage('✅ Logout properly invalidates tokens');
      await logMessage('✅ No unauthorized access to private data');
    } else {
      await logMessage('❌ SECURITY VULNERABILITY DETECTED!');
      await logMessage('🚨 CRITICAL: Logout does not invalidate tokens');
      await logMessage('🚨 RISK: Unauthorized access to private user data');
      await logMessage('🚨 IMPACT: Tokens remain valid until natural expiration (7 days)');
      
      await logMessage('\n📋 SECURITY RECOMMENDATIONS:');
      await logMessage('1. Implement proper session management in database');
      await logMessage('2. Store tokens in sessions table during login');
      await logMessage('3. Remove tokens from sessions table during logout');
      await logMessage('4. Verify token exists in database during authentication');
    }
    
    await logMessage(`\n📝 Detailed logs saved to: ${LOG_FILE}`);
    
  } catch (error) {
    await logMessage(`❌ Security test failed: ${error.message}`);
  }
  
  // Cleanup
  try {
    await promisifyGrpc(grpcClients.users, 'DeleteUser', { email: TEST_EMAIL });
    await logMessage('🧹 Cleanup: Test user deleted');
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Run the tests
runSecurityTests()
  .then(() => {
    console.log('\n🏁 Security tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Security test error:', error);
    process.exit(1);
  });
