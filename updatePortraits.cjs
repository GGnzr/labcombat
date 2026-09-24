const fs = require('fs');
let cs = fs.readFileSync('src/scenes/CharacterSelectScene.js', 'utf8');
cs = cs.replace(/const portrait = this\.add\.image\(0, -8, prof\.portraitKey\)\.setDisplaySize\(54, 46\);/g, "const portrait = this.add.sprite(0, -6, prof.atlasKey, 'idle').setScale(0.24);");
fs.writeFileSync('src/scenes/CharacterSelectScene.js', cs, 'utf8');

let ms = fs.readFileSync('src/scenes/MainScene.js', 'utf8');
ms = ms.replace(/this\.p1Portrait\s*=\s*this\.add\.image\(56, 94, 'prof_so_portrait'\)\.setDisplaySize\(62, 62\);/g, "this.p1Portrait = this.add.sprite(56, 94, getProfessorById(this.p1Data?.characterId || 'so').atlasKey, 'idle').setScale(0.24);");
ms = ms.replace(/this\.p2Portrait\s*=\s*this\.add\.image\(968, 94, 'prof_web_portrait'\)\.setDisplaySize\(62, 62\);/g, "this.p2Portrait = this.add.sprite(968, 94, getProfessorById(this.p2Data?.characterId || 'web').atlasKey, 'idle').setScale(0.24);");
ms = ms.replace(/this\.p1Portrait\.setTexture\(p1Prof\.portraitKey\);/g, "this.p1Portrait.setTexture(p1Prof.atlasKey, 'idle');");
ms = ms.replace(/this\.p2Portrait\.setTexture\(p2Prof\.portraitKey\);/g, "this.p2Portrait.setTexture(p2Prof.atlasKey, 'idle');");
ms = ms.replace(/this\.ultPortrait\.setTexture\(winnerProf\.portraitKey\);/g, "this.ultPortrait.setTexture(winnerProf.atlasKey, 'idle');");
fs.writeFileSync('src/scenes/MainScene.js', ms, 'utf8');
console.log('updated portraits');
