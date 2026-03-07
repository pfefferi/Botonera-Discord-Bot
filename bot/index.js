require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

// Generate unique ID for this instance
const INSTANCE_ID = crypto.randomBytes(3).toString('hex').toUpperCase();
console.log(`>>> [IDENTITY] Instance ID: [${INSTANCE_ID}] starting up...`);

// 1. Setup Express Server
const app = express();
app.use(cors());
app.use(express.json());

// Serve static client files and audio
app.use(express.static(path.join(__dirname, '../')));

const PORT = process.env.PORT || 3000;

// 2. Setup Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Single audio player for the bot
const player = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
    },
});

let currentConnection = null;

client.once('clientReady', (c) => {
    console.log(`>>> [READY][${INSTANCE_ID}] Bot logged in as ${c.user.tag}`);
    // Diagnostic: Check for encryption libraries
    try {
        require('sodium-native');
        console.log('>>> [CRYPTO] sodium-native is AVAILABLE');
    } catch (e) {
        console.log('>>> [CRYPTO] sodium-native is NOT available');
    }
});

// Global error handler
client.on('error', error => {
    console.error('DISCORD CLIENT ERROR:', error);
});

// Debug listener (Verbose)
client.on('debug', info => {
    if (info.includes('Ready') || info.includes('Login') || info.includes('Invalid')) {
        console.log(`[DEBUG][${INSTANCE_ID}] ${info}`);
    }
});

// Command to join a voice channel
client.on('messageCreate', async (message) => {
    // LOG EVERY MESSAGE RECEIVED (Debug)
    console.log(`[MSG RECEIVE][${INSTANCE_ID}] "${message.content}" from ${message.author.tag}`);

    if (message.author.bot) return;

    if (!message.guild) return;

    // Instance Status Command
    if (message.content === '!status') {
        return message.reply(`**Instance ID:** \`[${INSTANCE_ID}]\`\n**Status:** Online\n**Voice Connection:** ${currentConnection ? currentConnection.state.status : 'Disconnected'}`);
    }

    // Simple command to summon the bot to your voice channel
    if (message.content === '!join' || message.content === '!ping') {
        if (message.content === '!ping') return message.reply(`Pong! [${INSTANCE_ID}]`);

        console.log(`>>> [${INSTANCE_ID}] Processing !join command from ${message.author.tag}`);
        const channel = message.member?.voice.channel;

        if (channel) {
            // Check if we already have a connection in this guild
            if (currentConnection && currentConnection.joinConfig.guildId === message.guild.id) {
                console.log('>>> Connection already exists in this guild.');
                if (currentConnection.joinConfig.channelId === channel.id) {
                    return message.reply(`Already in ${channel.name}!`);
                }
                console.log('>>> Moving to new channel...');
            }

            console.log(`>>> [${INSTANCE_ID}] Joining channel: ${channel.name} (${channel.id})`);
            try {
                currentConnection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: false,
                    selfMute: false
                });

                let signallingCount = 0;
                let connectionTimeout = setTimeout(() => {
                    if (currentConnection && currentConnection.state.status !== VoiceConnectionStatus.Ready) {
                        console.log(`>>> [${INSTANCE_ID}] TIMEOUT: Connection stuck in ${currentConnection.state.status}. Destroying.`);
                        currentConnection.destroy();
                        currentConnection = null;
                        message.reply(`[${INSTANCE_ID}] ⚠️ Connection timed out. Multiple instances or Render network issues detected.`);
                    }
                }, 20000); // 20s total wait

                // Detailed state change logging
                currentConnection.on('stateChange', (oldState, newState) => {
                    console.log(`>>> [${INSTANCE_ID}] VoiceConnection [${channel.name}] changed: ${oldState.status} => ${newState.status}`);

                    if (newState.status === VoiceConnectionStatus.Signalling) {
                        signallingCount++;
                        if (signallingCount > 3) {
                            console.log(`>>> [${INSTANCE_ID}] LOOP DETECTED: Stuck in Signalling. Aborting.`);
                            currentConnection.destroy();
                            currentConnection = null;
                            clearTimeout(connectionTimeout);
                            message.reply(`[${INSTANCE_ID}] ❌ Stuck in Signalling loop. Reset your token or check for ghost instances.`);
                        }
                    }

                    if (newState.status === VoiceConnectionStatus.Ready) {
                        clearTimeout(connectionTimeout);
                    }
                });

                // Subscribe connection to the player
                currentConnection.subscribe(player);

                // Wait for the connection to be ready before replying
                try {
                    await entersState(currentConnection, VoiceConnectionStatus.Ready, 15_000);
                    await message.reply(`[${INSTANCE_ID}] Successfully joined **${channel.name}**! Ready to play.`);
                    console.log(`>>> [${INSTANCE_ID}] Joined and Ready.`);
                } catch (err) {
                    // Handled by stateChange and timeout logic above
                }

                // Handle disconnections
                currentConnection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
                    console.log('>>> Voice Connection Disconnected.');
                    try {
                        await Promise.race([
                            entersState(currentConnection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(currentConnection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                    } catch (error) {
                        console.log('>>> Reconnection failed, destroying connection.');
                        currentConnection.destroy();
                        currentConnection = null;
                    }
                });

            } catch (error) {
                console.error('>>> JOIN ERROR:', error);
                message.reply('Failed to join voice channel.');
            }
        } else {
            console.log('>>> User NOT in a voice channel.');
            message.reply('You need to join a voice channel first!');
        }
    }

    // Command to leave the voice channel
    if (message.content === '!leave') {
        console.log('>>> Processing !leave command');
        if (currentConnection) {
            currentConnection.destroy();
            currentConnection = null;
            message.reply('Left the voice channel.');
            console.log('>>> Left channel.');
        } else {
            console.log('>>> !leave called but no connection active.');
            message.reply('I am not currently in a voice channel!');
        }
    }
});

// Audio Player Diagnostics
player.on('stateChange', (oldState, newState) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`>>> [${timestamp}][${INSTANCE_ID}] AudioPlayer state: ${oldState.status} => ${newState.status}`);
});

player.on('error', error => {
    console.error(`>>> AudioPlayer Error: ${error.message} with resource ${error.resource.metadata}`);
});

// 3. Express Endpoint to handle audio playback requests
app.post('/play', (req, res) => {
    const { filename, folder } = req.body;

    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    // Map frontend keys to actual directory names
    const folderMap = {
        'chao': 'Chao Voices',
        'sonic': 'Sonic',
        'shadow': 'Shadow',
        'pokemon': 'Pokemon'
    };

    const targetFolder = folderMap[folder] || 'Chao Voices';

    if (!currentConnection) {
        console.log(`REJECTED: Bot tried to play sound [${targetFolder}/${filename}] but is not in a voice channel.`);
        return res.status(400).json({ error: 'Bot is not currently in a voice channel. JOIN a voice channel and type !join in Discord first!' });
    }

    try {
        // Resolve the path to the audio file
        const audioPath = path.resolve(__dirname, '../', targetFolder, filename);

        // Audit file existence
        const fs = require('fs');
        if (!fs.existsSync(audioPath)) {
            console.error(`>>> FILE MISSING: ${audioPath}`);
            return res.status(404).json({ error: `Audio file not found on server: ${filename}` });
        }

        console.log(`>>> Playing audio: ${audioPath}`);

        // Create an audio resource from the file
        const resource = createAudioResource(audioPath, {
            metadata: filename
        });

        // Play it!
        player.play(resource);

        res.status(200).json({ success: true, message: `Playing ${filename}` });
    } catch (error) {
        console.error('>>> Error playing sound:', error);
        res.status(500).json({ error: 'Failed to play sound' });
    }
});

app.post('/stop', (req, res) => {
    try {
        player.stop();
        res.status(200).json({ success: true, message: 'Audio stopped' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to stop audio' });
    }
});

// --- DIAGNOSTICS & AUDIT ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('>>> UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('>>> UNCAUGHT EXCEPTION:', error);
});

const checkConnectivity = async () => {
    const https = require('https');
    console.log('>>> PROBING DISCORD CONNECTIVITY...');
    return new Promise((resolve) => {
        https.get('https://discord.com/api/v10/gateway', (res) => {
            console.log(`>>> CONNECTIVITY TEST: Status ${res.statusCode}`);
            resolve(res.statusCode === 200);
        }).on('error', (e) => {
            console.error('>>> CONNECTIVITY TEST: FAILED', e.message);
            resolve(false);
        });
    });
};

// Login to Discord with Retry Logic (to bypass 429 rate limits)
const attemptLogin = async (retries = 0) => {
    const token = process.env.DISCORD_TOKEN || '';

    if (token.length < 20) {
        console.log('>>> WARNING: DISCORD_TOKEN is missing or too short.');
        return;
    }

    console.log(`>>> ATTEMPTING DISCORD LOGIN (Try #${retries + 1})...`);
    console.log(`>>> TOKEN FORMAT: Start=${token.substring(0, 5)}... End=...${token.substring(token.length - 5)}`);

    try {
        // Enforce a timeout on the login promise
        const loginPromise = client.login(token);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Login timeout')), 15000)
        );

        await Promise.race([loginPromise, timeoutPromise]);
        console.log('>>> Login call successful (Promise resolved)');
    } catch (err) {
        console.error(`>>> LOGIN ERROR (Try #${retries + 1}):`, err.message);

        // If we hit a rate limit (429) or a timeout, retry with exponential backoff
        if (err.message.includes('429') || err.message.includes('Rate limit') || err.message.includes('timeout')) {
            const waitTime = Math.min(Math.pow(2, retries) * 5000, 60000); // Max 1m
            console.log(`>>> RETRYING in ${waitTime / 1000}s...`);
            setTimeout(() => attemptLogin(retries + 1), waitTime);
        } else {
            console.error('>>> CRITICAL ERROR: Non-retryable failure.', err);
        }
    }
};

// Global Audio Player Logs
console.log('>>> Initializing Audio Player event listeners...');
player.on(AudioPlayerStatus.Playing, () => console.log('>>> Audio player is PLAYING'));
player.on(AudioPlayerStatus.Buffering, () => console.log('>>> Audio player is BUFFERING'));
player.on(AudioPlayerStatus.Idle, () => console.log('>>> Audio player is IDLE'));
player.on('error', error => console.error('>>> Audio player ERROR:', error));

// 4. Start everything up
app.listen(PORT, async () => {
    console.log(`Express API server running on port ${PORT}`);
    console.log(`>>> NODE VERSION: ${process.version}`);
    console.log(`>>> PLATFORM: ${process.platform}`);

    await checkConnectivity();
    await attemptLogin();
});



