const fs = require('fs');
let cs = fs.readFileSync('src/scenes/CharacterSelectScene.js', 'utf8');

cs = cs.replace(
    /const portrait = this\.add\.sprite\(0, -6, prof\.atlasKey, 'idle'\)\.setScale\(0\.24\);/g,
    `const maskShape = this.make.graphics();
            maskShape.fillStyle(0xffffff);
            maskShape.fillRect(x - 47, cardY - 37, 94, 74);
            const mask = maskShape.createGeometryMask();
            const portrait = this.add.sprite(0, 15, prof.atlasKey, 'idle').setScale(0.40);
            portrait.setMask(mask);`
);

fs.writeFileSync('src/scenes/CharacterSelectScene.js', cs, 'utf8');
console.log('updated CSS');
