const fs = require('fs');

// Fix CharacterSelectScene.js
let cs = fs.readFileSync('src/scenes/CharacterSelectScene.js', 'utf8');
cs = cs.replace(
    /const portrait = this\.add\.sprite\(0, -6, prof\.atlasKey, 'idle'\)\.setScale\(0\.48\);\s*portrait\.setCrop\(0, 0, portrait\.width, portrait\.height \* 0\.40\);/g,
    `const maskRect = this.add.rectangle(0, -6, 94, 74, 0xffffff).setVisible(false);
            const portrait = this.add.sprite(0, 20, prof.atlasKey, 'idle').setScale(0.42);
            portrait.setMask(maskRect.createBitmapMask());`
);
cs = cs.replace(
    /container\.add\(\[bg, portrait, nameText, tag1P, tag2P\]\);/g,
    "container.add([bg, maskRect, portrait, nameText, tag1P, tag2P]);"
);
fs.writeFileSync('src/scenes/CharacterSelectScene.js', cs, 'utf8');

// Fix MainScene.js
let ms = fs.readFileSync('src/scenes/MainScene.js', 'utf8');
ms = ms.replace(
    /this\.p1Portrait = this\.add\.sprite\(56, 102, getProfessorById\(this\.p1Data\?\.characterId \|\| 'so'\)\.atlasKey, 'idle'\)\.setScale\(0\.48\);\s*this\.p1Portrait\.setCrop\(0, 0, this\.p1Portrait\.width, this\.p1Portrait\.height \* 0\.40\);/g,
    `const maskRectP1 = this.add.rectangle(56, 94, 66, 66, 0xffffff).setVisible(false);
        this.p1Portrait = this.add.sprite(56, 114, getProfessorById(this.p1Data?.characterId || 'so').atlasKey, 'idle').setScale(0.40);
        this.p1Portrait.setMask(maskRectP1.createBitmapMask());`
);
ms = ms.replace(
    /this\.p2Portrait = this\.add\.sprite\(968, 102, getProfessorById\(this\.p2Data\?\.characterId \|\| 'web'\)\.atlasKey, 'idle'\)\.setScale\(0\.48\)\.setFlipX\(true\);\s*this\.p2Portrait\.setCrop\(0, 0, this\.p2Portrait\.width, this\.p2Portrait\.height \* 0\.40\);/g,
    `const maskRectP2 = this.add.rectangle(968, 94, 66, 66, 0xffffff).setVisible(false);
        this.p2Portrait = this.add.sprite(968, 114, getProfessorById(this.p2Data?.characterId || 'web').atlasKey, 'idle').setScale(0.40).setFlipX(true);
        this.p2Portrait.setMask(maskRectP2.createBitmapMask());`
);
fs.writeFileSync('src/scenes/MainScene.js', ms, 'utf8');

console.log('Fixed masks!');
