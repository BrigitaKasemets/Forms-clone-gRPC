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
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test configuration
TEST_START_TIME=$(date +%s)
LOG_FILE="tests/test-results.log"
REST_URL="http://localhost:3000"
GRPC_HOST="localhost"
GRPC_PORT="50051"

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
    echo "=== REST vs gRPC COMPARISON TEST RUN STARTED AT $(date) ===" > "$LOG_FILE"
    echo "REST API: $REST_URL" >> "$LOG_FILE"
    echo "gRPC API: $GRPC_HOST:$GRPC_PORT" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
}

# Check if both APIs are accessible
test_api_connectivity() {
    print_status "Testing API connectivity..."
    
    local rest_ok=false
    local grpc_ok=false
    
    # Test REST API with health check
    if curl -s -f "$REST_URL/health" >/dev/null 2>&1; then
        rest_ok=true
        print_success "REST API health check passed"
    else
        # Try basic connection
        if curl -s -f "$REST_URL" >/dev/null 2>&1; then
            rest_ok=true
            print_success "REST API is accessible"
        else
            print_error "REST API connection failed"
        fi
    fi
    
    # Test gRPC API
    if nc -z "$GRPC_HOST" "$GRPC_PORT" 2>/dev/null; then
        grpc_ok=true
        print_success "gRPC API is accessible"
    else
        print_error "gRPC API connection failed"
    fi
    
    if [ "$rest_ok" = true ] && [ "$grpc_ok" = true ]; then
        return 0
    else
        return 1
    fi
}

# Check if required servers are running
check_servers() {
    print_header "CHECKING SERVER AVAILABILITY"
    
    # Test connectivity first
    if ! test_api_connectivity; then
        print_error "One or more APIs are not accessible"
        echo ""
        echo "Required servers:"
        echo "1. REST API on $REST_URL"
        echo "   - Start your REST API project (separate repository)"
        echo "   - Default port: 3000"
        echo ""
        echo "2. gRPC API on $GRPC_HOST:$GRPC_PORT"
        echo "   - Start with: npm run start"
        echo "   - Or use: npm run dev (for development)"
        return 1
    fi
    
    return 0
}

# Install dependencies if needed
install_dependencies() {
    print_header "CHECKING DEPENDENCIES"
    
    print_status "Verifying Node.js dependencies..."
    
    # Check if node modules exist
    if [ ! -d "node_modules" ]; then
        print_warning "Node modules not found. Installing dependencies..."
        npm install
        if [ $? -ne 0 ]; then
            print_error "Failed to install dependencies"
            return 1
        fi
    fi
    
    # Check if node-fetch is available (needed for REST API calls)
    if ! npm list node-fetch >/dev/null 2>&1; then
        print_status "Installing node-fetch for REST API calls..."
        npm install node-fetch
        if [ $? -ne 0 ]; then
            print_error "Failed to install node-fetch"
            return 1
        fi
    fi
    
    # Check if database exists
    if [ ! -f "forms.db" ]; then
        print_warning "Database not found. Initializing..."
        npm run init-db
        if [ $? -ne 0 ]; then
            print_error "Failed to initialize database"
            return 1
        fi
    fi
    
    print_success "All dependencies and database are ready"
    return 0
}

# Run the main test suite
run_tests() {
    print_header "EXECUTING COMPARISON TEST SUITE"
    
    print_status "Running comprehensive REST vs gRPC comparison tests..."
    echo ""
    echo "Test Categories:"
    echo "• Authentication & User Management"
    echo "• Form CRUD Operations"
    echo "• Question Management"
    echo "• Response Handling"
    echo "• Data Consistency Verification"
    echo "• Error Handling Comparison"
    echo "• Performance Benchmarking"
    echo "• Cleanup Operations"
    echo ""
    
    print_status "Starting test execution..."
    echo "This may take several minutes depending on network latency..."
    echo ""
    
    # Run the Node.js test file with output capture
    node tests/test.js 2>&1 | tee -a "$LOG_FILE"
    
    # Capture the exit code
    local test_exit_code=${PIPESTATUS[0]}
    
    echo ""
    if [ $test_exit_code -eq 0 ]; then
        print_success "All comparison tests passed! REST and gRPC APIs are consistent."
    else
        print_error "❌ Some comparison tests failed (exit code: $test_exit_code)"
        print_warning "Check the detailed output above for specific failures"
    fi
    
    return $test_exit_code
}

# Generate test report
generate_report() {
    local test_result=$1
    local end_time=$(date +%s)
    local duration=$((end_time - TEST_START_TIME))
    
    print_header "TEST EXECUTION SUMMARY"
    
    echo "Test Date: $(date)"
    echo "Duration: ${duration} seconds"
    echo "REST API: $REST_URL"
    echo "gRPC API: $GRPC_HOST:$GRPC_PORT"
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
    
    if [ $test_result -eq 0 ]; then
        echo -e "${GREEN}${BOLD}RESULT: ALL TESTS PASSED${NC}"
        echo "Both APIs provide consistent functionality and responses."
        echo "The REST and gRPC implementations are equivalent."
    else
        echo -e "${RED}${BOLD}❌ RESULT: SOME TESTS FAILED${NC}"
        echo "There are inconsistencies between REST and gRPC implementations."
        echo "Review the detailed logs for specific issues."
    fi
    
    echo ""
    echo "Detailed logs: $LOG_FILE"
    echo "To view logs: cat $LOG_FILE"
    echo "To search logs: grep 'FAIL\\|ERROR' $LOG_FILE"
    
    # Write summary to log
    echo "" >> "$LOG_FILE"
    echo "=== FINAL TEST SUMMARY ===" >> "$LOG_FILE"
    echo "Total Duration: ${duration} seconds" >> "$LOG_FILE"
    echo "Final Result: $([ $test_result -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED")" >> "$LOG_FILE"
    echo "Test completed at: $(date)" >> "$LOG_FILE"
    echo "=== END OF COMPARISON TEST RUN ===" >> "$LOG_FILE"
}

# Main execution
main() {
    print_header "REST vs gRPC API COMPARISON TESTS"
    echo "This script compares the functionality and responses of:"
    echo "• REST API ($REST_URL) - Your existing REST project"
    echo "• gRPC API ($GRPC_HOST:$GRPC_PORT) - This gRPC project"
    echo ""
    echo "Both APIs will be tested with identical operations to verify:"
    echo "✓ Functional equivalence"
    echo "✓ Data consistency"
    echo "✓ Error handling"
    echo "✓ Performance characteristics"
    echo ""
    
    # Initialize logging
    init_log
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "tests/test.js" ]; then
        print_error "Please run this script from the project root directory"
        print_error "Required files: package.json, tests/test.js"
        exit 1
    fi
    
    # Install dependencies and setup
    if ! install_dependencies; then
        print_error "Dependency installation failed"
        exit 1
    fi
    
    # Check if servers are running
    if ! check_servers; then
        print_error "Cannot proceed without both servers running"
        echo ""
        echo "Setup instructions:"
        echo "1. Start REST API in your separate project on port 3000"
        echo "2. Start gRPC API with: npm run start (port 50051)"
        echo ""
        echo "Quick start commands:"
        echo "  npm run start    # Start gRPC server"
        echo "  npm run dev      # Start gRPC server in dev mode"
        exit 1
    fi
    
    # Run tests
    print_status "All prerequisites met. Starting comparison tests..."
    run_tests
    test_result=$?
    
    # Generate report
    generate_report $test_result
    
    # Exit with the same code as the tests
    exit $test_result
}

# Execute main function
main "$@"
