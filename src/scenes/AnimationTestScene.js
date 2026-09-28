import Phaser from 'phaser';
import { professors, getProfessorById } from '../professors.js';
import { SoundManager } from '../audio/SoundManager.js';
import { createSmoothButton } from '../ui/smoothUI.js';

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
        this.add.text(centerX, 58, 'Selecione um personagem e teste os frames do atlas', {
            fontSize: '12px', fill: '#94a3b8', resolution: 2
        }).setOrigin(0.5);

        this.createAnimations();
        this.createProfessorSelector(centerX);
        this.createPreview(centerX);
        this.createAnimationControls(centerX);

        SoundManager.createMuteButton(this, width - 36, 42);
        this.selectProfessor('so');
    }

    createAnimations() {
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

            register('walk', ['walk1', 'walk2', 'walk3', 'walk4'], 8, -1);
            register('attack14', ['attack1', 'attack4'], 8);
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

    createPreview(centerX) {
        this.add.ellipse(centerX, 430, 260, 42, 0x000000, 0.35);
        this.add.ellipse(centerX, 430, 230, 34).setStrokeStyle(2, 0x38bdf8, 0.7);
        this.previewSprite = this.add.sprite(centerX, 430, 'atlas_so', 'idle')
            .setOrigin(0.5, 1)
            .setScale(0.85);
        this.previewName = this.add.text(centerX, 188, '', {
            fontSize: '17px', fill: '#f8fafc', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        this.previewState = this.add.text(centerX, 214, 'idle', {
            fontSize: '12px', fill: '#38bdf8', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
    }

    createAnimationControls(centerX) {
        this.add.text(centerX, 488, 'ANIMAÇÕES', {
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5);

        const controls = [
            ['idle', () => this.playIdle()],
            ['walk1–4', () => this.playWalk()],
            ['defense', () => this.playPose('defense', 650)],
            ['hit', () => this.playPose('hit', 500)],
            ['especial', () => this.playPose('attack2', 800)],
            ['attack1 → 4', () => this.playAttack()]
        ];
        const spacing = 150;
        const startX = centerX - ((controls.length - 1) * spacing) / 2;
        controls.forEach(([label, action], index) => {
            createSmoothButton(this, startX + index * spacing, 528, 132, 38, label, {
                radius: 19,
                fillColor: 0x2563eb,
                hoverFillColor: 0x3b82f6,
                strokeColor: 0x60a5fa,
                fontSize: '11px',
                onClick: action
            });
        });

        this.add.text(centerX, 600, 'As animações usam os frames originais dos atlas Phaser.', {
            fontSize: '11px', fill: '#64748b', resolution: 2
        }).setOrigin(0.5);
    }

    selectProfessor(professorId) {
        this.selectedProfessor = getProfessorById(professorId);
        const prof = this.selectedProfessor;
        this.previewSprite.setTexture(prof.atlasKey, 'idle');
        this.previewSprite.setScale((prof.scale || 0.65) * 1.25);
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
    }

    playIdle() {
        this.previewSprite.stop();
        this.previewSprite.setTexture(this.selectedProfessor.atlasKey, 'idle');
        this.setState('idle');
    }

    playWalk() {
        const key = `${this.selectedProfessor.atlasKey}_walk`;
        this.previewSprite.play(key);
        this.setState('walk1–4');
    }

    playPose(frame, duration) {
        this.previewSprite.stop();
        this.previewSprite.setTexture(this.selectedProfessor.atlasKey, frame);
        this.setState(frame);
        this.time.delayedCall(duration, () => {
            if (this.previewSprite.active) this.playIdle();
        });
    }

    playAttack() {
        const atlasKey = this.selectedProfessor.atlasKey;
        this.previewSprite.play(`${atlasKey}_attack14`);
        this.setState('attack1 → attack4');
        this.previewSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            if (this.previewSprite.active) this.playIdle();
        });
    }
}
