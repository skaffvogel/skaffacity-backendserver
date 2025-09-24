/**
 * Command Handler voor Pterodactyl Console Commands
 * Verwerkt commands die via de Pterodactyl terminal worden uitgevoerd
 */

const fs = require('fs');
const path = require('path');

class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.loadCommands();
        this.setupStdinListener();
    }

    /**
     * Laad alle command bestanden uit de commands directory
     */
    loadCommands() {
        const commandsDir = path.join(__dirname, './');
        const commandFiles = fs.readdirSync(commandsDir)
            .filter(file => file.endsWith('.js') && file !== 'handler.js');

        console.log('[COMMANDS] Loading command files...');
        for (const file of commandFiles) {
            try {
                const commandName = file.replace('.js', '');
                const CommandClass = require(path.join(commandsDir, file));
                const command = new CommandClass();
                
                this.commands.set(commandName, command);
                console.log(`[COMMANDS] ✅ Loaded command: ${commandName}`);
            } catch (error) {
                console.error(`[COMMANDS] ❌ Failed to load ${file}:`, error.message);
            }
        }
        
        console.log(`[COMMANDS] Loaded ${this.commands.size} commands`);
        this.showAvailableCommands();
    }

    /**
     * Setup stdin listener voor Pterodactyl console input
     */
    setupStdinListener() {
        if (process.stdin.isTTY) {
            console.log('[COMMANDS] Interactive mode detected - commands available');
            process.stdin.setEncoding('utf8');
            
            process.stdin.on('data', (input) => {
                const command = input.toString().trim();
                if (command) {
                    this.executeCommand(command);
                }
            });
        }

        // Also listen for Pterodactyl-style command input
        process.on('message', (message) => {
            if (message && message.type === 'command') {
                this.executeCommand(message.data);
            }
        });
    }

    /**
     * Voer een command uit
     */
    async executeCommand(input) {
        const parts = input.split(' ');
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        console.log(`[COMMAND] Executing: ${commandName} ${args.join(' ')}`);

        // Built-in commands
        if (commandName === 'help' || commandName === 'commands') {
            this.showAvailableCommands();
            return;
        }

        if (commandName === 'reload') {
            this.commands.clear();
            this.loadCommands();
            console.log('[COMMANDS] ✅ Commands reloaded');
            return;
        }

        // External commands
        const command = this.commands.get(commandName);
        if (command) {
            try {
                await command.execute(args);
            } catch (error) {
                console.error(`[COMMAND] ❌ Error executing ${commandName}:`, error.message);
            }
        } else {
            console.log(`[COMMAND] ❌ Unknown command: ${commandName}`);
            console.log(`[COMMAND] Type 'help' to see available commands`);
        }
    }

    /**
     * Toon beschikbare commands
     */
    showAvailableCommands() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                    Available Commands                    ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  help, commands    - Show this help menu                ║');
        console.log('║  reload           - Reload all commands                 ║');
        
        for (const [name, command] of this.commands) {
            const description = command.description || 'No description available';
            const usage = command.usage || name;
            console.log(`║  ${usage.padEnd(16)} - ${description.padEnd(30)} ║`);
        }
        
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }
}

// Export singleton instance
module.exports = new CommandHandler();