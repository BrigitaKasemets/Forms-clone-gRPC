import 'dotenv/config';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Service implementations
import { FormsServiceImpl } from './services/formsService.js';
import { QuestionsServiceImpl } from './services/questionsService.js';
import { ResponsesServiceImpl } from './services/responsesService.js';
import { UsersServiceImpl } from './services/usersService.js';
import { SessionsServiceImpl } from './services/sessionsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Proto faili asukoht
const PROTO_PATH = join(__dirname, '../proto/forms.proto');

// Proto faili laadimine
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const formsProto = grpc.loadPackageDefinition(packageDefinition).forms;

// Server loomine
const server = new grpc.Server();

// Teenuste lisamine
server.addService(formsProto.FormsService.service, FormsServiceImpl);
server.addService(formsProto.QuestionsService.service, QuestionsServiceImpl);
server.addService(formsProto.ResponsesService.service, ResponsesServiceImpl);
server.addService(formsProto.UsersService.service, UsersServiceImpl);
server.addService(formsProto.SessionsService.service, SessionsServiceImpl);

// Serveri käivitamine
const PORT = process.env.GRPC_PORT || '50051';
const HOST = process.env.GRPC_HOST || '0.0.0.0';

server.bindAsync(
  `${HOST}:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (error, port) => {
    if (error) {
      console.error('Failed to bind server:', error);
      return;
    }
    
    console.log(`🚀 gRPC Server running on ${HOST}:${port}`);
    console.log('📋 Available services:');
    console.log('   - FormsService');
    console.log('   - QuestionsService');
    console.log('   - ResponsesService');
    console.log('   - UsersService');
    console.log('   - SessionsService');
    
    server.start();
  }
);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gRPC server...');
  server.tryShutdown((error) => {
    if (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    } else {
      console.log('✅ gRPC server shut down gracefully');
      process.exit(0);
    }
  });
});