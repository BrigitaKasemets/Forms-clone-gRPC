#!/bin/bash

# gRPC Forms API Client Test Script
# This script runs the comprehensive client tests

echo "🧪 Running gRPC Forms API Client Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test configuration
TEST_START_TIME=$(date +%s)
LOG_FILE="tests/grpc-test-results.log"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" >> "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1" >> "$LOG_FILE"
}

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}${BOLD}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === $1 ===" >> "$LOG_FILE"
}

# Initialize log file
init_log() {
    mkdir -p tests
    echo "=== gRPC CLIENT TEST RUN STARTED AT $(date) ===" > "$LOG_FILE"
    echo "" >> "$LOG_FILE"
}

# Check if dependencies are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if [ ! -f "node_modules/.bin/node" ] && [ ! -d "node_modules" ]; then
        print_warning "Node modules not found. Installing dependencies..."
        npm install
        if [ $? -ne 0 ]; then
            print_error "Failed to install dependencies"
            return 1
        fi
    fi
    
    print_success "Dependencies are ready"
    return 0
}

# Check if database is initialized
check_database() {
    print_status "Checking database..."
    
    if [ ! -f "forms.db" ]; then
        print_warning "Database not found. Initializing..."
        npm run init-db
        if [ $? -ne 0 ]; then
            print_error "Failed to initialize database"
            return 1
        fi
    fi
    
    print_success "Database is ready"
    return 0
}

# Check if server is running
check_server() {
    print_status "Checking if gRPC server is running..."
    
    # Try to connect to the server
    if ! nc -z localhost 50051 2>/dev/null; then
        print_error "gRPC server is not running on port 50051"
        print_warning "Please start the server first with: npm run start"
        return 1
    fi
    
    print_success "gRPC server is running on port 50051"
    return 0
}

# Check if required files exist
check_files() {
    print_status "Checking required files..."
    
    local missing_files=0
    
    if [ ! -f "client/grpc_client.js" ]; then
        print_error "Client file not found at client/grpc_client.js"
        missing_files=$((missing_files + 1))
    fi
    
    if [ ! -f "proto/forms.proto" ]; then
        print_error "Proto file not found at proto/forms.proto"
        missing_files=$((missing_files + 1))
    fi
    
    if [ ! -f "src/grpc_server.js" ]; then
        print_error "Server file not found at src/grpc_server.js"
        missing_files=$((missing_files + 1))
    fi
    
    if [ $missing_files -eq 0 ]; then
        print_success "All required files are present"
        return 0
    else
        print_error "$missing_files required file(s) missing"
        return 1
    fi
}

# Run the tests
run_client_tests() {
    print_header "EXECUTING gRPC CLIENT TESTS"
    
    print_status "Starting comprehensive gRPC service tests..."
    echo ""
    echo "Test Coverage:"
    echo "• User Authentication (Register/Login)"
    echo "• Form Management (CRUD operations)"
    echo "• Question Management"
    echo "• Response Handling"
    echo "• Session Management"
    echo "• Error Handling"
    echo ""
    
    print_status "Running client tests..."
    
    # Run the client tests with output capture
    npm run client 2>&1 | tee -a "$LOG_FILE"
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        print_success "🎉 All gRPC client tests passed!"
        return 0
    else
        print_error "❌ Some gRPC client tests failed (exit code: $exit_code)"
        return 1
    fi
}

# Generate test summary
generate_summary() {
    local test_result=$1
    local end_time=$(date +%s)
    local duration=$((end_time - TEST_START_TIME))
    
    print_header "TEST EXECUTION SUMMARY"
    
    echo "Test Date: $(date)"
    echo "Duration: ${duration} seconds"
    echo "gRPC Server: localhost:50051"
    echo "Database: SQLite (forms.db)"
    echo ""
    
    if [ $test_result -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✅ RESULT: ALL TESTS PASSED${NC}"
        echo "The gRPC API is functioning correctly."
    else
        echo -e "${RED}${BOLD}❌ RESULT: SOME TESTS FAILED${NC}"
        echo "There are issues with the gRPC API implementation."
    fi
    
    echo ""
    echo "Log file: $LOG_FILE"
    echo "To view detailed logs: cat $LOG_FILE"
    
    # Write summary to log
    echo "" >> "$LOG_FILE"
    echo "=== TEST SUMMARY ===" >> "$LOG_FILE"
    echo "Duration: ${duration} seconds" >> "$LOG_FILE"
    echo "Result: $([ $test_result -eq 0 ] && echo "PASSED" || echo "FAILED")" >> "$LOG_FILE"
    echo "=== END OF TEST RUN ===" >> "$LOG_FILE"
}

# Main execution function
main() {
    print_header "gRPC FORMS API - CLIENT TESTS"
    
    # Initialize logging
    init_log
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Run all checks
    if ! check_dependencies; then
        exit 1
    fi
    
    if ! check_database; then
        exit 1
    fi
    
    if ! check_files; then
        exit 1
    fi
    
    if ! check_server; then
        print_warning "Server is not running. You can start it with: npm run start"
        exit 1
    fi
    
    # Run the tests
    run_client_tests
    test_result=$?
    
    # Generate summary
    generate_summary $test_result
    
    exit $test_result
}

# Execute main function
main "$@"
