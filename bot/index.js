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

client.once('ready', () => {
    console.log(`Bot is ready! Logged in as ${client.user.tag}`);
});

// Global error handler
client.on('error', error => {
    console.error('DISCORD CLIENT ERROR:', error);
});

// Debug listener (Verbose)
client.on('debug', info => {
    if (info.includes('Ready') || info.includes('Login') || info.includes('Invalid')) {
        console.log(`[DEBUG] ${info}`);
    }
});

// Command to join a voice channel
client.on('messageCreate', async (message) => {
    // LOG EVERY MESSAGE RECEIVED (Debug)
    console.log(`[MSG RECEIVE] "${message.content}" from ${message.author.tag} in ${message.guild ? 'Server: ' + message.guild.name : 'DMs'}`);

    if (message.author.bot) return;

    if (!message.guild) return;

    // Simple command to summon the bot to your voice channel
    if (message.content === '!join' || message.content === '!ping') {
        if (message.content === '!ping') return message.reply('Pong!');

        console.log('>>> Processing !join command');
        const channel = message.member?.voice.channel;

        if (channel) {
            console.log(`>>> Found user in channel: ${channel.name} (${channel.id})`);
            try {
                currentConnection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                });

                // Subscribe connection to the player
                currentConnection.subscribe(player);

                await message.reply('Joined your voice channel! Ready to play sounds from the soundboard.');
                console.log('>>> Joined and replied successfully.');

                // Handle disconnections
                currentConnection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
                    console.log('>>> Voice Connection Disconnected detected.');
                    try {
                        await Promise.race([
                            entersState(currentConnection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(currentConnection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                    } catch (error) {
                        currentConnection.destroy();
                        currentConnection = null;
                        console.log('>>> Connection destroyed permanently.');
                    }
                });

            } catch (error) {
                console.error('>>> JOIN ERROR:', error);
                message.reply('Failed to join voice channel. Check bot logs on Render.');
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

// 3. Express Endpoint to handle audio playback requests
app.post('/play', (req, res) => {
    const { filename } = req.body;

    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    if (!currentConnection) {
        console.log('REJECTED: Bot tried to play sound but is not in a voice channel.');
        return res.status(400).json({ error: 'Bot is not currently in a voice channel. JOIN a voice channel and type !join in Discord first!' });
    }

    try {
        // Resolve the path to the audio file (assuming it's in the parent project folder)
        const audioPath = path.resolve(__dirname, '../Chao Voices', filename);

        console.log(`Playing audio: ${audioPath}`);

        // Create an audio resource from the file
        const resource = createAudioResource(audioPath);

        // Play it!
        player.play(resource);

        res.status(200).json({ success: true, message: `Playing ${filename}` });
    } catch (error) {
        console.error('Error playing sound:', error);
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

// 4. Start everything up
app.listen(PORT, () => {
    console.log(`Express API server running on port ${PORT}`);

    // Login to Discord (Global trace)
    console.log('>>> ATTEMPTING DISCORD LOGIN...');
    console.log('>>> DISCORD_TOKEN length:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 0);

    if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN.length > 10) {
        client.login(process.env.DISCORD_TOKEN)
            .then(() => console.log('>>> Login call successful (Promise resolved)'))
            .catch(err => {
                console.error('>>> CRITICAL LOGIN ERROR:', err);
            });
    } else {
        console.log('>>> WARNING: DISCORD_TOKEN is missing or too short. Check Render Environment Variables!');
    }
});


