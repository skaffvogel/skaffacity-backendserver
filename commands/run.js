/**
 * Run Command - Execute shell commands
 * Allows running shell commands like npm install, git commands, etc.
 */

const { spawn, exec } = require('child_process');
const path = require('path');

class RunCommand {
    constructor() {
        this.name = 'run';
        this.description = 'Execute shell commands';
    }

    async execute(args) {
        if (!args || args.length === 0) {
            this.showHelp();
            return;
        }

        const command = args.join(' ');
        
        console.log(`[RUN] 🚀 Executing: ${command}`);
        console.log('[RUN] ──────────────────────────────────────────');
        
        try {
            await this.executeCommand(command);
        } catch (error) {
            console.error(`[RUN] ❌ Command failed: ${error.message}`);
        }
    }

    executeCommand(command) {
        return new Promise((resolve, reject) => {
            // Set working directory to the src directory where package.json is located
            const workingDir = path.resolve(__dirname, '../');
            console.log(`[RUN] 📁 Working directory: ${workingDir}`);
            
            const childProcess = exec(command, {
                cwd: workingDir,
                env: { ...process.env },
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                shell: true // Ensure proper shell execution
            });

            childProcess.stdout.on('data', (data) => {
                process.stdout.write(data);
            });

            childProcess.stderr.on('data', (data) => {
                process.stderr.write(data);
            });

            childProcess.on('close', (code) => {
                console.log('[RUN] ──────────────────────────────────────────');
                if (code === 0) {
                    console.log(`[RUN] ✅ Command completed successfully (exit code: ${code})`);
                    resolve();
                } else {
                    console.log(`[RUN] ❌ Command failed with exit code: ${code}`);
                    reject(new Error(`Command failed with exit code ${code}`));
                }
            });

            childProcess.on('error', (error) => {
                console.log('[RUN] ──────────────────────────────────────────');
                console.error(`[RUN] ❌ Process error: ${error.message}`);
                reject(error);
            });
        });
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                      Run Command                         ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  Execute shell commands from the SkaffaCity backend     ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  Usage:                                                  ║');
        console.log('║    run <command>                                         ║');
        console.log('║                                                          ║');
        console.log('║  Examples:                                               ║');
        console.log('║    run npm install axios                                 ║');
        console.log('║    run npm list                                          ║');
        console.log('║    run git status                                        ║');
        console.log('║    run node --version                                    ║');
        console.log('║    run dir (Windows) / run ls (Linux/Mac)               ║');
        console.log('║    run powershell Get-Date (Windows PowerShell)         ║');
        console.log('║                                                          ║');
        console.log('║  Note:                                                   ║');
        console.log('║    - Commands are executed in the backend directory     ║');
        console.log('║    - Use with caution - direct system access           ║');
        console.log('║    - Output is streamed in real-time                   ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }
}

module.exports = RunCommand;