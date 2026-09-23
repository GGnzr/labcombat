import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { MainScene } from './scenes/MainScene.js';

const config = {
    type: Phaser.AUTO,
    parent: 'app',
    pixelArt: true,
    autoFocus: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: 1024,
        height: 576
    },
    fps: {
        target: 60,
        forceSetTimeOut: true
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [BootScene, MenuScene, CharacterSelectScene, MainScene],
    callbacks: {
        postBoot: (game) => {
            // Evita que o jogo pause ou congele o loop ao clicar no painel Dev ou mudar de aba
            game.events.off('blur');
            if (game.sound) {
                game.sound.pauseOnBlur = false;
            }
            window.addEventListener('resize', () => {
                if (game && game.scale) {
                    game.scale.refresh();
                }
            });
        }
    }
};

export const game = new Phaser.Game(config);
if (typeof window !== 'undefined') {
    window.game = game;
}
