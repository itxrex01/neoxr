const fs = require('fs');
const path = require('path');

class Config {
    constructor() {
        this.configPath = path.join(__dirname, '../config.json');
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
        
        // Default configuration
        return {
            bot: {
                name: 'HyperWa Bot',
                version: '1.0.0',
                prefix: '.',
                owner: '',
                admins: []
            },
            telegram: {
                enabled: false,
                botToken: '',
                chatId: ''
            },
            features: {
                autoViewStatus: true,
                rateLimiting: true,
                respondToUnknownCommands: false,
                sendPermissionError: false,
                customModules: true,
                mode: 'public'
            },
            security: {
                blockedUsers: []
            },
            viewonce: {
                autoForward: true,
                saveToTemp: true,
                enableInGroups: true,
                enableInPrivate: true,
                logActivity: true,
                skipOwner: false
            }
        };
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    get(key, defaultValue = undefined) {
        const keys = key.split('.');
        let value = this.config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveConfig();
    }

    has(key) {
        return this.get(key) !== undefined;
    }

    delete(key) {
        const keys = key.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== 'object') {
                return false;
            }
            current = current[k];
        }
        
        delete current[keys[keys.length - 1]];
        this.saveConfig();
        return true;
    }
}

module.exports = new Config();