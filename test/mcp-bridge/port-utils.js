/**
 * Port Utility Functions for MCP Testing
 * Handles port availability checking and management
 */

const net = require('net');
const { execSync } = require('child_process');

/**
 * Check if a port is available for use
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available
 */
async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const tester = net.createServer()
            .once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(false);
                } else {
                    resolve(false);
                }
            })
            .once('listening', () => {
                tester.once('close', () => resolve(true)).close();
            })
            .listen(port, '127.0.0.1');
    });
}

/**
 * Find an available port starting from a base port
 * @param {number} startPort - Starting port number
 * @param {number} maxAttempts - Maximum number of ports to try
 * @returns {Promise<number>} - Available port number
 */
async function findAvailablePort(startPort = 9222, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error(`No available ports found between ${startPort} and ${startPort + maxAttempts - 1}`);
}

/**
 * Kill process using a specific port (Windows/Linux compatible)
 * @param {number} port - Port number
 */
function killProcessOnPort(port) {
    try {
        if (process.platform === 'win32') {
            // Windows: Find and kill process
            try {
                const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
                const lines = result.split('\n').filter(line => line.includes('LISTENING'));
                
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && !isNaN(pid)) {
                        console.log(`Killing process ${pid} on port ${port}`);
                        try {
                            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                        } catch (e) {
                            console.warn(`Failed to kill process ${pid}`);
                        }
                    }
                }
            } catch (e) {
                // No process found on port
            }
        } else {
            // Linux/Mac: Find and kill process
            try {
                const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
                const pids = result.split('\n').filter(pid => pid);
                
                for (const pid of pids) {
                    console.log(`Killing process ${pid} on port ${port}`);
                    try {
                        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                    } catch (e) {
                        console.warn(`Failed to kill process ${pid}`);
                    }
                }
            } catch (e) {
                // No process found on port
            }
        }
    } catch (error) {
        console.warn(`Error killing process on port ${port}:`, error.message);
    }
}

/**
 * Wait for a port to become available
 * @param {number} port - Port number to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<void>}
 */
async function waitForPortAvailable(port, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (await isPortAvailable(port)) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Timeout waiting for port ${port} to become available`);
}

/**
 * Check if a debug port is responding
 * @param {number} port - Port number
 * @returns {Promise<boolean>} - True if port is responding
 */
async function isDebugPortResponding(port) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        
        const cleanup = () => {
            client.destroy();
        };
        
        client.setTimeout(1000);
        
        client.once('connect', () => {
            cleanup();
            resolve(true);
        });
        
        client.once('error', () => {
            cleanup();
            resolve(false);
        });
        
        client.once('timeout', () => {
            cleanup();
            resolve(false);
        });
        
        client.connect(port, '127.0.0.1');
    });
}

module.exports = {
    isPortAvailable,
    findAvailablePort,
    killProcessOnPort,
    waitForPortAvailable,
    isDebugPortResponding
};