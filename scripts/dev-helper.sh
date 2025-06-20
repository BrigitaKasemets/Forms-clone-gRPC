#!/bin/bash

# Combined API Development and Testing Script
# This script helps manage both REST and gRPC APIs together

echo "🔧 Forms API Development Helper"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
GRPC_PROJECT_DIR="$(pwd)"
REST_PROJECT_DIR="../FormsCloneApi"  # Corrected path to actual REST API project
SHARED_DB_DIR="./shared-data"

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}${BOLD}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

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

# Show usage information
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup       Setup both projects for development"
    echo "  start       Start both API servers"
    echo "  test        Run comparison tests (requires both servers)"
    echo "  test-grpc   Run only gRPC tests"
    echo "  stop        Stop all running servers"
    echo "  clean       Clean both projects"
    echo "  status      Check status of both APIs"
    echo "  logs        Show logs from both servers"
    echo "  db-shared   Setup shared database configuration"
    echo "  help        Show this help message"
    echo ""
    echo "Docker commands:"
    echo "  docker-up      Start services with Docker Compose"
    echo "  docker-down    Stop Docker services"
    echo "  docker-test    Run tests in Docker"
    echo ""
}

# Check if REST project exists
check_rest_project() {
    if [ ! -d "$REST_PROJECT_DIR" ]; then
        print_warning "REST API project not found at: $REST_PROJECT_DIR"
        echo "Please either:"
        echo "1. Clone the REST API project: git clone <rest-api-repo> $REST_PROJECT_DIR"
        echo "2. Update REST_PROJECT_DIR variable in this script"
        return 1
    fi
    return 0
}

# Setup shared database configuration
setup_shared_db() {
    print_header "SETTING UP SHARED DATABASE CONFIGURATION"
    
    # Create shared data directory
    mkdir -p "$SHARED_DB_DIR"
    
    # Create symbolic link for gRPC project
    if [ -f "forms.db" ]; then
        print_status "Moving existing gRPC database to shared location..."
        mv forms.db "$SHARED_DB_DIR/"
    fi
    
    if [ ! -L "forms.db" ]; then
        ln -s "$SHARED_DB_DIR/forms.db" forms.db
        print_success "Created shared database link for gRPC project"
    fi
    
    # Setup REST project database link (if project exists)
    if check_rest_project; then
        cd "$REST_PROJECT_DIR"
        if [ -f "forms.db" ]; then
            print_status "Moving existing REST database to shared location..."
            mv forms.db "$GRPC_PROJECT_DIR/$SHARED_DB_DIR/"
        fi
        
        if [ ! -L "forms.db" ]; then
            ln -s "$GRPC_PROJECT_DIR/$SHARED_DB_DIR/forms.db" forms.db
            print_success "Created shared database link for REST project"
        fi
        cd "$GRPC_PROJECT_DIR"
    fi
    
    print_success "Shared database configuration complete"
}

# Setup both projects
setup_projects() {
    print_header "SETTING UP BOTH PROJECTS"
    
    # Setup gRPC project
    print_status "Setting up gRPC project..."
    npm run setup
    
    # Setup REST project (if exists)
    if check_rest_project; then
        print_status "Setting up REST project..."
        cd "$REST_PROJECT_DIR"
        npm install
        npm run init-db 2>/dev/null || echo "REST project database initialization skipped"
        cd "$GRPC_PROJECT_DIR"
    fi
    
    # Setup shared database
    setup_shared_db
    
    print_success "Both projects setup complete"
}

# Start both servers
start_servers() {
    print_header "STARTING BOTH API SERVERS"
    
    # Check if REST project exists
    if ! check_rest_project; then
        print_warning "Starting only gRPC server (REST project not found)"
        npm run start
        return
    fi
    
    # Start REST API in background
    print_status "Starting REST API server (port 3000)..."
    cd "$REST_PROJECT_DIR"
    npm start &
    REST_PID=$!
    cd "$GRPC_PROJECT_DIR"
    
    # Wait a moment for REST to start
    sleep 3
    
    # Start gRPC API
    print_status "Starting gRPC API server (port 50051)..."
    npm start &
    GRPC_PID=$!
    
    # Save PIDs for later cleanup
    echo "$REST_PID" > .rest_pid
    echo "$GRPC_PID" > .grpc_pid
    
    print_success "Both servers starting..."
    print_status "REST API: http://localhost:3000"
    print_status "gRPC API: localhost:50051"
    
    # Wait for servers to be ready
    print_status "Waiting for servers to be ready..."
    sleep 5
    
    if curl -s -f "http://localhost:3000/health" >/dev/null 2>&1; then
        print_success "REST API is ready"
    else
        print_warning "REST API health check failed"
    fi
    
    if nc -z localhost 50051 2>/dev/null; then
        print_success "gRPC API is ready"
    else
        print_warning "gRPC API connection failed"
    fi
}

# Stop all servers
stop_servers() {
    print_header "STOPPING ALL SERVERS"
    
    # Stop using saved PIDs
    if [ -f ".rest_pid" ]; then
        REST_PID=$(cat .rest_pid)
        print_status "Stopping REST API (PID: $REST_PID)..."
        kill $REST_PID 2>/dev/null || true
        rm .rest_pid
    fi
    
    if [ -f ".grpc_pid" ]; then
        GRPC_PID=$(cat .grpc_pid)
        print_status "Stopping gRPC API (PID: $GRPC_PID)..."
        kill $GRPC_PID 2>/dev/null || true
        rm .grpc_pid
    fi
    
    # Kill any remaining processes
    pkill -f "grpc_server.js" 2>/dev/null || true
    pkill -f "forms-clone" 2>/dev/null || true
    
    print_success "All servers stopped"
}

# Check server status
check_status() {
    print_header "CHECKING SERVER STATUS"
    
    # Check REST API
    print_status "Checking REST API (port 3000)..."
    if curl -s -f "http://localhost:3000/health" >/dev/null 2>&1; then
        print_success "REST API is running and healthy"
    elif curl -s -f "http://localhost:3000" >/dev/null 2>&1; then
        print_warning "REST API is running but no health endpoint"
    else
        print_error "REST API is not accessible"
    fi
    
    # Check gRPC API
    print_status "Checking gRPC API (port 50051)..."
    if nc -z localhost 50051 2>/dev/null; then
        print_success "gRPC API is running"
    else
        print_error "gRPC API is not accessible"
    fi
    
    # Check database
    if [ -f "$SHARED_DB_DIR/forms.db" ]; then
        print_success "Shared database exists"
    elif [ -f "forms.db" ]; then
        print_warning "Local database exists (not shared)"
    else
        print_error "No database found"
    fi
}

# Run tests
run_tests() {
    print_header "RUNNING COMPARISON TESTS"
    check_status
    npm test
}

# Run only gRPC tests
run_grpc_tests() {
    print_header "RUNNING gRPC TESTS ONLY"
    npm run test:grpc-only
}

# Clean both projects
clean_projects() {
    print_header "CLEANING BOTH PROJECTS"
    
    # Stop servers first
    stop_servers
    
    # Clean gRPC project
    print_status "Cleaning gRPC project..."
    npm run clean
    
    # Clean REST project
    if check_rest_project; then
        print_status "Cleaning REST project..."
        cd "$REST_PROJECT_DIR"
        npm run clean 2>/dev/null || (rm -rf node_modules package-lock.json)
        cd "$GRPC_PROJECT_DIR"
    fi
    
    # Clean shared data
    rm -rf "$SHARED_DB_DIR"
    rm -f .rest_pid .grpc_pid
    
    print_success "Cleanup complete"
}

# Docker commands
docker_up() {
    print_header "STARTING DOCKER SERVICES"
    docker-compose up -d
    print_success "Docker services started"
}

docker_down() {
    print_header "STOPPING DOCKER SERVICES"
    docker-compose down
    print_success "Docker services stopped"
}

docker_test() {
    print_header "RUNNING TESTS IN DOCKER"
    docker-compose --profile testing up --build test-runner
}

# Show logs
show_logs() {
    print_header "SHOWING SERVER LOGS"
    
    echo "gRPC Server logs:"
    echo "=================="
    if [ -f "logs/server.log" ]; then
        tail -20 logs/server.log
    else
        echo "No gRPC logs found"
    fi
    
    echo ""
    echo "Test logs:"
    echo "=========="
    if [ -f "tests/test-results.log" ]; then
        tail -20 tests/test-results.log
    else
        echo "No test logs found"
    fi
}

# Main command handling
case "$1" in
    setup)
        setup_projects
        ;;
    start)
        start_servers
        ;;
    test)
        run_tests
        ;;
    test-grpc)
        run_grpc_tests
        ;;
    stop)
        stop_servers
        ;;
    clean)
        clean_projects
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs
        ;;
    db-shared)
        setup_shared_db
        ;;
    docker-up)
        docker_up
        ;;
    docker-down)
        docker_down
        ;;
    docker-test)
        docker_test
        ;;
    help|--help|-h)
        show_usage
        ;;
    "")
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac
