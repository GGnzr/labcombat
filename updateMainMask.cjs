const fs = require('fs');

let ms = fs.readFileSync('src/scenes/MainScene.js', 'utf8');

ms = ms.replace(
    /this\.p1Portrait = this\.add\.sprite\(56, 94, getProfessorById\(this\.p1Data\?\.characterId \|\| 'so'\)\.atlasKey, 'idle'\)\.setScale\(0\.24\);/g,
    `const maskShapeP1 = this.make.graphics();
        maskShapeP1.fillStyle(0xffffff);
        maskShapeP1.fillRect(56 - 33, 94 - 33, 66, 66);
        const maskP1 = maskShapeP1.createGeometryMask();
        this.p1Portrait = this.add.sprite(56, 114, getProfessorById(this.p1Data?.characterId || 'so').atlasKey, 'idle').setScale(0.40);
        this.p1Portrait.setMask(maskP1);`
);

ms = ms.replace(
    /this\.p2Portrait = this\.add\.image\(968, 94, 'prof_web_portrait'\)\.setDisplaySize\(62, 62\)\.setFlipX\(true\);/g,
    `const maskShapeP2 = this.make.graphics();
        maskShapeP2.fillStyle(0xffffff);
        maskShapeP2.fillRect(968 - 33, 94 - 33, 66, 66);
        const maskP2 = maskShapeP2.createGeometryMask();
        this.p2Portrait = this.add.sprite(968, 114, getProfessorById(this.p2Data?.characterId || 'web').atlasKey, 'idle').setScale(0.40).setFlipX(true);
        this.p2Portrait.setMask(maskP2);`
);

fs.writeFileSync('src/scenes/MainScene.js', ms, 'utf8');
console.log('updated MS masks');
