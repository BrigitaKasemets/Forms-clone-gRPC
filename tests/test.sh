#!/bin/bash

# REST vs gRPC API Comparison Test Script
# This script compares REST API (port 3000) and gRPC API (port 50051) responses

echo "🧪 Starting REST vs gRPC API Comparison Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

# Check if required servers are running
check_servers() {
    print_header "CHECKING SERVER AVAILABILITY"
    
    # Check REST API (port 3000)
    print_status "Checking REST API on port 3000..."
    if ! curl -s -f "http://localhost:3000/health" >/dev/null 2>&1; then
        print_error "REST API is not running on port 3000"
        print_warning "Please start your REST API project first"
        return 1
    fi
    print_success "REST API is running on port 3000"
    
    # Check gRPC API (port 50051)
    print_status "Checking gRPC API on port 50051..."
    if ! nc -z localhost 50051 2>/dev/null; then
        print_error "gRPC API is not running on port 50051"
        print_warning "Please start the gRPC server with: npm run start"
        return 1
    fi
    print_success "gRPC API is running on port 50051"
    
    return 0
}

# Install dependencies if needed
install_dependencies() {
    print_header "CHECKING DEPENDENCIES"
    
    # Check if node-fetch is available (needed for REST API calls)
    if ! npm list node-fetch >/dev/null 2>&1; then
        print_status "Installing node-fetch for REST API calls..."
        npm install node-fetch
    fi
    
    print_success "All dependencies are available"
}

# Run the main test suite
run_tests() {
    print_header "EXECUTING TEST SUITE"
    
    print_status "Running comprehensive REST vs gRPC comparison tests..."
    print_status "This will test all CRUD operations and compare responses..."
    echo ""
    
    # Run the Node.js test file
    node tests/test.js
    
    # Capture the exit code
    test_exit_code=$?
    
    echo ""
    if [ $test_exit_code -eq 0 ]; then
        print_success "🎉 All tests passed! REST and gRPC APIs are consistent."
    else
        print_error "❌ Some tests failed. Check the output above for details."
    fi
    
    return $test_exit_code
}

# Generate test report
generate_report() {
    print_header "TEST EXECUTION SUMMARY"
    
    echo "Test Date: $(date)"
    echo "REST API: http://localhost:3000"
    echo "gRPC API: localhost:50051"
    echo ""
    echo "Tests performed:"
    echo "• User Registration & Authentication"
    echo "• Form Creation & Management"
    echo "• Question Creation & Updates"
    echo "• Response Handling"
    echo "• Data Retrieval & Consistency"
    echo "• Error Handling Comparison"
    echo "• Performance Benchmarking"
    echo "• Data Deletion & Cleanup"
    echo ""
    
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ Result: ALL TESTS PASSED${NC}"
        echo "Both APIs provide consistent functionality and responses."
    else
        echo -e "${RED}❌ Result: SOME TESTS FAILED${NC}"
        echo "There are inconsistencies between REST and gRPC implementations."
    fi
}

# Main execution
main() {
    print_header "REST vs gRPC API COMPARISON TESTS"
    echo "This script compares the functionality and responses of:"
    echo "• REST API (port 3000) - Your existing REST project"
    echo "• gRPC API (port 50051) - This gRPC project"
    echo ""
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "tests/test.js" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Install dependencies
    install_dependencies
    
    # Check if servers are running
    if ! check_servers; then
        print_error "Cannot proceed without both servers running"
        echo ""
        echo "To start servers:"
        echo "1. Start REST API in your other project (port 3000)"
        echo "2. Start gRPC API: npm run start (port 50051)"
        exit 1
    fi
    
    # Run tests
    run_tests
    test_result=$?
    
    # Generate report
    generate_report $test_result
    
    # Exit with the same code as the tests
    exit $test_result
}

# Execute main function
main "$@"
