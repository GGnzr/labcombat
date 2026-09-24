const fs = require('fs');

let ms = fs.readFileSync('src/scenes/MainScene.js', 'utf8');
ms = ms.replace(/this\.textures\.exists\(winnerProf\.portraitKey\)/g, "true");
ms = ms.replace(/this\.textures\.exists\(p1Prof\.portraitKey\)/g, "true");
ms = ms.replace(/this\.textures\.exists\(p2Prof\.portraitKey\)/g, "true");
fs.writeFileSync('src/scenes/MainScene.js', ms, 'utf8');
console.log('updated if checks');
