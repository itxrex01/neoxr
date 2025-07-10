                  mimetype: mediaData.mimetype || 'audio/mp4'
                    }
                    break
                    
                default:
                    return false
            }

            await this.bot.sock.sendMessage(chatId, messageContent)
            
            this.log(`Forwarded viewonce ${mediaData.type} to ${chatId}`)
            this.stats.forwarded++
            return true
        } catch (error) {
            this.logError('Error forwarding viewonce:', error)
            this.stats.errors++
            return false
        }
    }

    /**
     * Process audio viewonce (convert if needed)
     * @param {Buffer} audioBuffer - Audio buffer
     * @param {string} mimetype - Original mimetype
     * @returns {Promise<Buffer>}
     */
    async processAudioViewOnce(audioBuffer, mimetype) {
        return new Promise((resolve, reject) => {
            try {
                if (/ogg/.test(mimetype)) {
                    const inputPath = path.join(tmpdir(), `input_${Date.now()}.ogg`)
                    const outputPath = path.join(tmpdir(), `output_${Date.now()}.mp3`)
                    
                    create(inputPath, audioBuffer)
                    
                    exec(`ffmpeg -i ${inputPath} ${outputPath}`, (err) => {
                        remove(inputPath)
                        
                        if (err) {
                            reject(err)
                            return
                        }
                        
                        try {
                            const convertedBuffer = read(outputPath)
                            remove(outputPath)
                            resolve(convertedBuffer)
                        } catch (readErr) {
                            reject(readErr)
                        }
                    })
                } else {
                    resolve(audioBuffer)
                }
            } catch (error) {
                reject(error)
            }
        })
    }

    /**
     * Main viewonce detection hook
     * @param {Object} msg - Message object
     * @param {Object} context - Message context
     */
    async detectViewOnce(msg, context) {
        if (!this.isViewOnceMessage(msg)) return

        const sender = msg.key.participant || msg.key.remoteJid
        const isOwner = context.isOwner || false

        if (isOwner && this.config.skipOwner) return

        await this.processViewOnce(msg, context)
    }

    /**
     * Process viewonce message
     * @param {Object} msg - Message object
     * @param {Object} context - Message context
     */
    async processViewOnce(msg, context) {
        try {
            if (!this.isViewOnceMessage(msg)) return

            const mediaData = await this.downloadViewOnceMedia(msg)
            if (!mediaData) return

            // Process audio if needed
            if (mediaData.type === 'audio') {
                try {
                    mediaData.buffer = await this.processAudioViewOnce(mediaData.buffer, mediaData.mimetype)
                } catch (audioError) {
                    this.log('Audio processing failed, using original:', audioError)
                }
            }

            const chatId = msg.key.remoteJid
            
            // Save to temp if enabled
            let savedPath = null
            if (this.config.saveToTemp) {
                savedPath = await this.saveToTemp(mediaData, chatId)
            }

            // Forward if enabled
            let forwarded = false
            if (this.config.autoForward) {
                forwarded = await this.forwardViewOnce(msg, mediaData)
            }

            this.stats.processed++
            
            this.log(`Processed viewonce ${mediaData.type} from ${chatId}`)

            return {
                success: true,
                mediaData,
                savedPath,
                forwarded,
                timestamp: Date.now()
            }
        } catch (error) {
            this.logError('Error processing viewonce:', error)
            this.stats.errors++
            return { success: false, error: error.message }
        }
    }

    /**
     * Handle RVO command (manual reveal viewonce)
     * @param {Object} msg - Message object
     * @param {Array} params - Command parameters
     * @param {Object} context - Command context
     */
    async handleRvoCommand(msg, params, context) {
        if (!msg.quoted) {
            return context.bot.sendMessage(context.sender, {
                text: '🔍 *Manual ViewOnce Reveal*\n\n❌ Please reply to a ViewOnce message to reveal it.'
            })
        }

        if (!this.isViewOnceMessage(msg.quoted)) {
            return context.bot.sendMessage(context.sender, {
                text: '❌ The replied message is not a ViewOnce message.'
            })
        }

        const processingMsg = await context.bot.sendMessage(context.sender, {
            text: '⚡ *Revealing ViewOnce*\n\n🔄 Processing ViewOnce message...\n⏳ Please wait...'
        })

        try {
            const result = await this.processViewOnce(msg.quoted, context)
            
            if (result && result.success) {
                await context.bot.sock.sendMessage(context.sender, {
                    text: `✅ *ViewOnce Revealed Successfully*\n\n📦 Type: ${result.mediaData.type}\n📁 Saved: ${result.savedPath ? 'Yes' : 'No'}\n🔄 Forwarded: ${result.forwarded ? 'Yes' : 'No'}\n⏰ ${new Date().toLocaleTimeString()}`,
                    edit: processingMsg.key
                })
            } else {
                await context.bot.sock.sendMessage(context.sender, {
                    text: `❌ *ViewOnce Reveal Failed*\n\n🚫 Error: ${result?.error || 'Unknown error'}\n🔧 Please try again or check the message format.`,
                    edit: processingMsg.key
                })
            }
        } catch (error) {
            logger.error('RVO command failed:', error)
            await context.bot.sendMessage(context.sender, {
                text: `❌ *ViewOnce Reveal Failed*\n\n🚫 Error: ${error.message}`
            })
        }
    }

    /**
     * Handle viewonce toggle command
     * @param {Object} msg - Message object
     * @param {Array} params - Command parameters
     * @param {Object} context - Command context
     */
    async handleViewOnceToggle(msg, params, context) {
        if (params.length === 0) {
            const status = this.config.autoForward ? 'ON' : 'OFF'
            return context.bot.sendMessage(context.sender, {
                text: `🔍 *ViewOnce Auto-Forward Status*\n\n📊 Current Status: ${status}\n\n💡 Usage: \`.viewonce on\` or \`.viewonce off\``
            })
        }

        const action = params[0].toLowerCase()
        
        if (!['on', 'off'].includes(action)) {
            return context.bot.sendMessage(context.sender, {
                text: '❌ Invalid option. Use `on` or `off`.'
            })
        }

        this.config.autoForward = action === 'on'
        
        await context.bot.sendMessage(context.sender, {
            text: `✅ ViewOnce auto-forward has been turned **${action.toUpperCase()}**`
        })
    }

    /**
     * Generate filename based on type and mimetype
     * @param {string} type - Media type
     * @param {string} mimetype - MIME type
     * @returns {string}
     */
    generateFilename(type, mimetype) {
        const timestamp = Date.now()
        const extensions = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'video/mp4': 'mp4',
            'video/3gpp': '3gp',
            'audio/mp4': 'mp3',
            'audio/ogg': 'ogg',
            'audio/mpeg': 'mp3'
        }
        
        const ext = extensions[mimetype] || type
        return `${type}_${timestamp}.${ext}`
    }

    /**
     * Clean temp directory
     * @param {number} maxAge - Maximum age in milliseconds
     */
    cleanTempDirectory(maxAge = this.config.maxTempAge) {
        try {
            const fs = require('fs')
            if (!fs.existsSync(this.config.tempDir)) return

            const files = fs.readdirSync(this.config.tempDir)
            const now = Date.now()
            let cleaned = 0

            files.forEach(file => {
                if (!file.startsWith('viewonce_')) return

                const filePath = path.join(this.config.tempDir, file)
                try {
                    const stats = fs.statSync(filePath)
                    
                    if (now - stats.mtime.getTime() > maxAge) {
                        fs.unlinkSync(filePath)
                        cleaned++
                    }
                } catch (error) {
                    // File might have been deleted already
                }
            })

            if (cleaned > 0) {
                this.log(`Cleaned ${cleaned} old viewonce temp files`)
            }
        } catch (error) {
            this.logError('Error cleaning temp directory:', error)
        }
    }

    /**
     * Get module statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            tempDir: this.config.tempDir,
            tempDirExists: require('fs').existsSync(this.config.tempDir),
            config: { ...this.config }
        }
    }

    /**
     * Update module configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig }
        this.log('Configuration updated:', newConfig)
    }

    /**
     * Log messages
     * @param {...any} args - Arguments to log
     */
    log(...args) {
        if (this.config.logActivity) {
            logger.debug('[ViewOnce]', ...args)
        }
    }

    /**
     * Log errors
     * @param {...any} args - Arguments to log
     */
    logError(...args) {
        logger.error('[ViewOnce]', ...args)
    }
}

module.exports = ViewOnceModule