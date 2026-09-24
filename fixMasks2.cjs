const fs = require('fs');

let cs = fs.readFileSync('src/scenes/CharacterSelectScene.js', 'utf8');
// Revert container.add back
cs = cs.replace(
    /container\.add\(\[bg, maskRect, portrait, nameText, tag1P, tag2P\]\);/g,
    "container.add([bg, portrait, nameText, tag1P, tag2P]);"
);

cs = cs.replace(
    /const maskRect = this\.add\.rectangle\(0, -6, 94, 74, 0xffffff\)\.setVisible\(false\);\s*const portrait = this\.add\.sprite\(0, 20, prof\.atlasKey, 'idle'\)\.setScale\(0\.42\);\s*portrait\.setMask\(maskRect\.createBitmapMask\(\)\);/g,
    `const maskShape = this.add.graphics();
            maskShape.fillRect(x - 47, cardY - 37, 94, 74);
            const portrait = this.add.sprite(0, 20, prof.atlasKey, 'idle').setScale(0.42);
            portrait.setMask(maskShape.createGeometryMask());`
);
fs.writeFileSync('src/scenes/CharacterSelectScene.js', cs, 'utf8');

let ms = fs.readFileSync('src/scenes/MainScene.js', 'utf8');
ms = ms.replace(
    /const maskRectP1 = this\.add\.rectangle\(56, 94, 66, 66, 0xffffff\)\.setVisible\(false\);\s*this\.p1Portrait = this\.add\.sprite\(56, 114, getProfessorById\(this\.p1Data\?\.characterId \|\| 'so'\)\.atlasKey, 'idle'\)\.setScale\(0\.40\);\s*this\.p1Portrait\.setMask\(maskRectP1\.createBitmapMask\(\)\);/g,
    `const maskShapeP1 = this.add.graphics();
        maskShapeP1.fillRect(56 - 33, 94 - 33, 66, 66);
        this.p1Portrait = this.add.sprite(56, 114, getProfessorById(this.p1Data?.characterId || 'so').atlasKey, 'idle').setScale(0.40);
        this.p1Portrait.setMask(maskShapeP1.createGeometryMask());`
);
ms = ms.replace(
    /const maskRectP2 = this\.add\.rectangle\(968, 94, 66, 66, 0xffffff\)\.setVisible\(false\);\s*this\.p2Portrait = this\.add\.sprite\(968, 114, getProfessorById\(this\.p2Data\?\.characterId \|\| 'web'\)\.atlasKey, 'idle'\)\.setScale\(0\.40\)\.setFlipX\(true\);\s*this\.p2Portrait\.setMask\(maskRectP2\.createBitmapMask\(\)\);/g,
    `const maskShapeP2 = this.add.graphics();
        maskShapeP2.fillRect(968 - 33, 94 - 33, 66, 66);
        this.p2Portrait = this.add.sprite(968, 114, getProfessorById(this.p2Data?.characterId || 'web').atlasKey, 'idle').setScale(0.40).setFlipX(true);
        this.p2Portrait.setMask(maskShapeP2.createGeometryMask());`
);
fs.writeFileSync('src/scenes/MainScene.js', ms, 'utf8');

console.log('Fixed masks back to geometry!');
