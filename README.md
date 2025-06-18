# gRPC Forms API

A Google Forms-like service implemented with gRPC, supporting full CRUD operations for forms, questions, responses, users, and authentication.

## 🚀 Quick Start

### Option 1: One-command setup and run
```bash
# Complete setup and start server
npm run run
```

### Option 2: Step-by-step setup
```bash
# 1. Setup project (installs dependencies, initializes DB)
npm run setup

# 2. Start server
npm run run

# 3. Run client tests (in another terminal)
npm run test-client
```

## 📋 Available Scripts

### Setup & Management
- `npm run setup` - Complete project setup from scratch
- `npm run run` - Start the gRPC server (includes all checks)
- `npm run test-client` - Run comprehensive client tests

### Development
- `npm start` - Start server directly
- `npm run dev` - Start server with nodemon (auto-restart)
- `npm run client` - Run client tests directly
- `npm run init-db` - Initialize/reset database
- `npm run clean` - Clean all generated files

### Scripts Directory
All setup and management scripts are located in the `scripts/` directory:
- `scripts/setup.sh` - Project setup script
- `scripts/run.sh` - Server startup script  
- `scripts/test-client.sh` - Client testing script

### Käivitamine

1. Käivita gRPC server:
```bash
npm start
# või arendusrežiimis:
npm run dev
```

2. Testi ühendust:
```bash
npm run client
```

## API Dokumentatsioon

### Saadaolevad teenused

#### 1. FormsService
- `CreateForm` - Loo uus vorm
- `GetForm` - Hangi vorm ID järgi
- `ListForms` - Hangi kõik kasutaja vormid
- `UpdateForm` - Uuenda vorm
- `DeleteForm` - Kustuta vorm

#### 2. QuestionsService
- `CreateQuestion` - Lisa küsimus vormile
- `GetQuestion` - Hangi küsimus ID järgi
- `ListQuestions` - Hangi vormi kõik küsimused
- `UpdateQuestion` - Uuenda küsimus
- `DeleteQuestion` - Kustuta küsimus

#### 3. ResponsesService
- `CreateResponse` - Loo vastus vormile
- `GetResponse` - Hangi vastus ID järgi
- `ListResponses` - Hangi vormi kõik vastused
- `UpdateResponse` - Uuenda vastus
- `DeleteResponse` - Kustuta vastus

#### 4. UsersService
- `CreateUser` - Registreeri uus kasutaja
- `GetUser` - Hangi kasutaja andmed
- `ListUsers` - Hangi kõik kasutajad
- `UpdateUser` - Uuenda kasutaja
- `DeleteUser` - Kustuta kasutaja

#### 5. SessionsService
- `CreateSession` - Logi sisse (loo sessioon)
- `DeleteSession` - Logi välja (kustuta sessioon)
- `ValidateSession` - Valideeri sessioon

### Autentimine

Kõik teenused (välja arvatud `CreateUser` ja `CreateSession`) nõuavad JWT tokenit:

```javascript
const request = {
  // ... muud parameetrid
  token: 'your_jwt_token_here'
};
```

## Näited

### Kliendi loomine (JavaScript)

```javascript
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

// Laadi proto fail
const packageDefinition = protoLoader.loadSync('proto/forms.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const formsProto = grpc.loadPackageDefinition(packageDefinition).forms;

// Loo klient
const client = new formsProto.FormsService('localhost:50051', 
  grpc.credentials.createInsecure());

// Kasuta teenust
client.ListForms({ token: 'your_token' }, (error, response) => {
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Forms:', response.forms);
  }
});
```

## Arendus

### Projekti struktuur

- `proto/` - Protocol Buffer definitsioonid
- `src/services/` - gRPC teenuste implementatsioonid
- `src/models/` - Andmemudelid
- `src/db/` - Andmebaasi seadistus
- `src/utils/` - Abifunktsioonid

### Skriptid

- `npm start` - Käivita server
- `npm run dev` - Käivita arendusrežiimis (nodemon)
- `npm run init-db` - Initsialiseeri andmebaas
- `npm run client` - Käivita test klient
- `npm test` - Käivita testid

## 📁 Project Structure

```
Forms-clone-gRPC/
├── client/                    # gRPC klient
│   └── grpc_client.js        # Üksikasjalik test klient (22 testi)
├── proto/                     # Protocol Buffer definitsioonid
│   └── forms.proto           # gRPC teenuste definitsioonid
├── scripts/                   # Automatiseeritud skriptid
│   ├── setup.sh              # Projekti seadistamine
│   ├── run.sh                # Serveri käivitamine
│   └── test-client.sh        # Kliendi testide käivitamine
├── src/
│   ├── db/                   # Andmebaasi kihid
│   │   ├── db.js            # SQLite ühendus
│   │   └── init.js          # Andmebaasi seadistamine
│   ├── models/              # Andmete mudelid
│   │   ├── formsModel.js
│   │   ├── questionsModel.js
│   │   ├── responseModel.js
│   │   └── userModel.js
│   ├── services/            # gRPC teenuste implementatsioonid
│   │   ├── formsService.js
│   │   ├── questionsService.js
│   │   ├── responsesService.js
│   │   ├── sessionsService.js
│   │   └── usersService.js
│   ├── utils/               # Abifunktsioonid
│   │   └── auth.js          # JWT autentimine
│   └── grpc_server.js       # Peamine gRPC server
├── forms.db                 # SQLite andmebaas (luuakse automaatselt)
├── package.json
└── README.md
```
