/**
 * Quick Reference Command
 * Provides quick access to common server operations
 */

class QuickCommand {
    constructor() {
        this.description = 'Quick reference for common operations';
        this.usage = 'quick <setup|status|troubleshoot>';
    }

    async execute(args) {
        const action = args[0];

        switch (action) {
            case 'setup':
                await this.showSetupGuide();
                break;
            case 'status':
                await this.showQuickStatus();
                break;
            case 'troubleshoot':
            case 'help':
                await this.showTroubleshooting();
                break;
            default:
                this.showHelp();
                break;
        }
    }

    async showSetupGuide() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                    Quick Setup Guide                     ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║                                                          ║');
        console.log('║  🚀 First Time Setup:                                   ║');
        console.log('║    1. ssl generate          - Create SSL certificates   ║');
        console.log('║    2. database migrate      - Setup database tables     ║');
        console.log('║    3. config set server.enableHTTPS true               ║');
        console.log('║    4. system restart        - Apply HTTPS settings      ║');
        console.log('║                                                          ║');
        console.log('║  🎮 Game Server Setup:                                  ║');
        console.log('║    1. config set gameServer.pterodactyl.enabled true    ║');
        console.log('║    2. config set gameServer.pterodactyl.apiUrl <url>    ║');
        console.log('║    3. config set gameServer.pterodactyl.apiKey <key>    ║');
        console.log('║    4. gameserver list       - Test Pterodactyl conn     ║');
        console.log('║                                                          ║');
        console.log('║  📊 Monitoring:                                         ║');
        console.log('║    - logs view              - Check recent activity     ║');
        console.log('║    - system health          - Health check              ║');
        console.log('║    - database status        - Database connection       ║');
        console.log('║                                                          ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    async showQuickStatus() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                     Quick Status                         ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║                                                          ║');
        console.log('║  💡 Use these commands for quick status checks:         ║');
        console.log('║                                                          ║');
        console.log('║    system health            - Overall server health     ║');
        console.log('║    ssl status               - SSL certificate status    ║');
        console.log('║    database status          - Database connection       ║');
        console.log('║    gameserver status        - Game server overview      ║');
        console.log('║    config show              - Current configuration     ║');
        console.log('║    logs view 20             - Last 20 log entries       ║');
        console.log('║                                                          ║');
        console.log('║  🔧 For detailed info, use the full commands above      ║');
        console.log('║                                                          ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    async showTroubleshooting() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                    Troubleshooting                       ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║                                                          ║');
        console.log('║  🚨 Common Issues & Solutions:                          ║');
        console.log('║                                                          ║');
        console.log('║  ❌ "Cannot find module axios":                         ║');
        console.log('║     → npm install (in Pterodactyl file manager)        ║');
        console.log('║                                                          ║');
        console.log('║  ❌ SSL Certificate errors:                             ║');
        console.log('║     → ssl generate                                      ║');
        console.log('║     → ssl status (check certificate files)             ║');
        console.log('║                                                          ║');
        console.log('║  ❌ Database connection failed:                         ║');
        console.log('║     → database test                                     ║');
        console.log('║     → config show (verify DB settings)                 ║');
        console.log('║                                                          ║');
        console.log('║  ❌ Game servers not working:                           ║');
        console.log('║     → gameserver pterodactyl (test API)                ║');
        console.log('║     → config show (check Pterodactyl settings)         ║');
        console.log('║                                                          ║');
        console.log('║  ❌ High memory usage:                                  ║');
        console.log('║     → system performance                                ║');
        console.log('║     → logs clear (clear old logs)                      ║');
        console.log('║     → system restart                                    ║');
        console.log('║                                                          ║');
        console.log('║  📞 Still need help?                                    ║');
        console.log('║     → logs view 50 (check recent errors)               ║');
        console.log('║     → system health (full health check)                ║');
        console.log('║                                                          ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }

    showHelp() {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                   Quick Command Help                     ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log('║  quick setup          - Show setup guide                ║');
        console.log('║  quick status         - Quick status commands           ║');
        console.log('║  quick troubleshoot   - Common issues & solutions       ║');
        console.log('║                                                          ║');
        console.log('║  💡 This command provides quick references for          ║');
        console.log('║     common server administration tasks                   ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
    }
}

module.exports = QuickCommand;