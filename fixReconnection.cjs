const fs = require('fs');

let ms = fs.readFileSync('src/scenes/MenuScene.js', 'utf8');

const oldLogic = const isP1 = (data.p1 && data.p1.nickname && data.p1.nickname.trim().toLowerCase() === nickname.trim().toLowerCase()) || (sessionRoomId === targetRoomId && sessionPlayerId === 'p1');
                const isP2 = (data.p2 && data.p2.nickname && data.p2.nickname.trim().toLowerCase() === nickname.trim().toLowerCase()) || (sessionRoomId === targetRoomId && sessionPlayerId === 'p2');;

const newLogic = const lowerNick = nickname.trim().toLowerCase();
                const isDefaultNick = (lowerNick === 'jogador 1' || lowerNick === 'jogador 2');
                const isP1 = (sessionRoomId === targetRoomId && sessionPlayerId === 'p1') || 
                             (!isDefaultNick && data.p1 && data.p1.nickname && data.p1.nickname.trim().toLowerCase() === lowerNick);
                const isP2 = (sessionRoomId === targetRoomId && sessionPlayerId === 'p2') || 
                             (!isDefaultNick && data.p2 && data.p2.nickname && data.p2.nickname.trim().toLowerCase() === lowerNick);;

if(ms.includes(oldLogic)) {
    ms = ms.replace(oldLogic, newLogic);
    fs.writeFileSync('src/scenes/MenuScene.js', ms, 'utf8');
    console.log('Fixed reconnection logic in MenuScene.js');
} else {
    console.log('Could not find old logic in MenuScene.js');
}
