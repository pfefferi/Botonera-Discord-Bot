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

// Command to join a voice channel
client.on('messageCreate', async (message) => {
    if (!message.guild) return;

    // Simple command to summon the bot to your voice channel
    if (message.content === '!join') {
        const channel = message.member?.voice.channel;

        if (channel) {
            try {
                currentConnection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                });

                // Subscribe connection to the player
                currentConnection.subscribe(player);

                message.reply('Joined your voice channel! Ready to play sounds from the soundboard.');

                // Handle disconnections
                currentConnection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
                    try {
                        await Promise.race([
                            entersState(currentConnection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(currentConnection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                        // Seems to be reconnecting to a new channel - ignore
                    } catch (error) {
                        // Seems to be a real disconnect which shouldn't be recovered from
                        currentConnection.destroy();
                        currentConnection = null;
                        console.log('Bot disconnected from voice channel.');
                    }
                });

            } catch (error) {
                console.error(error);
                message.reply('Failed to join voice channel.');
            }
        } else {
            message.reply('You need to join a voice channel first!');
        }
    }

    // Command to leave the voice channel
    if (message.content === '!leave') {
        if (currentConnection) {
            currentConnection.destroy();
            currentConnection = null;
            message.reply('Left the voice channel.');
        } else {
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
        return res.status(400).json({ error: 'Bot is not currently in a voice channel. Type !join in discord first.' });
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

    // Login to Discord
    if (process.env.DISCORD_TOKEN) {
        client.login(process.env.DISCORD_TOKEN).catch(err => {
            console.error('Failed to login to Discord:', err);
        });
    } else {
        console.log('WARNING: Missing DISCORD_TOKEN in .env file!');
    }
});
