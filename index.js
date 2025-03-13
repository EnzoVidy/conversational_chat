const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.json());
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('prompt', async (prompt) => {
        try {
            const response = await axios.post('http://localhost:11434/api/generate', {
                model: 'deepseek-r1',
                prompt: prompt,
                stream: true
            }, {
                responseType: 'stream'
            });

            let fullMessage = '';
            let isThinking = false;

            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.response) {
                            let content = json.response;

                            // Détection des balises <think> et </think>
                            if (content.includes('<think>')) {
                                isThinking = true;
                                content = content.replace('<think>', '<span class="thinking">');
                            }
                            if (content.includes('</think>')) {
                                isThinking = false;
                                content = content.replace('</think>', '</span><br/>');
                            }

                            // Ajout du contenu au message complet
                            fullMessage += content;
                            socket.emit('response', fullMessage);
                        }
                        if (json.done) {
                            socket.emit('response_done');
                        }
                    } catch (err) {
                        console.error('Erreur de parsing JSON:', err);
                    }
                }
            });

            response.data.on('end', () => {
                console.log('Réponse complète reçue');
            });
        } catch (error) {
            console.error('Erreur:', error);
            socket.emit('response', 'Erreur lors de la requête à l\'IA');
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});
