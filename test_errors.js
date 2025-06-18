import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Proto faili laadimine
const PROTO_PATH = join(__dirname, 'proto/forms.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const formsProto = grpc.loadPackageDefinition(packageDefinition).forms;

// Klientide loomine
const formsClient = new formsProto.FormsService('localhost:50051', grpc.credentials.createInsecure());
const sessionsClient = new formsProto.SessionsService('localhost:50051', grpc.credentials.createInsecure());

async function testErrorHandling() {
  console.log('🧪 Testing gRPC Error Handling...\n');

  try {
    // Test 1: Invalid credentials
    console.log('1. Testing invalid credentials...');
    try {
      await new Promise((resolve, reject) => {
        sessionsClient.CreateSession({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        }, (error, response) => {
          if (error) {
            console.log(`✅ Error correctly returned: ${error.code} - ${error.message}`);
            resolve();
          } else {
            reject(new Error('Expected error but got response'));
          }
        });
      });
    } catch (err) {
      console.log(`❌ Unexpected error: ${err.message}`);
    }

    // Test 2: Invalid token
    console.log('\n2. Testing invalid token...');
    try {
      await new Promise((resolve, reject) => {
        formsClient.CreateForm({
          title: 'Test Form',
          description: 'Test Description',
          token: 'invalid_token'
        }, (error, response) => {
          if (error) {
            console.log(`✅ Error correctly returned: ${error.code} - ${error.message}`);
            resolve();
          } else {
            reject(new Error('Expected error but got response'));
          }
        });
      });
    } catch (err) {
      console.log(`❌ Unexpected error: ${err.message}`);
    }

    // Test 3: Missing required field
    console.log('\n3. Testing missing required field...');
    try {
      await new Promise((resolve, reject) => {
        formsClient.CreateForm({
          description: 'Test Description',
          token: 'invalid_token'
        }, (error, response) => {
          if (error) {
            console.log(`✅ Error correctly returned: ${error.code} - ${error.message}`);
            resolve();
          } else {
            reject(new Error('Expected error but got response'));
          }
        });
      });
    } catch (err) {
      console.log(`❌ Unexpected error: ${err.message}`);
    }

    console.log('\n🎉 Error handling tests completed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testErrorHandling();
