import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { MainScene } from './scenes/MainScene.js';

export function getGameSize() {
    const height = 720;
    let w = (typeof window !== 'undefined') ? window.innerWidth : 1280;
    let h = (typeof window !== 'undefined') ? window.innerHeight : 720;

    if (typeof document !== 'undefined') {
        const app = document.getElementById('app');
        if (app && app.clientWidth > 0 && app.clientHeight > 0) {
            w = app.clientWidth;
            h = app.clientHeight;
        }
    }

    const aspect = (w && h) ? (w / h) : (16 / 9);
    const clampedAspect = Math.max(1.2, Math.min(3.6, aspect));
    const width = Math.round(height * clampedAspect);
    return { width, height };
}

const initialSize = getGameSize();

const config = {
    type: Phaser.AUTO,
    parent: 'app',
    pixelArt: true,
    autoFocus: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: initialSize.width,
        height: initialSize.height
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
            const updateSize = () => {
                if (game && game.scale) {
                    const newSize = getGameSize();
                    if (game.scale.width !== newSize.width || game.scale.height !== newSize.height) {
                        game.scale.resize(newSize.width, newSize.height);
                    }
                    game.scale.refresh();
                }
            };
            updateSize();
            window.addEventListener('resize', updateSize);
        }
    }
};

export const game = new Phaser.Game(config);
if (typeof window !== 'undefined') {
    window.game = game;
}
