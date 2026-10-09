/**
 * SoundManager.js - Sistema de Áudio Procedural para o LabCombat
 * Gera efeitos sonoros arcade e retrô em tempo real via Web Audio API.
 * Não requer arquivos de áudio externos (.mp3/.wav), garantindo carregamento instantâneo.
 */

class SoundManagerClass {
    constructor() {
        this.ctx = null;
        const savedVolume = parseFloat(localStorage.getItem('labcombat_volume'));
        const defaultVolume = Number.isFinite(savedVolume) ? savedVolume : 0.5;
        this.effectsVolume = this._readStoredVolume('labcombat_effects_volume', defaultVolume);
        this.musicVolume = this._readStoredVolume('labcombat_music_volume', 0.15);
        this.masterVolume = this.effectsVolume;
        this.muted = localStorage.getItem('labcombat_muted') === 'true';
        this.effectsMuted = localStorage.getItem('labcombat_effects_muted') === 'true';
        this.musicMuted = localStorage.getItem('labcombat_music_muted') === 'true';
        this.unlocked = false;
        this._bgmCurrentTrack = null;
        this._bgmRequestedTrack = null;
        this._bgmPlaying = false;

        // Desbloquear AudioContext APÓS a primeira interação do usuário
        // (política de autoplay). O contexto NÃO é criado no load: além de
        // seguir a política, evita o "bip" de abertura/fechamento do grafo
        // de áudio ao recarregar a página — mesmo com tudo mutado.
        this.setupUnlockListeners();
    }

    _readStoredVolume(key, fallback) {
        const stored = parseFloat(localStorage.getItem(key));
        return Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : fallback;
    }

    initContext() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
    }

    setupUnlockListeners() {
        if (typeof window === 'undefined') return;

        const unlock = (event) => {
            // Teclas de sistema/atalhos (F5, Ctrl+R, F12, combos com Ctrl/Alt/Meta)
            // NÃO desbloqueiam áudio: impedem o resume() numa página que está
            // sendo recarregada — era aí que "escapava" o bip no refresh.
            if (event && event.type === 'keydown') {
                if (event.ctrlKey || event.altKey || event.metaKey) return;
                if (event.key === 'F5' || event.key === 'F12') return;
            }
            if (!this.ctx) this.initContext();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    this.unlocked = true;
                    this._startRequestedBGM();
                    window.removeEventListener('pointerdown', unlock);
                    window.removeEventListener('keydown', unlock);
                    window.removeEventListener('touchstart', unlock);
                }).catch(() => {});
            } else if (this.ctx && this.ctx.state === 'running') {
                this.unlocked = true;
                this._startRequestedBGM();
            }

            // Remover listeners após primeiro desbloqueio bem sucedido
            if (this.unlocked) {
                window.removeEventListener('pointerdown', unlock);
                window.removeEventListener('keydown', unlock);
                window.removeEventListener('touchstart', unlock);
            }
        };

        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
        window.addEventListener('touchstart', unlock, { passive: true });
    }

    ensureContext() {
        if (!this.ctx) this.initContext();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx && this.ctx.state === 'running';
    }

    isMuted() {
        return this.muted;
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('labcombat_muted', this.muted ? 'true' : 'false');
        this.setMusicVolume(this.musicVolume);
        
        // Notificar componentes da UI sobre a mudança de estado
        if (typeof window !== 'undefined') {
            this._notifyMuteChange();
        }

        // Toca um clique suave ao desmutar
        if (!this.muted) {
            this.playClick();
        }

        return this.muted;
    }

    setMasterVolume(vol) {
        this.setEffectsVolume(vol);
        this.setMusicVolume(vol);
    }

    setEffectsVolume(vol) {
        this.effectsVolume = Math.max(0, Math.min(1, vol));
        this.masterVolume = this.effectsVolume;
        localStorage.setItem('labcombat_effects_volume', this.effectsVolume.toString());
        localStorage.setItem('labcombat_volume', this.effectsVolume.toString());
    }

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        localStorage.setItem('labcombat_music_volume', this.musicVolume.toString());

        if (this._bgmMasterGain && this.ctx) {
            const targetVolume = this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume;
            this._bgmMasterGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.03);
        }
    }

    _notifyMuteChange() {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('labcombat-mute-changed', {
                detail: {
                    muted: this.muted || (this.effectsMuted && this.musicMuted),
                    effectsMuted: this.effectsMuted,
                    musicMuted: this.musicMuted
                }
            }));
        }
    }

    toggleEffectsMute() {
        this.effectsMuted = !this.effectsMuted;
        localStorage.setItem('labcombat_effects_muted', this.effectsMuted ? 'true' : 'false');
        this._notifyMuteChange();
        return this.effectsMuted;
    }

    toggleMusicMute() {
        this.musicMuted = !this.musicMuted;
        localStorage.setItem('labcombat_music_muted', this.musicMuted ? 'true' : 'false');
        this.setMusicVolume(this.musicVolume);
        this._notifyMuteChange();
        return this.musicMuted;
    }

    // =========================================================================
    // SÍNTESE PROCEDURAL DE EFEITOS SONOROS (WEB AUDIO API)
    // =========================================================================
    // Todos os SFX passam por um compressor compartilhado (sfxBus): evita
    // clipping quando vários efeitos tocam juntos e dá "cola" ao mix.
    // _tone() e _noise() são os blocos de construção de todos os efeitos.

    _getSfxBus() {
        if (!this._sfxBus && this.ctx) {
            const comp = this.ctx.createDynamicsCompressor();
            comp.threshold.setValueAtTime(-18, this.ctx.currentTime);
            comp.knee.setValueAtTime(20, this.ctx.currentTime);
            comp.ratio.setValueAtTime(6, this.ctx.currentTime);
            comp.attack.setValueAtTime(0.002, this.ctx.currentTime);
            comp.release.setValueAtTime(0.12, this.ctx.currentTime);
            comp.connect(this.ctx.destination);
            this._sfxBus = comp;
        }
        return this._sfxBus;
    }

    /** Gera um buffer de ruído branco com a duração pedida. */
    _noiseBuffer(duration) {
        const ctx = this.ctx;
        const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        return buffer;
    }

    /**
     * Toca um tom sintetizado com ataque rápido e decaimento exponencial.
     * Bloco base de todos os efeitos (pitch slide e filtro opcionais).
     */
    _tone({ type = 'sine', from, to = null, at = 0, duration = 0.2, volume = 0.2,
            attack = 0.004, detune = 0, filterType = null, filterFreq = 2000,
            filterEnd = null, filterQ = 1 }) {
        const ctx = this.ctx;
        const t = ctx.currentTime + at;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, t);
        if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
        if (detune) osc.detune.setValueAtTime(detune, t);
        const vol = volume * this.effectsVolume;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        let head = osc;
        if (filterType) {
            const filter = ctx.createBiquadFilter();
            filter.type = filterType;
            filter.frequency.setValueAtTime(filterFreq, t);
            if (filterEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), t + duration);
            filter.Q.setValueAtTime(filterQ, t);
            osc.connect(filter);
            head = filter;
        }
        head.connect(gain);
        gain.connect(this._getSfxBus());
        osc.start(t);
        osc.stop(t + duration + 0.05);
    }

    /** Toca uma rajada de ruído filtrado (impactos, whooshes, explosões). */
    _noise({ at = 0, duration = 0.15, volume = 0.2, filterType = 'bandpass',
             filterFreq = 1000, filterEnd = null, filterQ = 1, attack = 0.002 }) {
        const ctx = this.ctx;
        const t = ctx.currentTime + at;
        const src = ctx.createBufferSource();
        src.buffer = this._noiseBuffer(duration + 0.05);
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, t);
        if (filterEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), t + duration);
        filter.Q.setValueAtTime(filterQ, t);
        const gain = ctx.createGain();
        const vol = volume * this.effectsVolume;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this._getSfxBus());
        src.start(t);
        src.stop(t + duration + 0.05);
    }

    /**
     * Clique tátil de botão na interface (UI Click)
     */
    playClick() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        // "Pop" arredondado: senoide morna com queda rápida de tom
        this._tone({ type: 'sine', from: 620, to: 240, duration: 0.07, volume: 0.22, attack: 0.002 });
        this._tone({ type: 'triangle', from: 1240, to: 500, duration: 0.05, volume: 0.08, attack: 0.002 });
    }

    /**
     * Som de Resposta Correta ("moeda" 16-bit: B5 → E6 com brilho de oitava)
     */
    playCorrect() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        this._tone({ type: 'square', from: 987.77, duration: 0.09, volume: 0.16,
                     filterType: 'lowpass', filterFreq: 4000 });
        this._tone({ type: 'square', from: 1318.51, at: 0.09, duration: 0.28, volume: 0.16,
                     filterType: 'lowpass', filterFreq: 4500 });
        this._tone({ type: 'triangle', from: 2637.02, at: 0.09, duration: 0.22, volume: 0.06 });
        this._tone({ type: 'sine', from: 1975.53, at: 0.09, duration: 0.28, volume: 0.05 });
    }

    /**
     * Som de Resposta Errada (Buzzer arcade descendente com sub-grave)
     */
    playWrong() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        this._tone({ type: 'sawtooth', from: 220, to: 110, duration: 0.28, volume: 0.16,
                     filterType: 'lowpass', filterFreq: 1200, filterQ: 2 });
        this._tone({ type: 'sawtooth', from: 226, to: 116, duration: 0.28, volume: 0.16,
                     filterType: 'lowpass', filterFreq: 1200, filterQ: 2 });
        this._tone({ type: 'square', from: 110, to: 55, duration: 0.28, volume: 0.10,
                     filterType: 'lowpass', filterFreq: 600 });
    }

    /**
     * Bip do Relógio de Questão (Tick nos últimos 5 segundos)
     */
    playTick() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        this._tone({ type: 'square', from: 1250, duration: 0.035, volume: 0.12,
                     filterType: 'lowpass', filterFreq: 4000 });
        this._tone({ type: 'sine', from: 2500, duration: 0.025, volume: 0.06 });
    }

    /**
     * Som de Impacto / Soco (3 camadas: corpo grave + estalo + crack médio)
     */
    playPunch() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        this._tone({ type: 'sine', from: 200, to: 40, duration: 0.16, volume: 0.55 });
        this._noise({ duration: 0.10, volume: 0.30, filterType: 'lowpass',
                      filterFreq: 2600, filterEnd: 300 });
        this._noise({ duration: 0.04, volume: 0.22, filterType: 'bandpass',
                      filterFreq: 1100, filterQ: 1.2 });
    }

    /**
     * Som de Escudo / Bloqueio / Try-Catch (Deflexão metálica com ping agudo)
     */
    playShield() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        this._tone({ type: 'square', from: 1320, to: 880, duration: 0.12, volume: 0.10,
                     filterType: 'highpass', filterFreq: 700 });
        this._tone({ type: 'square', from: 1976, to: 1318, duration: 0.14, volume: 0.08, detune: 8 });
        this._tone({ type: 'sine', from: 2637, to: 2400, duration: 0.20, volume: 0.10 });
        this._noise({ duration: 0.06, volume: 0.12, filterType: 'bandpass',
                      filterFreq: 4500, filterQ: 2 });
    }

    /**
     * Som de Golpe Especial / Carga Máxima (Riser de carregamento + descarga)
     */
    playSpecial() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        // Riser: saw subindo com o filtro abrindo (sensação de carga de energia)
        this._tone({ type: 'sawtooth', from: 160, to: 1250, duration: 0.34, volume: 0.20,
                     filterType: 'lowpass', filterFreq: 700, filterEnd: 5200, filterQ: 2 });
        this._tone({ type: 'square', from: 80, to: 640, duration: 0.34, volume: 0.10 });
        // Descarga final: explosão de ruído + pancada grave
        this._noise({ at: 0.34, duration: 0.22, volume: 0.32, filterType: 'lowpass',
                      filterFreq: 5000, filterEnd: 400 });
        this._tone({ type: 'sine', from: 320, to: 55, at: 0.34, duration: 0.24, volume: 0.40 });
    }

    /**
     * Voz do Narrador Arcade usando Web Speech API nativa
     */
    speak(text, pitch = 0.80, rate = 1.05) {
        if (this.muted || this.effectsMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.pitch = pitch;
            utterance.rate = rate;
            utterance.volume = Math.min(1.0, this.effectsVolume * 1.3);
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn('Speech synthesis unavailable:', e);
        }
    }

    /**
     * Fanfarra de Início de Round (tambor de guerra → narrador "FIGHT!" em
     * destaque → stab de metais). A voz NÃO compete com ruído: o stab só
     * entra depois que ela termina.
     */
    playFight() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;

        // 1. Tambor de guerra: dois hits graves e secos (chamada de atenção)
        this._tone({ type: 'sine', from: 160, to: 45, duration: 0.18, volume: 0.55 });
        this._noise({ duration: 0.08, volume: 0.20, filterType: 'lowpass',
                      filterFreq: 1800, filterEnd: 250 });
        this._tone({ type: 'sine', from: 160, to: 45, at: 0.22, duration: 0.22, volume: 0.65 });
        this._noise({ at: 0.22, duration: 0.10, volume: 0.25, filterType: 'lowpass',
                      filterFreq: 2200, filterEnd: 250 });

        // 2. Voz do narrador sozinha, em destaque
        this.speak('FIGHT!', 0.70, 1.0);

        // 3. Stab de metais logo após a voz (acento arcade, curto e brilhante)
        const stabAt = 0.62;
        [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
            this._tone({ type: 'sawtooth', from: f, at: stabAt, duration: 0.55, volume: 0.14,
                         filterType: 'lowpass', filterFreq: 2600, filterQ: 1.5,
                         detune: (i % 2 === 0 ? 6 : -6) });
        });
        this._noise({ at: stabAt, duration: 0.30, volume: 0.16,
                      filterType: 'highpass', filterFreq: 5000 });
    }

    /**
     * Som de K.O. / Finalização de Duelo (explosão com sub-grave → narrador →
     * cadência dramática de stabs descendentes com golpe final)
     */
    playKO() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;

        // 1. Explosão de nocaute: sub-grave pesado + estrondo com varredura
        this._tone({ type: 'sine', from: 320, to: 32, duration: 0.50, volume: 0.70 });
        this._noise({ duration: 0.80, volume: 0.45, filterType: 'lowpass',
                      filterFreq: 4200, filterEnd: 120, filterQ: 0.8, attack: 0.005 });
        this._noise({ duration: 0.12, volume: 0.30, filterType: 'bandpass',
                      filterFreq: 900, filterQ: 1 });

        // 2. Voz do narrador logo após o impacto inicial
        setTimeout(() => this.speak('K.O.!', 0.60, 0.85), 280);

        // 3. Cadência dramática: dois stabs de tensão + resolução grave
        const stab = (at, notes, dur, vol) => notes.forEach((f) =>
            this._tone({ type: 'sawtooth', from: f, at, duration: dur, volume: vol,
                         filterType: 'lowpass', filterFreq: 2200, filterQ: 1.5 }));
        stab(0.85, [440.00, 554.37, 659.25], 0.16, 0.16);  // A maior
        stab(1.05, [415.30, 523.25, 622.25], 0.16, 0.16);  // Ab maior (tensão)
        stab(1.30, [220.00, 329.63, 440.00], 0.70, 0.18);  // Resolução grave
        this._tone({ type: 'sine', from: 110, to: 30, at: 1.30, duration: 0.70, volume: 0.45 });
    }

    /**
     * Cria um botão de controle Mudo/Som (🔊 / 🔇) para ser adicionado em qualquer cena Phaser
     */
    createMuteButton(scene, x, y, options = {}) {
        const radius = options.radius || 16;
        const size = radius * 2;
        const container = scene.add.container(x, y).setDepth(options.depth || 100);

        const bgGfx = scene.add.graphics();
        const renderBg = (hover = false) => {
            bgGfx.clear();
            const fColor = hover ? 0x334155 : 0x1e293b;
            const sColor = hover ? 0x64748b : 0x475569;
            bgGfx.fillStyle(fColor, 0.95);
            bgGfx.fillCircle(0, 0, radius);
            bgGfx.lineStyle(1.5, sColor, 1);
            bgGfx.strokeCircle(0, 0, radius);
        };
        renderBg(false);
        container.add(bgGfx);

        const iconText = scene.add.text(0, 0, this.muted || (this.effectsMuted && this.musicMuted) ? '🔇' : '🔊', {
            fontSize: '15px'
        }).setOrigin(0.5);
        container.add(iconText);

        container.setSize(size, size);
        container.setInteractive({ useHandCursor: true });

        const panelSide = options.panelSide || (x < scene.scale.width / 2 ? 'right' : 'left');
        const panelX = panelSide === 'right' ? x + 20 : x - 155;
        const volumePanel = scene.add.container(panelX, y + 18).setDepth((options.depth || 100) + 1).setVisible(false);
        const panelBg = scene.add.rectangle(75, 102, 150, 204, 0x0f172a, 0.98);
        panelBg.setStrokeStyle(1, 0x475569, 1);
        volumePanel.add(panelBg);

        const createVolumeSlider = (label, value, setter, rowY) => {
            const labelText = scene.add.text(12, rowY - 16, label, {
                fontSize: '11px', fill: '#cbd5e1', fontStyle: 'bold'
            });
            const valueText = scene.add.text(138, rowY - 16, `${Math.round(value * 100)}%`, {
                fontSize: '10px', fill: '#f59e0b', fontStyle: 'bold'
            }).setOrigin(1, 0);
            const track = scene.add.rectangle(75, rowY + 5, 120, 8, 0x334155, 1);
            track.setInteractive({ useHandCursor: true });
            const fill = scene.add.rectangle(15, rowY + 5, 120 * value, 8, 0x38bdf8, 1).setOrigin(0, 0.5);
            const knob = scene.add.circle(15 + (120 * value), rowY + 5, 6, 0xf59e0b, 1);
            volumePanel.add([labelText, valueText, track, fill, knob]);

            let dragging = false;
            const update = (pointer) => {
                const bounds = track.getBounds();
                const nextValue = Math.max(0, Math.min(1, (pointer.x - bounds.left) / bounds.width));
                setter(nextValue);
                fill.width = 120 * nextValue;
                knob.x = 15 + (120 * nextValue);
                valueText.setText(`${Math.round(nextValue * 100)}%`);
            };
            const onPointerMove = (pointer) => {
                if (dragging) update(pointer);
            };
            const onPointerUp = () => {
                dragging = false;
            };

            track.on('pointerdown', (pointer) => {
                dragging = true;
                update(pointer);
            });
            scene.input.on('pointermove', onPointerMove);
            scene.input.on('pointerup', onPointerUp);
            volumePanel.once('destroy', () => {
                scene.input.off('pointermove', onPointerMove);
                scene.input.off('pointerup', onPointerUp);
            });
        };

        createVolumeSlider('Efeitos', this.effectsVolume, (value) => this.setEffectsVolume(value), 32);
        createVolumeSlider('Música', this.musicVolume, (value) => this.setMusicVolume(value), 79);

        const createMuteToggle = (label, rowY, isMuted, toggle) => {
            const button = scene.add.rectangle(75, rowY, 130, 24, 0x1e293b, 1);
            button.setStrokeStyle(1, 0x475569, 1);
            button.setInteractive({ useHandCursor: true });
            const statusText = scene.add.text(75, rowY, '', {
                fontSize: '10px', fill: '#cbd5e1', fontStyle: 'bold'
            }).setOrigin(0.5);
            const updateStatus = (muted) => {
                statusText.setText(`${label}: ${muted ? '🔇 Mudo' : '🔊 Ativo'}`);
                statusText.setColor(muted ? '#f87171' : '#86efac');
            };
            updateStatus(isMuted);
            button.on('pointerover', () => button.setFillStyle(0x334155));
            button.on('pointerout', () => button.setFillStyle(0x1e293b));
            button.on('pointerdown', () => {
                updateStatus(toggle());
                iconText.setText(this.muted || (this.effectsMuted && this.musicMuted) ? '🔇' : '🔊');
            });
            volumePanel.add([button, statusText]);
        };

        createMuteToggle('Efeitos', 122, this.effectsMuted, () => this.toggleEffectsMute());
        createMuteToggle('Música', 151, this.musicMuted, () => this.toggleMusicMute());
        createMuteToggle('Som geral', 180, this.muted, () => this.toggleMute());

        container.on('pointerover', () => {
            renderBg(true);
            scene.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 80 });
        });

        container.on('pointerout', () => {
            renderBg(false);
            scene.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 80 });
        });

        container.on('pointerdown', () => {
            volumePanel.setVisible(!volumePanel.visible);
        });

        // Ouvir alterações globais de mute (ex: de outras cenas ou abas)
        const onGlobalMute = (e) => {
            if (iconText && iconText.active) {
                const allMuted = e.detail?.muted || (e.detail?.effectsMuted && e.detail?.musicMuted);
                iconText.setText(allMuted ? '🔇' : '🔊');
            }
        };
        window.addEventListener('labcombat-mute-changed', onGlobalMute);

        container.once('destroy', () => {
            window.removeEventListener('labcombat-mute-changed', onGlobalMute);
        });

        return container;
    }

    // =========================================================================
    // SISTEMA DE MÚSICA AMBIENTE PROCEDURAL (BGM - Background Music)
    // Gera música chiptune/arcade em loop infinito via Web Audio API.
    // Dois temas: Menu (chill) e Batalha (agressivo estilo Street Fighter).
    // =========================================================================

    /**
     * Inicia a música de fundo do Menu (tema chill chiptune)
     */
    startMenuBGM() {
        this.startBGM('menu');
    }

    /**
     * Inicia a música de fundo de Batalha (tema arcade agressivo)
     */
    startBattleBGM() {
        this.startBGM('battle');
    }

    /**
     * Inicia um tema de BGM. Se outro tema estiver tocando, faz crossfade.
     * @param {'menu'|'battle'} track - Nome do tema
     */
    startBGM(track) {
        this._bgmRequestedTrack = track;
        if (!this.ensureContext()) return;

        // Se já está tocando o mesmo tema, não reinicia
        if (this._bgmCurrentTrack === track && this._bgmPlaying) return;

        // Para qualquer BGM anterior
        this.stopBGM();

        this._bgmCurrentTrack = track;
        this._bgmPlaying = true;
        this._bgmLoopCount = 0; // contador de variação por loop (acordes/frases)

        if (track === 'menu') {
            this._createMenuBGMLoop();
        } else {
            this._createBattleBGMLoop();
        }
    }

    _startRequestedBGM() {
        if (this._bgmRequestedTrack) {
            this.startBGM(this._bgmRequestedTrack);
        }
    }

    /**
     * Para a música de fundo com fade-out suave
     */
    stopBGM() {
        this._bgmPlaying = false;
        this._bgmCurrentTrack = null;

        const previousMasterGain = this._bgmMasterGain;
        if (previousMasterGain && this.ctx) {
            const now = this.ctx.currentTime;
            previousMasterGain.gain.setValueAtTime(previousMasterGain.gain.value, now);
            previousMasterGain.gain.linearRampToValueAtTime(0, now + 0.5);
        }

        // Limpar schedulers
        if (this._bgmTimeout) {
            clearTimeout(this._bgmTimeout);
            this._bgmTimeout = null;
        }

        // Desconectar nós depois do fade
        setTimeout(() => {
            if (previousMasterGain) {
                try { previousMasterGain.disconnect(); } catch(e) {}
                if (this._bgmMasterGain === previousMasterGain) {
                    this._bgmMasterGain = null;
                }
            }
        }, 600);
    }

    /**
     * Verifica se a BGM está tocando
     */
    isBGMPlaying() {
        return this._bgmPlaying === true;
    }

    // ---- TEMA DO MENU (Chiptune Lo-Fi Chill) ----
    // Progressão: Am → F → C → G (i → VI → III → VII em Lá menor)
    // BPM: 100, compasso 4/4, loop de 8 compassos

    _createMenuBGMLoop() {
        const ctx = this.ctx;
        if (!ctx) return;

        // Master gain para BGM
        this._bgmBaseVolume = 0.18;
        this._bgmMasterGain = ctx.createGain();
        this._bgmMasterGain.gain.setValueAtTime(0, ctx.currentTime);
        this._bgmMasterGain.gain.linearRampToValueAtTime(
            this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume,
            ctx.currentTime + 1.0
        );
        this._bgmMasterGain.connect(ctx.destination);

        const BPM = 100;
        const beatDur = 60 / BPM;
        const barDur = beatDur * 4;
        const loopDur = barDur * 8;

        // Progressões alternantes (2 compassos por acorde) — trocam a cada loop
        const chordSets = [
            [ { root: 220.00, notes: [220.00, 261.63, 329.63] },  // Am
              { root: 174.61, notes: [174.61, 220.00, 261.63] },  // F
              { root: 261.63, notes: [261.63, 329.63, 392.00] },  // C
              { root: 196.00, notes: [196.00, 246.94, 293.66] }], // G
            [ { root: 220.00, notes: [220.00, 261.63, 329.63] },  // Am
              { root: 164.81, notes: [164.81, 196.00, 246.94] },  // Em
              { root: 174.61, notes: [174.61, 220.00, 261.63] },  // F
              { root: 196.00, notes: [196.00, 246.94, 293.66] }], // G
            [ { root: 261.63, notes: [261.63, 329.63, 392.00] },  // C
              { root: 196.00, notes: [196.00, 246.94, 293.66] },  // G
              { root: 220.00, notes: [220.00, 261.63, 329.63] },  // Am
              { root: 174.61, notes: [174.61, 220.00, 261.63] }], // F
        ];

        // Melodia em frases de 2 compassos; cada loop remonta numa ordem diferente
        const phrases = [
            [523.25, 493.88, 440.00, 392.00, 440.00, 493.88, 523.25, 0,
             587.33, 523.25, 493.88, 440.00, 392.00, 440.00, 0, 0],
            [349.23, 392.00, 440.00, 523.25, 493.88, 440.00, 392.00, 0,
             349.23, 329.63, 293.66, 349.23, 392.00, 440.00, 0, 0],
            [523.25, 587.33, 659.25, 523.25, 493.88, 440.00, 523.25, 0,
             659.25, 587.33, 523.25, 493.88, 523.25, 587.33, 0, 0],
            [493.88, 440.00, 392.00, 440.00, 493.88, 523.25, 587.33, 0,
             493.88, 440.00, 392.00, 329.63, 293.66, 329.63, 0, 0],
        ];
        const structures = [ [0,1,2,3], [1,2,0,3], [0,3,1,2], [2,0,3,1] ];

        const scheduleLoop = () => {
            if (!this._bgmPlaying) return;
            const now = ctx.currentTime;

            // Variação por loop: outra progressão, outra ordem de frases
            const loopIdx = this._bgmLoopCount++;
            const chords = chordSets[loopIdx % chordSets.length];
            const melody = structures[loopIdx % structures.length].flatMap(pi => phrases[pi]);
            const walkBass = loopIdx % 2 === 1; // loops ímpares: baixo caminha pela quinta

            if (this._bgmMasterGain) {
                const targetVol = this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume;
                this._bgmMasterGain.gain.setValueAtTime(this._bgmMasterGain.gain.value, now);
                this._bgmMasterGain.gain.linearRampToValueAtTime(targetVol, now + 0.3);
            }

            // === BAIXO (square wave, oitava baixa) ===
            chords.forEach((chord, ci) => {
                for (let beat = 0; beat < 8; beat++) {
                    const t = now + (ci * barDur * 2) + (beat * beatDur);
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(chord.root / 2, t);
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
                    g.gain.setValueAtTime(0.12, t + beatDur * 0.4);
                    g.gain.linearRampToValueAtTime(0, t + beatDur * 0.5);
                    osc.connect(g);
                    g.connect(this._bgmMasterGain);
                    osc.start(t);
                    osc.stop(t + beatDur * 0.55);
                }
            });

            // === ACORDES PAD (triangle wave, suave) ===
            chords.forEach((chord, ci) => {
                const t = now + (ci * barDur * 2);
                const dur = barDur * 2 - 0.1;
                chord.notes.forEach(freq => {
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, t);
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.06, t + 0.3);
                    g.gain.setValueAtTime(0.06, t + dur - 0.5);
                    g.gain.linearRampToValueAtTime(0, t + dur);
                    osc.connect(g);
                    g.connect(this._bgmMasterGain);
                    osc.start(t);
                    osc.stop(t + dur + 0.05);
                });
            });

            // === MELODIA LEAD (square wave chiptune) ===
            const noteDur = beatDur / 2;
            melody.forEach((freq, i) => {
                if (freq === 0) return;
                const t = now + (i * noteDur);
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.09, t + 0.01);
                g.gain.setValueAtTime(0.09, t + noteDur * 0.7);
                g.gain.linearRampToValueAtTime(0, t + noteDur * 0.95);
                osc.connect(g);
                g.connect(this._bgmMasterGain);
                osc.start(t);
                osc.stop(t + noteDur);
            });

            // === PERCUSSÃO ===
            for (let beat = 0; beat < 32; beat++) {
                const t = now + (beat * beatDur);

                // Hi-hat (a cada tempo; nos loops ímpares, dobra p/ colcheias)
                const hatOffsets = walkBass ? [0, 0.5] : [0];
                hatOffsets.forEach((subOff) => {
                    const ht = t + (subOff * beatDur);
                    const hhBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
                    const hhData = hhBuffer.getChannelData(0);
                    for (let s = 0; s < hhData.length; s++) hhData[s] = Math.random() * 2 - 1;
                    const hh = ctx.createBufferSource();
                    hh.buffer = hhBuffer;
                    const hhF = ctx.createBiquadFilter();
                    hhF.type = 'highpass';
                    hhF.frequency.setValueAtTime(8000, ht);
                    const hhG = ctx.createGain();
                    hhG.gain.setValueAtTime(subOff ? 0.05 : 0.08, ht);
                    hhG.gain.exponentialRampToValueAtTime(0.001, ht + 0.03);
                    hh.connect(hhF);
                    hhF.connect(hhG);
                    hhG.connect(this._bgmMasterGain);
                    hh.start(ht);
                    hh.stop(ht + 0.035);
                });

                // Kick (1 e 3)
                if (beat % 4 === 0 || beat % 4 === 2) {
                    const kick = ctx.createOscillator();
                    const kickG = ctx.createGain();
                    kick.type = 'sine';
                    kick.frequency.setValueAtTime(160, t);
                    kick.frequency.exponentialRampToValueAtTime(50, t + 0.08);
                    kickG.gain.setValueAtTime(0.18, t);
                    kickG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                    kick.connect(kickG);
                    kickG.connect(this._bgmMasterGain);
                    kick.start(t);
                    kick.stop(t + 0.12);
                }

                // Snare (2 e 4)
                if (beat % 4 === 1 || beat % 4 === 3) {
                    const snBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
                    const snData = snBuffer.getChannelData(0);
                    for (let s = 0; s < snData.length; s++) snData[s] = Math.random() * 2 - 1;
                    const sn = ctx.createBufferSource();
                    sn.buffer = snBuffer;
                    const snF = ctx.createBiquadFilter();
                    snF.type = 'bandpass';
                    snF.frequency.setValueAtTime(3000, t);
                    snF.Q.setValueAtTime(0.8, t);
                    const snG = ctx.createGain();
                    snG.gain.setValueAtTime(0.10, t);
                    snG.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                    sn.connect(snF);
                    snF.connect(snG);
                    snG.connect(this._bgmMasterGain);
                    sn.start(t);
                    sn.stop(t + 0.065);
                }
            }

            this._bgmTimeout = setTimeout(() => scheduleLoop(), (loopDur - 0.5) * 1000);
        };

        scheduleLoop();
    }

    // ---- TEMA DE BATALHA (Arcade Fighter Agressivo) ----
    // Progressão: Em → C → D → B7 (i → VI → VII → V7 em Mi menor)
    // BPM: 140, intenso, estilo Street Fighter II / KOF

    _createBattleBGMLoop() {
        const ctx = this.ctx;
        if (!ctx) return;

        this._bgmBaseVolume = 0.20;
        this._bgmMasterGain = ctx.createGain();
        this._bgmMasterGain.gain.setValueAtTime(0, ctx.currentTime);
        this._bgmMasterGain.gain.linearRampToValueAtTime(
            this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume,
            ctx.currentTime + 0.8
        );
        this._bgmMasterGain.connect(ctx.destination);

        const BPM = 140;
        const beatDur = 60 / BPM;
        const barDur = beatDur * 4;
        const loopDur = barDur * 8;

        // Progressões alternantes de batalha (Em menor, estilo KOF)
        const chordSets = [
            [ { root: 164.81, notes: [164.81, 196.00, 246.94] },  // Em
              { root: 130.81, notes: [130.81, 164.81, 196.00] },  // C
              { root: 146.83, notes: [146.83, 185.00, 220.00] },  // D
              { root: 123.47, notes: [123.47, 155.56, 185.00, 220.00] } ], // B7
            [ { root: 164.81, notes: [164.81, 196.00, 246.94] },  // Em
              { root: 196.00, notes: [196.00, 246.94, 293.66] },  // G
              { root: 146.83, notes: [146.83, 185.00, 220.00] },  // D
              { root: 220.00, notes: [220.00, 277.18, 329.63] } ], // A
        ];

        // Riffs de 2 compassos; a ordem muda a cada loop (mantém a identidade do tema)
        const phrases = [
            [659.25, 622.25, 587.33, 659.25, 0, 523.25, 587.33, 0,
             659.25, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 0],
            [523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 0,
             523.25, 493.88, 440.00, 523.25, 587.33, 659.25, 0, 0],
            [587.33, 659.25, 739.99, 880.00, 0, 783.99, 739.99, 659.25,
             587.33, 659.25, 739.99, 587.33, 523.25, 587.33, 0, 0],
            [493.88, 587.33, 659.25, 739.99, 880.00, 987.77, 880.00, 739.99,
             659.25, 587.33, 493.88, 440.00, 493.88, 587.33, 659.25, 0],
        ];
        const structures = [ [0,1,2,3], [1,2,0,3], [0,3,1,2], [3,0,2,1] ];

        const scheduleLoop = () => {
            if (!this._bgmPlaying) return;
            const now = ctx.currentTime;

            // Variação por loop: outra progressão e outra ordem de riffs
            const loopIdx = this._bgmLoopCount++;
            const chords = chordSets[loopIdx % chordSets.length];
            const melody = structures[loopIdx % structures.length].flatMap(pi => phrases[pi]);
            const doubleKick = loopIdx % 2 === 1; // loops ímpares: kick extra no contratempo

            if (this._bgmMasterGain) {
                const targetVol = this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume;
                this._bgmMasterGain.gain.setValueAtTime(this._bgmMasterGain.gain.value, now);
                this._bgmMasterGain.gain.linearRampToValueAtTime(targetVol, now + 0.3);
            }

            // === BAIXO SINCOPADO (sawtooth) ===
            chords.forEach((chord, ci) => {
                const pattern = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5];
                pattern.forEach(beatOff => {
                    const t = now + (ci * barDur * 2) + (beatOff * beatDur);
                    const isOff = (beatOff % 1 !== 0);
                    const dur = isOff ? beatDur * 0.3 : beatDur * 0.4;
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    const f = ctx.createBiquadFilter();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(chord.root / 2, t);
                    f.type = 'lowpass';
                    f.frequency.setValueAtTime(800, t);
                    f.Q.setValueAtTime(2, t);
                    const vol = isOff ? 0.10 : 0.14;
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(vol, t + 0.01);
                    g.gain.setValueAtTime(vol, t + dur * 0.7);
                    g.gain.linearRampToValueAtTime(0, t + dur);
                    osc.connect(f);
                    f.connect(g);
                    g.connect(this._bgmMasterGain);
                    osc.start(t);
                    osc.stop(t + dur + 0.02);
                });
            });

            // === POWER CHORDS (sawtooth, tempos fortes) ===
            chords.forEach((chord, ci) => {
                for (let bar = 0; bar < 2; bar++) {
                    [0, 2].forEach(beat => {
                        const t = now + (ci * barDur * 2) + (bar * barDur) + (beat * beatDur);
                        const dur = beatDur * 1.2;
                        chord.notes.forEach(freq => {
                            const osc = ctx.createOscillator();
                            const g = ctx.createGain();
                            const f = ctx.createBiquadFilter();
                            osc.type = 'sawtooth';
                            osc.frequency.setValueAtTime(freq, t);
                            f.type = 'lowpass';
                            f.frequency.setValueAtTime(1800, t);
                            f.Q.setValueAtTime(1.5, t);
                            g.gain.setValueAtTime(0, t);
                            g.gain.linearRampToValueAtTime(0.05, t + 0.01);
                            g.gain.setValueAtTime(0.05, t + dur * 0.5);
                            g.gain.linearRampToValueAtTime(0, t + dur);
                            osc.connect(f);
                            f.connect(g);
                            g.connect(this._bgmMasterGain);
                            osc.start(t);
                            osc.stop(t + dur + 0.02);
                        });
                    });
                }
            });

            // === MELODIA LEAD (square wave arcade) ===
            const noteDur = beatDur / 2;
            melody.forEach((freq, i) => {
                if (freq === 0) return;
                const t = now + (i * noteDur);
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                const f = ctx.createBiquadFilter();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, t);
                f.type = 'lowpass';
                f.frequency.setValueAtTime(3500, t);
                f.Q.setValueAtTime(1.0, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.08, t + 0.008);
                g.gain.setValueAtTime(0.08, t + noteDur * 0.6);
                g.gain.linearRampToValueAtTime(0, t + noteDur * 0.9);
                osc.connect(f);
                f.connect(g);
                g.connect(this._bgmMasterGain);
                osc.start(t);
                osc.stop(t + noteDur + 0.01);
            });

            // === PERCUSSÃO PESADA ===
            const totalBeats = 32;
            for (let beat = 0; beat < totalBeats; beat++) {
                const t = now + (beat * beatDur);

                // Hi-hat em semicolcheias
                for (let sub = 0; sub < 2; sub++) {
                    const ht = t + (sub * beatDur / 2);
                    const hhBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.025), ctx.sampleRate);
                    const hhData = hhBuffer.getChannelData(0);
                    for (let s = 0; s < hhData.length; s++) hhData[s] = Math.random() * 2 - 1;
                    const hh = ctx.createBufferSource();
                    hh.buffer = hhBuffer;
                    const hhF = ctx.createBiquadFilter();
                    hhF.type = 'highpass';
                    hhF.frequency.setValueAtTime(9000, ht);
                    const hhG = ctx.createGain();
                    hhG.gain.setValueAtTime(sub === 0 ? 0.09 : 0.05, ht);
                    hhG.gain.exponentialRampToValueAtTime(0.001, ht + 0.025);
                    hh.connect(hhF);
                    hhF.connect(hhG);
                    hhG.connect(this._bgmMasterGain);
                    hh.start(ht);
                    hh.stop(ht + 0.03);
                }

                // Kick pesado (1 e 3) — loops ímpares: chute extra no contratempo
                if (beat % 4 === 0 || beat % 4 === 2 || (doubleKick && beat % 4 === 3)) {
                    const kt = (doubleKick && beat % 4 === 3) ? t + beatDur / 2 : t;
                    const kick = ctx.createOscillator();
                    const kickG = ctx.createGain();
                    kick.type = 'sine';
                    kick.frequency.setValueAtTime(200, kt);
                    kick.frequency.exponentialRampToValueAtTime(45, kt + 0.1);
                    kickG.gain.setValueAtTime(0.25, kt);
                    kickG.gain.exponentialRampToValueAtTime(0.001, kt + 0.12);
                    kick.connect(kickG);
                    kickG.connect(this._bgmMasterGain);
                    kick.start(kt);
                    kick.stop(kt + 0.13);
                }

                // Snare potente (2 e 4)
                if (beat % 4 === 1 || beat % 4 === 3) {
                    const snOsc = ctx.createOscillator();
                    const snOscG = ctx.createGain();
                    snOsc.type = 'triangle';
                    snOsc.frequency.setValueAtTime(220, t);
                    snOsc.frequency.exponentialRampToValueAtTime(130, t + 0.04);
                    snOscG.gain.setValueAtTime(0.12, t);
                    snOscG.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                    snOsc.connect(snOscG);
                    snOscG.connect(this._bgmMasterGain);
                    snOsc.start(t);
                    snOsc.stop(t + 0.07);

                    const snBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.07), ctx.sampleRate);
                    const snData = snBuffer.getChannelData(0);
                    for (let s = 0; s < snData.length; s++) snData[s] = Math.random() * 2 - 1;
                    const sn = ctx.createBufferSource();
                    sn.buffer = snBuffer;
                    const snF = ctx.createBiquadFilter();
                    snF.type = 'bandpass';
                    snF.frequency.setValueAtTime(4000, t);
                    snF.Q.setValueAtTime(1.0, t);
                    const snG = ctx.createGain();
                    snG.gain.setValueAtTime(0.14, t);
                    snG.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
                    sn.connect(snF);
                    snF.connect(snG);
                    snG.connect(this._bgmMasterGain);
                    sn.start(t);
                    sn.stop(t + 0.075);
                }
            }

            this._bgmTimeout = setTimeout(() => scheduleLoop(), (loopDur - 0.5) * 1000);
        };

        scheduleLoop();
    }
}

export const SoundManager = new SoundManagerClass();

