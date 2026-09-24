const fs = require('fs');

let cs = fs.readFileSync('src/scenes/CharacterSelectScene.js', 'utf8');

// Replace the mask stuff with setCrop
cs = cs.replace(/const maskShape = this\.make\.graphics\(\);\s*maskShape\.fillStyle\(0xffffff\);\s*maskShape\.fillRect\(x - 47, cardY - 37, 94, 74\);\s*const mask = maskShape\.createGeometryMask\(\);\s*const portrait = this\.add\.sprite\(0, 15, prof\.atlasKey, 'idle'\)\.setScale\(0\.40\);\s*portrait\.setMask\(mask\);/g, "const portrait = this.add.sprite(0, -6, prof.atlasKey, 'idle').setScale(0.48);\n            portrait.setCrop(0, 0, portrait.width, portrait.height * 0.40);");

fs.writeFileSync('src/scenes/CharacterSelectScene.js', cs, 'utf8');

let ms = fs.readFileSync('src/scenes/MainScene.js', 'utf8');

ms = ms.replace(/const maskShapeP1 = this\.make\.graphics\(\);\s*maskShapeP1\.fillStyle\(0xffffff\);\s*maskShapeP1\.fillRect\(56 - 33, 94 - 33, 66, 66\);\s*const maskP1 = maskShapeP1\.createGeometryMask\(\);\s*this\.p1Portrait = this\.add\.sprite\(56, 114, getProfessorById\(this\.p1Data\?\.characterId \|\| 'so'\)\.atlasKey, 'idle'\)\.setScale\(0\.40\);\s*this\.p1Portrait\.setMask\(maskP1\);/g, "this.p1Portrait = this.add.sprite(56, 102, getProfessorById(this.p1Data?.characterId || 'so').atlasKey, 'idle').setScale(0.48);\n        this.p1Portrait.setCrop(0, 0, this.p1Portrait.width, this.p1Portrait.height * 0.40);");

ms = ms.replace(/const maskShapeP2 = this\.make\.graphics\(\);\s*maskShapeP2\.fillStyle\(0xffffff\);\s*maskShapeP2\.fillRect\(968 - 33, 94 - 33, 66, 66\);\s*const maskP2 = maskShapeP2\.createGeometryMask\(\);\s*this\.p2Portrait = this\.add\.sprite\(968, 114, getProfessorById\(this\.p2Data\?\.characterId \|\| 'web'\)\.atlasKey, 'idle'\)\.setScale\(0\.40\)\.setFlipX\(true\);\s*this\.p2Portrait\.setMask\(maskP2\);/g, "this.p2Portrait = this.add.sprite(968, 102, getProfessorById(this.p2Data?.characterId || 'web').atlasKey, 'idle').setScale(0.48).setFlipX(true);\n        this.p2Portrait.setCrop(0, 0, this.p2Portrait.width, this.p2Portrait.height * 0.40);");

fs.writeFileSync('src/scenes/MainScene.js', ms, 'utf8');
console.log('Update complete');
