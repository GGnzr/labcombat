import Phaser from 'phaser';
import { professors, getProfessorById } from '../professors.js';
import { SoundManager } from '../audio/SoundManager.js';
import { createSmoothButton } from '../ui/smoothUI.js';

// FPS padrão das animações (mesmos defaults da MainScene).
// O painel GM sobrescreve via localStorage ('dev_anim_*_fps') e avisa em
// tempo real pelo evento 'dev-anim-speeds'.
const DEFAULT_FPS = { walk: 8, attack: 8, special: 7, ult: 7 };

function loadAnimFps() {
    return {
        walk: parseInt(localStorage.getItem('dev_anim_walk_fps'), 10) || DEFAULT_FPS.walk,
        attack: parseInt(localStorage.getItem('dev_anim_attack_fps'), 10) || DEFAULT_FPS.attack,
        special: parseInt(localStorage.getItem('dev_anim_special_fps'), 10) || DEFAULT_FPS.special,
        ult: parseInt(localStorage.getItem('dev_anim_ult_fps'), 10) || DEFAULT_FPS.ult
    };
}

/**
 * Tela para testar EXATAMENTE as animações que o jogo implementa:
 *   idle | walk (loop) | ataque (avança→attack1→4→volta) | hit | defesa |
 *   especial (ult1→3 + projetil 60% → impacto) | ultimate (idem, projétil cheio)
 * Mesmos frames, FPS e timings da MainScene.
 */
export class AnimationTestScene extends Phaser.Scene {
    constructor() {
        super('AnimationTestScene');
    }

    preload() {
        professors.forEach((prof) => {
            this.load.atlas(prof.atlasKey, prof.atlasImage, prof.atlasJson);
        });
    }

    create() {
        const width = this.scale.width;
        const centerX = width / 2;

        this.add.rectangle(centerX, 360, width, 720, 0x111827);
        this.add.rectangle(centerX, 42, width, 84, 0x1e293b, 0.98);
        this.add.line(centerX, 84, 0, 0, width, 0, 0x475569).setLineWidth(1);

        createSmoothButton(this, 72, 42, 108, 32, '← Menu', {
            radius: 16,
            fillColor: 0x7f1d1d,
            hoverFillColor: 0x991b1b,
            strokeColor: 0xb91c1c,
            fontSize: '12px',
            onClick: () => this.scene.start('MenuScene')
        });

        this.add.text(centerX, 28, 'TESTE DE ANIMAÇÕES', {
            fontSize: '23px', fill: '#f59e0b', fontStyle: 'bold', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5);
        this.add.text(centerX, 58, 'Replica fiel do comportamento em jogo (frames, FPS e timings da batalha)', {
            fontSize: '12px', fill: '#94a3b8', resolution: 2
        }).setOrigin(0.5);

        this.baseX = centerX - 150;   // posição de repouso do lutador
        this.baseY = 470;
        this.dir = 1;                 // 1 = olhando p/ direita, -1 = p/ esquerda
        this.targetX = centerX + 330; // alvo onde o projetil acerta
        this.animFps = loadAnimFps();

        this.createAnimations();
        this.createProfessorSelector(centerX);
        this.createStage(centerX);
        this.createControls(centerX);

        // Painel GM: aplica novos FPS sem recarregar a cena
        this.onDevAnimSpeeds = (e) => {
            const { walk, attack, special, ult } = e.detail || {};
            if (walk) this.animFps.walk = walk;
            if (attack) this.animFps.attack = attack;
            if (special) this.animFps.special = special;
            if (ult) this.animFps.ult = ult;
            this.recreateAnimations();
        };
        window.addEventListener('dev-anim-speeds', this.onDevAnimSpeeds);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('dev-anim-speeds', this.onDevAnimSpeeds);
        });

        SoundManager.createMuteButton(this, width - 36, 42);
        this.selectProfessor('so');
    }

    recreateAnimations() {
        professors.forEach((prof) => {
            ['walk', 'attack', 'ult', 'special'].forEach((name) => {
                const key = `${prof.atlasKey}_${name}`;
                if (this.anims.exists(key)) this.anims.remove(key);
            });
        });
        this.createAnimations();
    }

    createAnimations() {
        // Idêntico a MainScene.createFighterAnimations
        professors.forEach((prof) => {
            const prefix = `${prof.atlasKey}_`;
            const register = (name, frames, frameRate, repeat = 0) => {
                const key = `${prefix}${name}`;
                if (!this.anims.exists(key)) {
                    this.anims.create({
                        key,
                        frames: frames.map(frame => ({ key: prof.atlasKey, frame })),
                        frameRate,
                        repeat
                    });
                }
            };
            register('walk', ['walk1', 'walk2', 'walk3', 'walk4'], this.animFps.walk, -1);
            register('attack', ['attack1', 'attack4'], this.animFps.attack);
            const tex = this.textures.get(prof.atlasKey);
            if (tex && ['ult1', 'ult2', 'ult3'].every((f) => tex.has(f))) {
                register('ult', ['ult1', 'ult2', 'ult3'], this.animFps.ult);
                // Especial: mesmos frames do ultimate, mas com FPS próprio
                register('special', ['ult1', 'ult2', 'ult3'], this.animFps.special);
            }
        });
    }

    createProfessorSelector(centerX) {
        this.add.text(centerX, 112, 'PERSONAGEM', {
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5);

        this.professorButtons = [];
        const spacing = Math.min(170, (this.scale.width - 80) / professors.length);
        const startX = centerX - ((professors.length - 1) * spacing) / 2;
        professors.forEach((prof, index) => {
            const button = createSmoothButton(this, startX + index * spacing, 148, Math.min(150, spacing - 8), 34, prof.shortName, {
                radius: 17,
                fillColor: 0x242a35,
                hoverFillColor: 0x334155,
                strokeColor: 0x475569,
                textColor: '#cbd5e1',
                fontSize: '10px',
                onClick: () => this.selectProfessor(prof.id)
            });
            this.professorButtons.push({ button, id: prof.id });
        });
    }

    createStage(centerX) {
        // Palco
        this.add.ellipse(this.baseX, this.baseY + 8, 300, 44, 0x000000, 0.35);
        this.add.ellipse(this.baseX, this.baseY + 8, 268, 36).setStrokeStyle(2, 0x38bdf8, 0.7);

        // Marcador do alvo (onde o projetil do ultimate bate)
        const alvo = this.add.graphics();
        alvo.lineStyle(2, 0xf87171, 0.85);
        alvo.strokeCircle(this.targetX, this.baseY - 130, 22);
        alvo.strokeCircle(this.targetX, this.baseY - 130, 6).fillStyle(0xf87171, 0.6).fillCircle(this.targetX, this.baseY - 130, 6);
        this.add.text(this.targetX, this.baseY - 92, 'ALVO', {
            fontSize: '11px', fill: '#f87171', fontStyle: 'bold', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5);

        this.fighter = this.add.container(this.baseX, this.baseY);
        this.previewSprite = this.add.sprite(0, 0, 'atlas_so', 'idle').setOrigin(0.5, 1);
        this.fighter.add(this.previewSprite);

        this.previewName = this.add.text(centerX, 188, '', {
            fontSize: '17px', fill: '#f8fafc', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        this.previewState = this.add.text(centerX, 214, 'IDLE', {
            fontSize: '12px', fill: '#38bdf8', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        this.previewFrame = this.add.text(centerX, 236, '', {
            fontSize: '10px', fill: '#64748b', resolution: 2
        }).setOrigin(0.5);
    }

    createControls(centerX) {
        this.add.text(centerX, 545, 'AÇÕES EM JOGO', {
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5);

        const controls = [
            ['idle', () => this.actIdle()],
            ['walk', () => this.actWalk()],
            ['ataque', () => this.actAttack()],
            ['hit', () => this.actDamage(false)],
            ['defesa', () => this.actDamage(true)],
            ['especial', () => this.actSpecial()],
            ['ultimate', () => this.actUltimate()],
            ['espelhar', () => this.toggleFlip()]
        ];
        const spacing = 130;
        const startX = centerX - ((controls.length - 1) * spacing) / 2;
        controls.forEach(([label, action], index) => {
            createSmoothButton(this, startX + index * spacing, 590, 120, 38, label, {
                radius: 19,
                fillColor: 0x2563eb,
                hoverFillColor: 0x3b82f6,
                strokeColor: 0x60a5fa,
                fontSize: '11px',
                onClick: action
            });
        });

        this.add.text(centerX, 652, 'Mesma lógica da MainScene: ataque avança e volta • hit/defesa piscam e tremem • especial = projetil 60% • ultimate = projetil cheio.', {
            fontSize: '11px', fill: '#64748b', resolution: 2
        }).setOrigin(0.5);
    }

    // ===== seleção / utilidades =====

    selectProfessor(professorId) {
        this.selectedProfessor = getProfessorById(professorId);
        const prof = this.selectedProfessor;
        this.tweens.killTweensOf(this.fighter);
        this.previewSprite.stop();
        this.previewSprite.setTexture(prof.atlasKey, 'idle');
        this.previewSprite.setScale((prof.scale || 0.65) * 1.25);
        this.fighter.setPosition(this.baseX, this.baseY);
        this.fighter.setAlpha(1);
        this.previewName.setText(prof.name);
        this.setState('idle');
        this.professorButtons.forEach(({ button, id }) => {
            button.setStyle({
                fill: id === professorId ? '#f59e0b' : '#cbd5e1',
                backgroundColor: id === professorId ? '#854d0e' : '#242a35'
            });
        });
    }

    setState(state) {
        this.previewState.setText(state.toUpperCase());
        this.updateFrameInfo();
    }

    updateFrameInfo() {
        const frame = this.previewSprite.frame;
        if (!frame) { this.previewFrame.setText(''); return; }
        this.previewFrame.setText(`frame "${frame.name}"  ${frame.width}×${frame.height}px`);
    }

    setFighterIdle() {
        const atlasKey = this.selectedProfessor.atlasKey;
        if (!this.previewSprite?.active) return;
        this.previewSprite.stop();
        this.previewSprite.setTexture(atlasKey, 'idle');
        this.setState('idle');
    }

    toggleFlip() {
        this.previewSprite.toggleFlipX();
        this.dir = this.previewSprite.flipX ? -1 : 1;
        this.setState(`espelhado: ${this.previewSprite.flipX ? 'ESQUERDA' : 'DIREITA'}`);
    }

    // ===== ações (espelho das da MainScene) =====

    actIdle() {
        this.tweens.killTweensOf(this.fighter);
        this.fighter.setPosition(this.baseX, this.baseY).setAlpha(1);
        this.setFighterIdle();
    }

    actWalk() {
        this.previewSprite.play(`${this.selectedProfessor.atlasKey}_walk`);
        this.setState(`walk (loop ${this.animFps.walk}fps)`);
    }

    // playAttack: avança, golpeia (attack1→4 @ 8fps), volta
    actAttack() {
        const sprite = this.previewSprite;
        const atlasKey = this.selectedProfessor.atlasKey;
        this.tweens.killTweensOf(this.fighter);
        sprite.play(`${atlasKey}_walk`);
        this.setState('walk → ataque');
        this.tweens.add({
            targets: this.fighter,
            x: this.baseX + 125 * this.dir,
            duration: 320,
            ease: 'Power1',
            onComplete: () => {
                sprite.play(`${atlasKey}_attack`);
                this.setState(`attack 1→4 (${this.animFps.attack}fps)`);
                SoundManager.playPunch();
                sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                    this.tweens.add({
                        targets: this.fighter,
                        x: this.baseX,
                        delay: 220,
                        duration: 280,
                        ease: 'Power1',
                        onComplete: () => this.setFighterIdle()
                    });
                });
            }
        });
    }

    // playDamage: frame hit/defense + tremor + piscada
    actDamage(isBlocked) {
        const atlasKey = this.selectedProfessor.atlasKey;
        this.previewSprite.stop();
        this.previewSprite.setTexture(atlasKey, isBlocked ? 'defense' : 'hit');
        this.setState(isBlocked ? 'defense (320ms)' : 'hit (220ms)');
        if (isBlocked) SoundManager.playShield(); else SoundManager.playPunch();
        this.tweens.killTweensOf(this.fighter);
        this.tweens.add({ targets: this.fighter, x: this.baseX + 12, duration: 50, yoyo: true, repeat: 4 });
        this.tweens.add({ targets: this.fighter, alpha: 0.3, duration: 100, yoyo: true, repeat: 2 });
        this.time.delayedCall(isBlocked ? 320 : 220, () => {
            if (this.previewSprite.active) this.setFighterIdle();
        });
    }

    // playSpecial (especial carregado, -28 HP): ult1→3 @ 7fps, projetil aos
    // ~300ms com efeito REDUZIDO (0.6), idle aos 650ms
    actSpecial() {
        const atlasKey = this.selectedProfessor.atlasKey;
        const sprite = this.previewSprite;
        const temUlt = this.anims.exists(`${atlasKey}_special`);

        this.tweens.killTweensOf(this.fighter);
        this.fighter.setPosition(this.baseX, this.baseY).setAlpha(1);

        if (temUlt) {
            sprite.play(`${atlasKey}_special`);
            this.setState(`especial: ult1→3 (${this.animFps.special}fps) + projetil (60%)`);
            SoundManager.playSpecial();
            this.time.delayedCall(300, () => this.lancarEfeitoUltimate(atlasKey, 0.6));
            this.time.delayedCall(650, () => this.setFighterIdle());
            return;
        }

        // Legado: avança (walk), attack2, volta
        this.setState('especial legado (walk → attack2)');
        sprite.play(`${atlasKey}_walk`);
        this.tweens.add({
            targets: this.fighter,
            x: this.baseX + 125 * this.dir,
            duration: 320,
            ease: 'Power1',
            onComplete: () => {
                sprite.setTexture(atlasKey, 'attack2');
                SoundManager.playSpecial();
                this.time.delayedCall(650, () => this.setFighterIdle());
                this.tweens.add({
                    targets: this.fighter,
                    x: this.baseX,
                    delay: 240,
                    duration: 280,
                    ease: 'Power1'
                });
            }
        });
    }

    // playFinisherAttack (ultimate): mesmos timings do especial, mas projetil
    // em TAMANHO CHEIO (escala 1)
    actUltimate() {
        const atlasKey = this.selectedProfessor.atlasKey;
        const sprite = this.previewSprite;
        const temUlt = this.anims.exists(`${atlasKey}_ult`);

        this.tweens.killTweensOf(this.fighter);
        this.fighter.setPosition(this.baseX, this.baseY).setAlpha(1);

        if (temUlt) {
            sprite.play(`${atlasKey}_ult`);
            this.setState(`ultimate: ult1→3 (${this.animFps.ult}fps) + projetil (tamanho cheio)`);
            SoundManager.playSpecial();
            this.time.delayedCall(300, () => this.lancarEfeitoUltimate(atlasKey, 1));
            this.time.delayedCall(650, () => this.setFighterIdle());
        } else {
            // Legado: avança, attack2, volta
            sprite.setTexture(atlasKey, 'idle');
            this.setState('ultimate legado (attack2)');
            this.tweens.add({
                targets: this.fighter,
                x: this.baseX + 125 * this.dir,
                duration: 220,
                ease: 'Power1',
                onComplete: () => {
                    sprite.setTexture(atlasKey, 'attack2');
                    SoundManager.playSpecial();
                    this.time.delayedCall(350, () => {
                        this.tweens.add({
                            targets: this.fighter,
                            x: this.baseX,
                            duration: 260,
                            ease: 'Power1',
                            onComplete: () => this.setFighterIdle()
                        });
                    });
                }
            });
        }
    }

    // lancarEfeitoUltimate (igual à MainScene: projetil da mão → alvo, impacto cresce)
    lancarEfeitoUltimate(atlasKey, escalaEfeito = 1) {
        const tex = this.textures.get(atlasKey);
        const temProjetil = tex?.has('projetil');
        const temImpacto = tex?.has('impacto');
        if (!temProjetil && !temImpacto) return;

        const sprite = this.previewSprite;
        if (!sprite?.active) return;

        const escala = (sprite.scaleX || 0.65) * escalaEfeito;
        const xAlvo = this.targetX;
        const yAlvo = this.baseY - 130;

        const mostrarImpacto = () => {
            if (!temImpacto) return;
            const imp = this.add.sprite(xAlvo, yAlvo, atlasKey, 'impacto')
                .setOrigin(0.5, 0.5)
                .setScale(escala * 0.55)
                .setFlipX(!!sprite.flipX)
                .setDepth(7);
            this.tweens.add({ targets: imp, scale: escala, duration: 200, ease: 'Back.easeOut' });
            this.time.delayedCall(750, () => imp.destroy());
        };

        if (temProjetil) {
            const charW = sprite.displayWidth || 100;
            const charH = sprite.displayHeight || 200;
            const proj = this.add.sprite(
                this.fighter.x + (charW * 0.35 * this.dir),
                this.baseY - (charH * 0.55),
                atlasKey, 'projetil'
            )
                .setOrigin(0.5, 0.5)
                .setScale(escala)
                .setFlipX(!!sprite.flipX)
                .setDepth(6);

            this.tweens.add({
                targets: proj,
                x: xAlvo,
                y: yAlvo,
                duration: 340,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    proj.destroy();
                    mostrarImpacto();
                }
            });
        } else {
            mostrarImpacto();
        }
    }
}
