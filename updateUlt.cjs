const fs = require('fs');
let ms = fs.readFileSync('src/scenes/MainScene.js', 'utf8');
ms = ms.replace(/this\.ultPortrait = this\.add\.image\(0, -45, 'prof_so_portrait'\)\.setDisplaySize\(160, 140\);/g, "this.ultPortrait = this.add.sprite(0, -60, getProfessorById(this.p1Data?.characterId || 'so').atlasKey, 'idle').setScale(0.85);");
fs.writeFileSync('src/scenes/MainScene.js', ms, 'utf8');
