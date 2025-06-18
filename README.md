# gRPC Forms API

## Project Overview

This project implements a Google Forms-like service using **gRPC** technology. It provides a complete backend API for creating and managing forms, questions, user responses, and user authentication.

### Technology Stack
- **Runtime:** Node.js 18+ (ES modules)
- **API Protocol:** gRPC with Protocol Buffers
- **Database:** SQLite
- **Authentication:** JWT tokens with bcrypt password hashing
- **Testing:** Automated test suite with performance benchmarking

## Quick Commands

Get started with these essential commands:

```bash
npm run setup     # Setup project (install dependencies + initialize database)
npm run run       # Start the gRPC server
npm run client    # Test the gRPC connection
npm test          # Run comprehensive tests (REST vs gRPC Comparison)
```

## Installation and Setup

### Quick Start
```bash
# Clone the repository

# Complete setup: install dependencies and initialize database
npm run setup
```

### Manual Setup
```bash
# Install dependencies
npm install

# Initialize database
npm run init-db
```

## Running the Project

### Start the Server

```bash
# Option 1: Start with all pre-checks (recommended)
npm run run

# Option 2: Start directly
npm start

# Option 3: Development mode with auto-restart
npm run dev
```

The server will start on port **50051** by default.

### Verify Installation

```bash
# Test the gRPC connection
npm run client
```


### Database Operations
```bash
npm run init-db     # Initialize/reset the SQLite database
```

### Testing
```bash
npm run client          # Run basic gRPC client demonstration
npm run test-client     # Run comprehensive gRPC client tests
npm test               # Run REST vs gRPC comparison tests
npm run test:comparison # Same as 'npm test'
npm run test:grpc-only  # Test only gRPC functionality (same as test-client)
```

### Setup and Maintenance
```bash
npm run setup       # Complete project setup (dependencies + database)
npm run clean       # Remove node_modules, package-lock.json, and database
```

## Testing

### Basic Client Testing
```bash
# Run gRPC client demonstration
npm run client

# Run comprehensive gRPC tests
npm run test-client
```

### Advanced Testing (REST vs gRPC Comparison)

This project includes a unique feature that compares REST and gRPC API implementations:

```bash
# Run comprehensive comparison tests
npm test
```

**Prerequisites for comparison tests:**
1. Start your REST API on port 3000 ([separate project](https://github.com/BrigitaKasemets/forms-clone-api.git)) 
2. Start this gRPC API on port 50051: `npm run run`

