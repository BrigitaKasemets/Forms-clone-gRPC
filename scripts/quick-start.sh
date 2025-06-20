#!/bin/bash

# Quick Start Script for Forms Clone Project
# This script compiles proto files, builds and starts both gRPC and REST servers
# Installs all dependencies and initializes databases

echo "🚀 Quick Start - Forms Clone Project"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
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

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}${BOLD}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

# Go to project root (scripts is a subdirectory)
cd "$(dirname "$0")/.."

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

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Function to cleanup on exit
cleanup() {
    print_warning "Stopping servers..."
    pkill -f "grpc_server.js" 2>/dev/null
    pkill -f "formsClone.js" 2>/dev/null
    print_status "Cleanup completed"
    exit 0
}

# Trap signals to cleanup properly
trap cleanup SIGINT SIGTERM

print_header "STEP 1: Cleaning Previous Installation"

# Function to safely remove files/directories
safe_remove() {
    local target=$1
    local description=$2
    if [ -e "$target" ]; then
        print_warning "Removing existing $description..."
        rm -rf "$target"
        print_success "$description removed"
    else
        print_status "No existing $description found"
    fi
}

# Clean previous installations for fresh start
safe_remove "node_modules" "node_modules directory"
safe_remove "package-lock.json" "package-lock.json"
safe_remove "forms.db" "main database"
safe_remove "REST-api/node_modules" "REST API node_modules"
safe_remove "REST-api/package-lock.json" "REST API package-lock.json"
safe_remove "REST-api/forms.db" "REST API database"
safe_remove "logs" "log files directory"

print_header "STEP 2: Creating Environment Files"

# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "fallback-secret-$(date +%s)")

# Create .env file for gRPC server
print_status "Creating .env file for gRPC server..."
cat > .env << EOF
# gRPC Server Configuration
JWT_SECRET=${JWT_SECRET}
NODE_ENV=development
EOF
print_success "gRPC .env file created"

# Create .env file for REST API
print_status "Creating .env file for REST API..."
cat > REST-api/.env << EOF
# REST API Configuration
JWT_SECRET=${JWT_SECRET}
NODE_ENV=development
PORT=3000
EOF
print_success "REST API .env file created"

print_header "STEP 3: Installing gRPC Server Dependencies"

# Install main project dependencies
print_status "Installing main project dependencies..."
npm install
if [ $? -ne 0 ]; then
    print_error "Failed to install main project dependencies"
    exit 1
fi
print_success "Main project dependencies installed"

print_header "STEP 4: Installing REST API Dependencies"

# Install REST API dependencies
print_status "Installing REST API dependencies..."
cd REST-api
npm install
if [ $? -ne 0 ]; then
    print_error "Failed to install REST API dependencies"
    exit 1
fi
print_success "REST API dependencies installed"
cd ..

print_header "STEP 5: Checking Proto Files"

# Check if proto files exist
print_status "Checking proto files..."
if [ ! -f "proto/forms.proto" ]; then
    print_error "Proto file not found at proto/forms.proto"
    exit 1
fi
print_success "Proto files found and ready for dynamic loading"

print_header "STEP 6: Checking Project Structure"

# Check required directories
required_dirs=(
    "src"
    "src/services"
    "src/models"
    "src/db"
    "src/utils"
    "proto"
    "client"
    "REST-api"
    "REST-api/src"
    "REST-api/src/controllers"
    "REST-api/src/routes"
    "tests"
)

print_status "Checking required directories..."
for dir in "${required_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        print_error "Required directory not found: $dir"
        exit 1
    fi
done
print_success "All required directories found"

# Check required files
required_files=(
    "package.json"
    "proto/forms.proto"
    "src/grpc_server.js"
    "client/grpc_client.js"
    "REST-api/package.json"
    "REST-api/src/formsClone.js"
)

print_status "Checking required files..."
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file not found: $file"
        exit 1
    fi
done
print_success "All required files found"

# Make scripts executable
print_status "Making scripts executable..."
chmod +x scripts/*.sh 2>/dev/null || true
print_success "Scripts made executable"

print_header "STEP 7: Initializing Databases"

# Initialize main database
print_status "Initializing gRPC server database..."
npm run init-db
if [ $? -ne 0 ]; then
    print_error "Failed to initialize gRPC server database"
    exit 1
fi
print_success "gRPC server database initialized"

# Initialize REST API database
print_status "Initializing REST API database..."
cd REST-api
npm run init-db
if [ $? -ne 0 ]; then
    print_error "Failed to initialize REST API database"
    exit 1
fi
print_success "REST API database initialized"
cd ..

print_header "STEP 8: Starting Servers"

# Stop any existing processes on the ports
print_status "Checking for existing processes..."
GRPC_EXISTING=$(lsof -ti :50051 2>/dev/null || true)
REST_EXISTING=$(lsof -ti :3000 2>/dev/null || true)

if [ ! -z "$GRPC_EXISTING" ]; then
    print_warning "Stopping existing process on port 50051 (PID: $GRPC_EXISTING)"
    kill $GRPC_EXISTING 2>/dev/null || true
    sleep 1
fi

if [ ! -z "$REST_EXISTING" ]; then
    print_warning "Stopping existing process on port 3000 (PID: $REST_EXISTING)"
    kill $REST_EXISTING 2>/dev/null || true
    sleep 1
fi

# Create logs directory
mkdir -p logs

# Start gRPC server in background
print_status "Starting gRPC server on port 50051..."
node src/grpc_server.js > logs/grpc-server.log 2>&1 &
GRPC_PID=$!

# Wait a moment for gRPC server to start
sleep 2

# Check if gRPC server is running
if ! kill -0 $GRPC_PID 2>/dev/null; then
    print_error "Failed to start gRPC server"
    cat logs/grpc-server.log
    exit 1
fi
print_success "gRPC server started (PID: $GRPC_PID)"

# Start REST API server in background
print_status "Starting REST API server on port 3000..."
cd REST-api
node src/formsClone.js > ../logs/rest-server.log 2>&1 &
REST_PID=$!
cd ..

# Wait a moment for REST server to start
sleep 2

# Check if REST server is running
if ! kill -0 $REST_PID 2>/dev/null; then
    print_error "Failed to start REST API server"
    cat logs/rest-server.log
    exit 1
fi
print_success "REST API server started (PID: $REST_PID)"

print_header "SERVERS READY!"

echo -e "${GREEN}✅ Both servers are now running:${NC}"
echo ""
echo -e "${CYAN}📡 gRPC Server:${NC}"
echo "   - Port: 50051"
echo "   - PID: $GRPC_PID"
echo "   - Logs: logs/grpc-server.log"
echo ""
echo -e "${CYAN}🌐 REST API Server:${NC}"
echo "   - Port: 3000" 
echo "   - PID: $REST_PID"
echo "   - Logs: logs/rest-server.log"
echo "   - Swagger UI: http://localhost:3000/api-docs"
echo ""
echo -e "${YELLOW}📋 Available commands:${NC}"
echo "   npm run client       - Test gRPC client"
echo "   npm run test-client  - Run gRPC tests"
echo "   npm run test         - Run comparison tests"
echo ""
echo -e "${BLUE}💡 To stop both servers, press Ctrl+C${NC}"
echo ""

# Wait for user interrupt
while true; do
    # Check if servers are still running
    if ! kill -0 $GRPC_PID 2>/dev/null; then
        print_error "gRPC server has stopped unexpectedly"
        print_status "Check logs/grpc-server.log for details"
        break
    fi
    
    if ! kill -0 $REST_PID 2>/dev/null; then
        print_error "REST API server has stopped unexpectedly"
        print_status "Check logs/rest-server.log for details"
        break
    fi
    
    sleep 5
done

# If we get here, one of the servers died
cleanup
