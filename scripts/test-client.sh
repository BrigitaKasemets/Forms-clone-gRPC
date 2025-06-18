#!/bin/bash

# gRPC Forms API Client Test Script
# This script runs the comprehensive client tests

echo "🧪 Running gRPC Forms API Client Tests..."

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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if server is running
print_status "Checking if gRPC server is running..."
if ! nc -z localhost 50051 2>/dev/null; then
    print_error "gRPC server is not running on port 50051"
    echo "Please start the server first with: ./run.sh"
    exit 1
fi

print_success "gRPC server is running"

# Check if client file exists
if [ ! -f "client/grpc_client.js" ]; then
    print_error "Client file not found at client/grpc_client.js"
    exit 1
fi

print_status "Starting client tests..."
echo ""
echo "=========================================="
echo "🧪 Running 24 gRPC Service Tests..."
echo "=========================================="
echo ""

# Run the client tests
npm run client

echo ""
print_success "Client tests completed"
