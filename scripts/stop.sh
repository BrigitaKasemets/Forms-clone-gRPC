#!/bin/bash

# Stop Script for Forms Clone Project
# Stops all running gRPC and REST servers

echo "🛑 Stopping Forms Clone Project Services..."

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

print_header "STOPPING ALL SERVICES"

# Function to stop processes by name
stop_process() {
    local process_name=$1
    local display_name=$2
    local pids=$(pgrep -f "$process_name" 2>/dev/null)
    
    if [ ! -z "$pids" ]; then
        print_status "Stopping $display_name..."
        for pid in $pids; do
            print_status "Stopping process $pid"
            kill $pid 2>/dev/null
        done
        
        # Wait a moment and check if processes are still running
        sleep 2
        local remaining_pids=$(pgrep -f "$process_name" 2>/dev/null)
        
        if [ ! -z "$remaining_pids" ]; then
            print_warning "Some processes didn't stop gracefully, forcing kill..."
            for pid in $remaining_pids; do
                print_status "Force killing process $pid"
                kill -9 $pid 2>/dev/null
            done
            sleep 1
        fi
        
        # Final check
        local final_pids=$(pgrep -f "$process_name" 2>/dev/null)
        if [ -z "$final_pids" ]; then
            print_success "$display_name stopped successfully"
        else
            print_error "Failed to stop some $display_name processes"
        fi
    else
        print_status "No $display_name processes found"
    fi
}

# Function to stop processes by port
stop_port() {
    local port=$1
    local service_name=$2
    
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        print_status "Stopping service on port $port ($service_name)..."
        kill $pid 2>/dev/null
        sleep 2
        
        # Check if still running
        local remaining_pid=$(lsof -ti:$port 2>/dev/null)
        if [ ! -z "$remaining_pid" ]; then
            print_warning "Process on port $port didn't stop gracefully, forcing kill..."
            kill -9 $remaining_pid 2>/dev/null
            sleep 1
        fi
        
        # Final check
        local final_pid=$(lsof -ti:$port 2>/dev/null)
        if [ -z "$final_pid" ]; then
            print_success "$service_name on port $port stopped successfully"
        else
            print_error "Failed to stop $service_name on port $port"
        fi
    else
        print_status "No service found on port $port ($service_name)"
    fi
}

# Stop gRPC server
print_status "Checking for gRPC server processes..."
stop_process "grpc_server.js" "gRPC Server"
stop_port "50051" "gRPC Server"

# Stop REST API server
print_status "Checking for REST API server processes..."
stop_process "formsClone.js" "REST API Server"
stop_port "3000" "REST API Server"

# Stop any other Node.js processes related to this project
print_status "Checking for other project-related Node.js processes..."
stop_process "node.*forms" "Forms-related Node.js processes"

# Stop nodemon processes if any
print_status "Checking for nodemon processes..."
stop_process "nodemon" "Nodemon processes"

print_header "CLEANUP COMPLETED"

echo -e "${GREEN}✅ All services have been stopped${NC}"
echo ""
echo -e "${BLUE}💡 Services that were stopped:${NC}"
echo "   - gRPC Server (port 50051)"
echo "   - REST API Server (port 3000)"
echo "   - Any related Node.js processes"
echo "   - Any nodemon processes"
echo ""
echo -e "${CYAN}📋 To start services again:${NC}"
echo "   npm run quick-start  - Start both servers"
echo "   npm start           - Start gRPC server only"
echo "   npm run             - Start gRPC server only"
echo ""
