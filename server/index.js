const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let players = [];

// Numaraları her değişiklikte 1'den başlayarak yeniden dağıtan fonksiyon
const reassignNumbers = () => {
    players.forEach((p, index) => {
        p.num = index + 1;
    });
};

io.on('connection', (socket) => {
    socket.on('join_game', (data) => {
        // Yeni oyuncuyu ekle (Geçici numara veriyoruz, reassign düzeltecek)
        players.push({ 
            id: socket.id, 
            name: data.name, 
            num: 0, 
            points: 200, 
            isAlive: true 
        });
        reassignNumbers(); // Numaraları tazele
        io.emit('update_players', players);
    });

    socket.on('start_game_request', () => io.emit('game_start_signal'));

    socket.on('reset_game_request', () => {
        players.forEach(p => { p.points = 200; p.isAlive = true; });
        reassignNumbers(); // Reset atınca da numaralar netleşsin
        io.emit('update_players', players);
        io.emit('game_reset_signal');
    });

    socket.on('send_olur', (data) => {
        const s = players.find(p => p.id === socket.id);
        const t = players.find(p => p.num === parseInt(data.targetNum));
        if (s && t && t.isAlive) {
            io.emit('receive_olur', { s_id: s.id, s_name: s.name, s_num: s.num, t_id: t.id, t_num: t.num });
        }
    });

    socket.on('send_olmaz', (data) => {
        const s = players.find(p => p.id === socket.id);
        if (s) io.emit('receive_olmaz', { s_id: s.id, s_name: s.name, s_num: s.num, t_id: data.t_id });
    });

    socket.on('send_kac_olsun', (data) => {
        const s = players.find(p => p.id === socket.id);
        if (s) io.emit('receive_kac_olsun', { s_id: s.id, s_name: s.name, s_num: s.num, t_id: data.t_id });
    });

    socket.on('wrong_action', (data) => {
        const p = players.find(p => p.id === socket.id);
        if (p && p.isAlive) {
            p.points -= 25;
            if (p.points <= 0) { p.points = 0; p.isAlive = false; }
            io.emit('update_players', players);
            const backTo = players.find(pl => pl.id === data.back_to_id && pl.isAlive);
            const nextId = backTo ? backTo.id : players.find(pl => pl.isAlive)?.id;
            io.emit('timeout_recovery', { next_id: nextId });
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        reassignNumbers(); // BİRİ ÇIKTIĞINDA NUMARALARI YENİDEN DAĞIT 🚀
        io.emit('update_players', players);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 SERVER ${PORT} PORTUNDA AKTİF`));