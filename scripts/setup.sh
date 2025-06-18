#!/bin/bash

# gRPC Forms API Setup Script
# This script sets up the entire project from scratch

echo "⚙️  Setting up gRPC Forms API..."

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

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Step 1: Clean previous installations
if [ -d "node_modules" ]; then
    print_warning "Removing existing node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    print_warning "Removing existing package-lock.json..."
    rm -f package-lock.json
fi

if [ -f "forms.db" ]; then
    print_warning "Removing existing database..."
    rm -f forms.db
fi

# Step 2: Install dependencies
print_status "Installing dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Step 3: Initialize database
print_status "Initializing database..."
npm run init-db
if [ $? -eq 0 ]; then
    print_success "Database initialized successfully"
else
    print_error "Failed to initialize database"
    exit 1
fi

# Step 4: Check project structure
print_status "Checking project structure..."

required_dirs=(
    "src"
    "src/services"
    "src/models"
    "src/db"
    "src/utils"
    "proto"
    "client"
)

for dir in "${required_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        print_error "Required directory not found: $dir"
        exit 1
    fi
done

required_files=(
    "package.json"
    "proto/forms.proto"
    "src/grpc_server.js"
    "client/grpc_client.js"
    "scripts/run.sh"
    "scripts/test-client.sh"
    "scripts/setup.sh"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file not found: $file"
        exit 1
    fi
done

print_success "Project structure is valid"

# Step 5: Make scripts executable
chmod +x scripts/run.sh
chmod +x scripts/test-client.sh
chmod +x scripts/setup.sh

print_success "Scripts made executable"

echo ""
echo "=========================================="
echo "✅ Setup completed successfully!"
echo "=========================================="
echo ""
echo "Available commands:"
echo "  npm run run        - Start the gRPC server"
echo "  npm run test-client - Run client tests"
echo "  npm start          - Start server directly"
echo "  npm run client     - Run client tests directly"
echo "  npm run init-db    - Reinitialize database"
echo ""
print_success "You can now start the server with: npm run run"
