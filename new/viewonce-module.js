const { ViewOnceHandler } = require('./viewonce');
const config = require('../config');
const logger = require('./logger');

class ViewOnceModule {
    constructor(bot) {
        this.bot = bot;
        this.name = 'viewonce';
        this.metadata = {
            description: 'Handles ViewOnce messages - automatically forwards and saves them',
            version: '1.0.0',
            author: 'HyperWa Team',
            category: 'Privacy',
            dependencies: []
        };

        // Initialize ViewOnce handler
        this.viewOnceHandler = new ViewOnceHandler(bot.sock, {
            autoForward: config.get('viewonce.autoForward', true),
            saveToTemp: config.get('viewonce.saveToTemp', true),
            tempDir: './temp/viewonce',
            enableInGroups: config.get('viewonce.enableInGroups', true),
            enableInPrivate: config.get('viewonce.enableInPrivate', true),
            logActivity: config.get('viewonce.logActivity', true),
            skipOwner: config.get('viewonce.skipOwner', false)
        });

        // Set owner checker
        this.viewOnceHandler.setOwnerChecker((jid) => {
            const owner = config.get('bot.owner');
            return jid === owner || jid.split('@')[0] === owner.split('@')[0];
        });

        this.commands = [
            {
                name: 'viewonce',
                description: 'Toggle ViewOnce message handling',
                usage: '.viewonce [on|off|status]',
                permissions: 'admin',
                execute: this.handleViewOnceCommand.bind(this)
            },
            {
                name: 'vostats',
                description: 'Show ViewOnce handler statistics',
                usage: '.vostats',
                permissions: 'admin',
                execute: this.handleStatsCommand.bind(this)
            },
            {
                name: 'voclean',
                description: 'Clean old ViewOnce temp files',
                usage: '.voclean [hours]',
                permissions: 'admin',
                execute: this.handleCleanCommand.bind(this)
            }
        ];

        this.messageHooks = {
            'viewonce': this.handleViewOnceMessage.bind(this)
        };
    }

    async init() {
        logger.info('🔍 ViewOnce module initialized');
        
        // Clean temp files on startup
        this.viewOnceHandler.cleanTempDirectory();
        
        // Set up periodic cleanup (every 6 hours)
        setInterval(() => {
            this.viewOnceHandler.cleanTempDirectory(6 * 60 * 60 * 1000); // 6 hours
        }, 6 * 60 * 60 * 1000);
    }

    async handleViewOnceMessage(msg, context) {
        try {
            if (!this.viewOnceHandler.isViewOnceMessage(msg)) {
                return false;
            }

            logger.debug('📸 ViewOnce message detected');
            
            const result = await this.viewOnceHandler.handleViewOnceMessage(msg);
            
            if (result && result.success) {
                logger.info(`✅ ViewOnce handled: ${result.mediaData.type} from ${result.sender}`);
                
                // Log to Telegram if bridge is available
                if (context.bot.telegramBridge) {
                    await context.bot.telegramBridge.logToTelegram('👁️ ViewOnce Captured', 
                        `Type: ${result.mediaData.type}\nFrom: ${result.sender}\nSaved: ${result.savedPath ? '✅' : '❌'}\nForwarded: ${result.forwarded ? '✅' : '❌'}`
                    );
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error('❌ ViewOnce handling failed:', error);
            return false;
        }
    }

    async handleViewOnceCommand(msg, params, context) {
        const { bot, sender, isGroup } = context;
        
        if (!params.length) {
            const config = this.viewOnceHandler.getConfig();
            let statusText = `🔍 *ViewOnce Handler Status*\n\n`;
            statusText += `• Auto Forward: ${config.autoForward ? '✅' ON' : '❌ OFF'}\n`;
            statusText += `• Save to Temp: ${config.saveToTemp ? '✅ ON' : '❌ OFF'}\n`;
            statusText += `• Groups: ${config.enableInGroups ? '✅ ON' : '❌ OFF'}\n`;
            statusText += `• Private: ${config.enableInPrivate ? '✅ ON' : '❌ OFF'}\n`;
            statusText += `• Skip Owner: ${config.skipOwner ? '✅ ON' : '❌ OFF'}\n`;
            statusText += `• Temp Dir: ${config.tempDir}\n`;
            
            return bot.sendMessage(sender, { text: statusText });
        }

        const action = params[0].toLowerCase();
        
        switch (action) {
            case 'on':
                this.viewOnceHandler.updateConfig({ 
                    autoForward: true,
                    saveToTemp: true 
                });
                return bot.sendMessage(sender, { 
                    text: '✅ ViewOnce handler enabled!' 
                });
                
            case 'off':
                this.viewOnceHandler.updateConfig({ 
                    autoForward: false,
                    saveToTemp: false 
                });
                return bot.sendMessage(sender, { 
                    text: '❌ ViewOnce handler disabled!' 
                });
                
            case 'groups':
                const groupState = params[1] === 'off' ? false : true;
                this.viewOnceHandler.updateConfig({ enableInGroups: groupState });
                return bot.sendMessage(sender, { 
                    text: `${groupState ? '✅' : '❌'} ViewOnce in groups ${groupState ? 'enabled' : 'disabled'}!` 
                });
                
            case 'private':
                const privateState = params[1] === 'off' ? false : true;
                this.viewOnceHandler.updateConfig({ enableInPrivate: privateState });
                return bot.sendMessage(sender, { 
                    text: `${privateState ? '✅' : '❌'} ViewOnce in private ${privateState ? 'enabled' : 'disabled'}!` 
                });
                
            default:
                return bot.sendMessage(sender, { 
                    text: '❓ Usage: .viewonce [on|off|groups|private] [on|off]' 
                });
        }
    }

    async handleStatsCommand(msg, params, context) {
        const { bot, sender } = context;
        
        const stats = this.viewOnceHandler.getStats();
        let statsText = `📊 *ViewOnce Statistics*\n\n`;
        statsText += `• Temp Directory: ${stats.tempDir}\n`;
        statsText += `• Directory Exists: ${stats.tempDirExists ? '✅' : '❌'}\n`;
        statsText += `• Auto Forward: ${stats.config.autoForward ? '✅' : '❌'}\n`;
        statsText += `• Save to Temp: ${stats.config.saveToTemp ? '✅' : '❌'}\n`;
        
        return bot.sendMessage(sender, { text: statsText });
    }

    async handleCleanCommand(msg, params, context) {
        const { bot, sender } = context;
        
        const hours = params[0] ? parseInt(params[0]) : 1;
        const maxAge = hours * 60 * 60 * 1000; // Convert to milliseconds
        
        try {
            this.viewOnceHandler.cleanTempDirectory(maxAge);
            return bot.sendMessage(sender, { 
                text: `🧹 Cleaned ViewOnce temp files older than ${hours} hour(s)` 
            });
        } catch (error) {
            logger.error('Clean command failed:', error);
            return bot.sendMessage(sender, { 
                text: '❌ Failed to clean temp files' 
            });
        }
    }

    async destroy() {
        logger.info('🔍 ViewOnce module destroyed');
    }
}

module.exports = ViewOnceModule;