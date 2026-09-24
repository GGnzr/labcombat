const fs = require('fs');

let prof = fs.readFileSync('src/professors.js', 'utf8');
prof = prof.replace(/idleKey:\s*'[^']+',\n\s*portraitKey/g, 'portraitKey');
prof = prof.replace(/idleUrl:\s*'[^']+',\n\s*portraitUrl/g, 'portraitUrl');
prof = prof.replace(/portraitUrl:\s*'\/assets\/professors\/so_portrait\.png'/g, "portraitUrl: '/assets/professors/so_portrait.png',\n        atlasKey: 'atlas_so',\n        atlasImage: '/assets/so/phaser/SO.png',\n        atlasJson: '/assets/so/phaser/SO.json'");
prof = prof.replace(/portraitUrl:\s*'\/assets\/professors\/eng_soft_portrait\.png'/g, "portraitUrl: '/assets/professors/eng_soft_portrait.png',\n        atlasKey: 'atlas_eng_soft',\n        atlasImage: '/assets/eng/phaser/eng.png',\n        atlasJson: '/assets/eng/phaser/eng.json'");
prof = prof.replace(/portraitUrl:\s*'\/assets\/professors\/poo_portrait\.png'/g, "portraitUrl: '/assets/professors/poo_portrait.png',\n        atlasKey: 'atlas_poo',\n        atlasImage: '/assets/poo/phaser/poo.png',\n        atlasJson: '/assets/poo/phaser/poo.json'");
prof = prof.replace(/portraitUrl:\s*'\/assets\/professors\/web_portrait\.png'/g, "portraitUrl: '/assets/professors/web_portrait.png',\n        atlasKey: 'atlas_web',\n        atlasImage: '/assets/web/phaser/web.png',\n        atlasJson: '/assets/web/phaser/web.json'");
prof = prof.replace(/portraitUrl:\s*'\/assets\/professors\/bd_portrait\.png'/g, "portraitUrl: '/assets/professors/bd_portrait.png',\n        atlasKey: 'atlas_bd',\n        atlasImage: '/assets/bd/phaser/bd.png',\n        atlasJson: '/assets/bd/phaser/bd.json'");
prof = prof.replace(/portraitUrl:\s*'\/assets\/professors\/redes_portrait\.png'/g, "portraitUrl: '/assets/professors/redes_portrait.png',\n        atlasKey: 'atlas_redes',\n        atlasImage: '/assets/redes/phaser/redes.png',\n        atlasJson: '/assets/redes/phaser/redes.json'");
fs.writeFileSync('src/professors.js', prof, 'utf8');

let cs = fs.readFileSync('src/scenes/CharacterSelectScene.js', 'utf8');
cs = cs.replace(/this\.load\.image\(p\.idleKey,\s*p\.idleUrl\);/g, "this.load.atlas(p.atlasKey, p.atlasImage, p.atlasJson);");
cs = cs.replace(/this\.p1Sprite\.setTexture\(prof\.idleKey\);/g, "this.p1Sprite.setTexture(prof.atlasKey, 'idle');");
cs = cs.replace(/this\.p2Sprite\.setTexture\(prof\.idleKey\);/g, "this.p2Sprite.setTexture(prof.atlasKey, 'idle');");
cs = cs.replace(/this\.p1Sprite\.setDisplaySize\(110,\s*185\);/g, "this.p1Sprite.setScale(0.55); // Aspect ratio fixed");
cs = cs.replace(/this\.p2Sprite\.setDisplaySize\(110,\s*185\);/g, "this.p2Sprite.setScale(0.55); // Aspect ratio fixed");
fs.writeFileSync('src/scenes/CharacterSelectScene.js', cs, 'utf8');

let ms = fs.readFileSync('src/scenes/MainScene.js', 'utf8');
ms = ms.replace(/this\.fighterP1Sprite\s*=\s*this\.add\.image\(0,\s*48,\s*'prof_so_idle'\)/g, "this.fighterP1Sprite = this.add.sprite(0, 48, getProfessorById(this.p1Data?.characterId || 'so').atlasKey, 'idle')");
ms = ms.replace(/this\.fighterP2Sprite\s*=\s*this\.add\.image\(0,\s*48,\s*'prof_web_idle'\)/g, "this.fighterP2Sprite = this.add.sprite(0, 48, getProfessorById(this.p2Data?.characterId || 'web').atlasKey, 'idle')");
ms = ms.replace(/this\.fighterP1Sprite\.setTexture\(p1Prof\.idleKey\);/g, "this.fighterP1Sprite.setTexture(p1Prof.atlasKey, 'idle');");
ms = ms.replace(/this\.fighterP2Sprite\.setTexture\(p2Prof\.idleKey\);/g, "this.fighterP2Sprite.setTexture(p2Prof.atlasKey, 'idle');");
ms = ms.replace(/this\.ultPortrait\.setTexture\(winnerProf\.idleKey\);/g, "this.ultPortrait.setTexture(winnerProf.portraitKey);");
ms = ms.replace(/this\.load\.image\(p\.idleKey,\s*p\.idleUrl\);/g, "this.load.atlas(p.atlasKey, p.atlasImage, p.atlasJson);");
ms = ms.replace(/\.setDisplaySize\(76,\s*140\)/g, ".setScale(0.55)");
fs.writeFileSync('src/scenes/MainScene.js', ms, 'utf8');

console.log('Update complete');
