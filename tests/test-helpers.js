/**
 * Test Helper Functions for gRPC Forms API Testing
 * Provides utilities for better test organization and reporting
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Color codes for console output
export const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: '\x1b[1m',
  dim: '\x1b[2m'
};

// Test configuration
export const config = {
  REST_BASE_URL: process.env.REST_BASE_URL || 'http://localhost:3000',
  GRPC_HOST: process.env.GRPC_HOST || 'localhost',
  GRPC_PORT: process.env.GRPC_PORT || '50051',
  LOG_FILE: join(__dirname, 'detailed-test-results.log'),
  TIMEOUT: parseInt(process.env.TEST_TIMEOUT) || 30000,
  
  // Test data
  TEST_EMAIL: 'testuser@example.com',
  TEST_PASSWORD: 'TestPassword123!',
  TEST_NAME: 'Test User',
  
  // Test form data
  TEST_FORM: {
    title: 'Test Form - API Comparison',
    description: 'This form is used for testing REST vs gRPC API consistency'
  },
  
  // Test question data
  TEST_QUESTIONS: [
    {
      text: 'What is your favorite programming language?',
      type: 'TEXT',
      required: true
    },
    {
      text: 'Rate your experience with gRPC (1-5)',
      type: 'NUMBER',
      required: false
    }
  ]
};

// Test state tracker
export class TestState {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.restToken = null;
    this.grpcToken = null;
    this.formId = null;
    this.grpcFormId = null;
    this.questionIds = [];
    this.grpcQuestionIds = [];
    this.responseId = null;
    this.grpcResponseId = null;
    this.userId = null;
    this.grpcUserId = null;
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests = 0;
    this.startTime = Date.now();
  }
  
  recordPass(message) {
    this.totalTests++;
    this.testsPassed++;
    logSuccess(message);
  }
  
  recordFail(message) {
    this.totalTests++;
    this.testsFailed++;
    logFailure(message);
  }
  
  getStats() {
    const duration = Date.now() - this.startTime;
    return {
      total: this.totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      duration: Math.round(duration / 1000),
      successRate: this.totalTests > 0 ? Math.round((this.testsPassed / this.totalTests) * 100) : 0
    };
  }
}

// Logging functions
let logStream = null;

export function initializeLogging() {
  // Create tests directory if it doesn't exist
  const testsDir = dirname(config.LOG_FILE);
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  
  // Initialize log file
  const timestamp = new Date().toISOString();
  const header = `=== DETAILED TEST RUN STARTED AT ${timestamp} ===\n` +
                `REST API: ${config.REST_BASE_URL}\n` +
                `gRPC API: ${config.GRPC_HOST}:${config.GRPC_PORT}\n` +
                `Timeout: ${config.TIMEOUT}ms\n\n`;
  
  fs.writeFileSync(config.LOG_FILE, header);
  logStream = fs.createWriteStream(config.LOG_FILE, { flags: 'a' });
}

export function closeLogging() {
  if (logStream) {
    logStream.end();
  }
}

function writeToLog(level, message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  
  if (logStream) {
    logStream.write(logLine);
  }
}

// Console output functions
export function colorLog(color, message) {
  console.log(`${color}${message}${colors.reset}`);
  writeToLog('INFO', message);
}

export function logHeader(title) {
  const separator = '='.repeat(60);
  console.log('\n' + separator);
  colorLog(colors.cyan + colors.bright, title);
  console.log(separator);
  writeToLog('HEADER', title);
}

export function logSubHeader(title) {
  console.log('\n' + '-'.repeat(40));
  colorLog(colors.blue + colors.bright, title);
  console.log('-'.repeat(40));
  writeToLog('SUBHEADER', title);
}

export function logTest(description) {
  colorLog(colors.blue, `[TEST] ${description}`);
  writeToLog('TEST', description);
}

export function logSuccess(message) {
  colorLog(colors.green, `[PASS] ✓ ${message}`);
  writeToLog('PASS', message);
}

export function logFailure(message) {
  colorLog(colors.red, `[FAIL] ✗ ${message}`);
  writeToLog('FAIL', message);
}

export function logWarning(message) {
  colorLog(colors.yellow, `[WARN] ⚠ ${message}`);
  writeToLog('WARN', message);
}

export function logInfo(message) {
  colorLog(colors.cyan, `[INFO] ℹ ${message}`);
  writeToLog('INFO', message);
}

export function logDebug(message) {
  if (process.env.DEBUG_TESTS) {
    colorLog(colors.dim, `[DEBUG] ${message}`);
    writeToLog('DEBUG', message);
  }
}

// Test execution helpers
export function executeWithTimeout(asyncFunction, timeout = config.TIMEOUT) {
  return Promise.race([
    asyncFunction(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
    )
  ]);
}

export function compareObjects(obj1, obj2, path = '') {
  const differences = [];
  
  // Get all unique keys
  const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
  
  for (const key of keys) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (!(key in obj1)) {
      differences.push(`Missing key in first object: ${currentPath}`);
    } else if (!(key in obj2)) {
      differences.push(`Missing key in second object: ${currentPath}`);
    } else if (typeof obj1[key] !== typeof obj2[key]) {
      differences.push(`Type mismatch at ${currentPath}: ${typeof obj1[key]} vs ${typeof obj2[key]}`);
    } else if (typeof obj1[key] === 'object' && obj1[key] !== null && obj2[key] !== null) {
      differences.push(...compareObjects(obj1[key], obj2[key], currentPath));
    } else if (obj1[key] !== obj2[key]) {
      differences.push(`Value mismatch at ${currentPath}: ${obj1[key]} vs ${obj2[key]}`);
    }
  }
  
  return differences;
}

export function sanitizeForComparison(obj) {
  if (!obj) return obj;
  
  const sanitized = { ...obj };
  
  // Remove timestamp fields that might differ
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  delete sanitized.created_at;
  delete sanitized.updated_at;
  
  // Remove potential ID differences (if using different ID generation)
  if (sanitized.id && typeof sanitized.id === 'string' && sanitized.id.length > 10) {
    delete sanitized.id;
  }
  
  return sanitized;
}

// Performance measurement
export class PerformanceTracker {
  constructor() {
    this.measurements = {};
  }
  
  start(operation) {
    this.measurements[operation] = {
      startTime: process.hrtime.bigint(),
      endTime: null,
      duration: null
    };
  }
  
  end(operation) {
    if (this.measurements[operation]) {
      this.measurements[operation].endTime = process.hrtime.bigint();
      this.measurements[operation].duration = 
        Number(this.measurements[operation].endTime - this.measurements[operation].startTime) / 1000000; // Convert to ms
    }
  }
  
  getDuration(operation) {
    return this.measurements[operation]?.duration || 0;
  }
  
  getReport() {
    const report = {};
    for (const [operation, data] of Object.entries(this.measurements)) {
      if (data.duration !== null) {
        report[operation] = `${data.duration.toFixed(2)}ms`;
      }
    }
    return report;
  }
  
  logSummary() {
    logSubHeader('PERFORMANCE SUMMARY');
    for (const [operation, data] of Object.entries(this.measurements)) {
      if (data.duration !== null) {
        logInfo(`${operation}: ${data.duration.toFixed(2)}ms`);
      }
    }
  }
}

// Error handling helpers
export function formatError(error) {
  if (error.response) {
    return `HTTP ${error.response.status}: ${error.response.statusText}`;
  } else if (error.code) {
    return `gRPC ${error.code}: ${error.details || error.message}`;
  } else {
    return error.message || 'Unknown error';
  }
}

export function isNetworkError(error) {
  return error.code === 'ECONNREFUSED' || 
         error.code === 'ENOTFOUND' || 
         error.message?.includes('fetch failed') ||
         error.message?.includes('UNAVAILABLE');
}

// Final test summary
export function generateFinalSummary(testState) {
  const stats = testState.getStats();
  
  logHeader('FINAL TEST EXECUTION SUMMARY');
  
  console.log(`📊 Test Statistics:`);
  console.log(`   Total Tests: ${stats.total}`);
  console.log(`   Passed: ${colors.green}${stats.passed}${colors.reset}`);
  console.log(`   Failed: ${colors.red}${stats.failed}${colors.reset}`);
  console.log(`   Success Rate: ${stats.successRate}%`);
  console.log(`   Duration: ${stats.duration}s`);
  console.log('');
  
  if (stats.failed === 0) {
    colorLog(colors.green + colors.bright, '🎉 ALL TESTS PASSED! APIs are consistent.');
  } else {
    colorLog(colors.red + colors.bright, `❌ ${stats.failed} test(s) failed. Check logs for details.`);
  }
  
  console.log(`📝 Detailed logs: ${config.LOG_FILE}`);
  
  // Write final summary to log
  writeToLog('SUMMARY', `Total: ${stats.total}, Passed: ${stats.passed}, Failed: ${stats.failed}, Duration: ${stats.duration}s`);
  
  return stats.failed === 0;
}
