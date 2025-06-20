#!/bin/bash

# Status Script for Forms Clone Project
# Shows status of all running gRPC and REST servers

echo "📊 Forms Clone Project - Service Status"

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

print_header "SERVICE STATUS CHECK"

# Function to check if a process is running by name
check_process() {
    local process_name=$1
    local display_name=$2
    local pids=$(pgrep -f "$process_name" 2>/dev/null)
    
    if [ ! -z "$pids" ]; then
        echo -e "${GREEN}✅ $display_name: RUNNING${NC}"
        for pid in $pids; do
            local start_time=$(ps -o lstart= -p $pid 2>/dev/null | xargs)
            local memory=$(ps -o rss= -p $pid 2>/dev/null | xargs)
            if [ ! -z "$memory" ]; then
                memory=$((memory / 1024)) # Convert KB to MB
                echo -e "   ${BLUE}PID:${NC} $pid ${BLUE}| Started:${NC} $start_time ${BLUE}| Memory:${NC} ${memory}MB"
            fi
        done
        return 0
    else
        echo -e "${RED}❌ $display_name: NOT RUNNING${NC}"
        return 1
    fi
}

# Function to check if a port is in use
check_port() {
    local port=$1
    local service_name=$2
    local process_info=$(lsof -i:$port 2>/dev/null)
    
    if [ ! -z "$process_info" ]; then
        echo -e "${GREEN}✅ Port $port ($service_name): IN USE${NC}"
        echo "$process_info" | tail -n +2 | while read line; do
            echo -e "   ${BLUE}$line${NC}"
        done
        return 0
    else
        echo -e "${RED}❌ Port $port ($service_name): FREE${NC}"
        return 1
    fi
}

# Function to check log files
check_logs() {
    local log_file=$1
    local service_name=$2
    
    if [ -f "$log_file" ]; then
        local log_size=$(stat -f%z "$log_file" 2>/dev/null || echo "0")
        local log_modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$log_file" 2>/dev/null || echo "Unknown")
        local log_lines=$(wc -l < "$log_file" 2>/dev/null || echo "0")
        
        echo -e "${BLUE}📄 $service_name Log:${NC} $log_file"
        echo -e "   ${BLUE}Size:${NC} $log_size bytes ${BLUE}| Lines:${NC} $log_lines ${BLUE}| Modified:${NC} $log_modified"
        
        # Show last few lines if file exists and has content
        if [ -s "$log_file" ]; then
            echo -e "   ${BLUE}Last 3 lines:${NC}"
            tail -n 3 "$log_file" 2>/dev/null | sed 's/^/     /'
        fi
    else
        echo -e "${YELLOW}📄 $service_name Log:${NC} Not found ($log_file)"
    fi
}

# Check database status
check_database() {
    local db_file="forms.db"
    if [ -f "$db_file" ]; then
        local db_size=$(stat -f%z "$db_file" 2>/dev/null || echo "0")
        local db_modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$db_file" 2>/dev/null || echo "Unknown")
        echo -e "${GREEN}✅ Database:${NC} $db_file"
        echo -e "   ${BLUE}Size:${NC} $db_size bytes ${BLUE}| Modified:${NC} $db_modified"
    else
        echo -e "${RED}❌ Database:${NC} Not found ($db_file)"
    fi
}

# Check gRPC server
echo -e "${CYAN}🔧 gRPC Server Status:${NC}"
check_process "grpc_server.js" "gRPC Server Process"
check_port "50051" "gRPC Server"
echo ""

# Check REST API server
echo -e "${CYAN}🌐 REST API Server Status:${NC}"
check_process "formsClone.js" "REST API Server Process"
check_port "3000" "REST API Server"
echo ""

# Check other related processes
echo -e "${CYAN}🔍 Other Project Processes:${NC}"
check_process "nodemon" "Nodemon"
echo ""

# Check database
echo -e "${CYAN}🗄️ Database Status:${NC}"
check_database
echo ""

# Check log files
echo -e "${CYAN}📋 Log Files:${NC}"
check_logs "logs/grpc-server.log" "gRPC Server"
check_logs "logs/rest-server.log" "REST API Server"
echo ""

# Summary
print_header "SUMMARY"

grpc_running=$(pgrep -f "grpc_server.js" 2>/dev/null)
rest_running=$(pgrep -f "formsClone.js" 2>/dev/null)
grpc_port=$(lsof -ti:50051 2>/dev/null)
rest_port=$(lsof -ti:3000 2>/dev/null)

if [ ! -z "$grpc_running" ] && [ ! -z "$grpc_port" ]; then
    echo -e "${GREEN}✅ gRPC Server: OPERATIONAL${NC}"
else
    echo -e "${RED}❌ gRPC Server: NOT OPERATIONAL${NC}"
fi

if [ ! -z "$rest_running" ] && [ ! -z "$rest_port" ]; then
    echo -e "${GREEN}✅ REST API Server: OPERATIONAL${NC}"
else
    echo -e "${RED}❌ REST API Server: NOT OPERATIONAL${NC}"
fi

echo ""
echo -e "${BLUE}💡 Available commands:${NC}"
echo "   npm run quick-start  - Start both servers"
echo "   npm start           - Start gRPC server only"
echo "   npm run             - Start gRPC server only"
echo "   npm stop            - Stop all servers"
echo "   npm run status      - Show this status"
echo ""

# Exit with appropriate code
if [ ! -z "$grpc_running" ] || [ ! -z "$rest_running" ]; then
    exit 0  # At least one server is running
else
    exit 1  # No servers running
fi
