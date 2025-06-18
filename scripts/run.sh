#!/bin/bash

# gRPC Forms API Startup Script
# This script compiles proto files, builds and starts the server

echo "🚀 Starting gRPC Forms API..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "Checking Node.js version..."
node_version=$(node --version)
print_success "Node.js version: $node_version"

# Step 1: Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_success "Dependencies already installed"
fi

# Step 2: Check if proto files exist
if [ ! -f "proto/forms.proto" ]; then
    print_error "Proto file not found at proto/forms.proto"
    exit 1
fi

print_success "Proto files found"

# Step 3: Check if database needs initialization
if [ ! -f "forms.db" ]; then
    print_status "Database not found. Initializing database..."
    npm run init-db
    if [ $? -eq 0 ]; then
        print_success "Database initialized successfully"
    else
        print_error "Failed to initialize database"
        exit 1
    fi
else
    print_success "Database already exists"
fi

# Step 4: Check if all required files exist
required_files=(
    "src/grpc_server.js"
    "src/services/formsService.js"
    "src/services/questionsService.js"
    "src/services/responsesService.js"
    "src/services/usersService.js"
    "src/services/sessionsService.js"
    "src/models/formsModel.js"
    "src/models/questionsModel.js"
    "src/models/responseModel.js"
    "src/models/userModel.js"
    "src/utils/auth.js"
    "src/db/db.js"
)

print_status "Checking required files..."
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file not found: $file"
        exit 1
    fi
done
print_success "All required files found"

# Step 5: Kill any existing Node.js processes (optional)
if pgrep -f "node.*grpc_server" > /dev/null; then
    print_warning "Existing gRPC server process found. Killing..."
    pkill -f "node.*grpc_server"
    sleep 2
fi

# Step 6: Start the server
print_status "Starting gRPC server..."
echo ""
echo "=========================================="
echo "🚀 gRPC Forms API Server Starting..."
echo "=========================================="
echo ""

# Start the server with npm start
npm start

# If server exits, show message
echo ""
print_warning "Server has stopped"
