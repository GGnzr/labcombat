import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Load assets here later
    }

    create() {
        this.add.text(20, 20, 'Loading LabCombat...', { fill: '#fff' });
        
        // Move to the MenuScene after a short delay
        this.time.delayedCall(500, () => {
            this.scene.start('MenuScene');
        });
    }
}
