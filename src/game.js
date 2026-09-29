import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { MainScene } from './scenes/MainScene.js';
import { AnimationTestScene } from './scenes/AnimationTestScene.js';

export function getGameSize() {
    const height = 720;
    // No mobile, visualViewport reflete a área realmente visível (sem a barra do navegador)
    const viewport = (typeof window !== 'undefined' && window.visualViewport) ? window.visualViewport : null;
    let w = viewport ? viewport.width : ((typeof window !== 'undefined') ? window.innerWidth : 1280);
    let h = viewport ? viewport.height : ((typeof window !== 'undefined') ? window.innerHeight : 720);

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

// Configuração tipográfica moderna global para garantir nitidez cristalina em todos os textos do Phaser
if (Phaser?.GameObjects?.TextStyle?.prototype?.setStyle) {
    const originalSetStyle = Phaser.GameObjects.TextStyle.prototype.setStyle;
    Phaser.GameObjects.TextStyle.prototype.setStyle = function(style, updateText, setDefaults) {
        if (!style) style = {};
        if (setDefaults) {
            if (!style.fontFamily) {
                style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
            }
            if (style.resolution === undefined || style.resolution === 0) {
                style.resolution = 2;
            }
        }
        return originalSetStyle.call(this, style, updateText, setDefaults);
    };
}

const config = {
    type: Phaser.AUTO,
    parent: 'app',
    pixelArt: false,
    antialias: true,
    roundPixels: false,
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
    scene: [BootScene, MenuScene, CharacterSelectScene, MainScene, AnimationTestScene],
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
                // Garante que o container #app ocupe exatamente a área visível no mobile,
                // evitando que a parte de baixo do canvas fique escondida sob a barra do navegador
                const app = document.getElementById('app');
                const viewport = window.visualViewport;
                if (app && viewport) {
                    app.style.height = `${viewport.height}px`;
                    app.style.width = `${viewport.width}px`;
                }
            };
            updateSize();
            window.addEventListener('resize', updateSize);
            window.addEventListener('orientationchange', () => setTimeout(updateSize, 150));
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', updateSize);
                window.visualViewport.addEventListener('scroll', updateSize);
            }
        }
    }
};

export const game = new Phaser.Game(config);
if (typeof window !== 'undefined') {
    window.game = game;
}
