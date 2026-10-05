// Contrato da ponte DOM ↔ Phaser:
// 1) Todo CustomEvent do contrato tem produtor e ouvinte reais no código.
// 2) Todo id de DOM usado pelas cenas existe no index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.js';

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

const SRC = {
    'index.html': read('index.html'),
    'src/scenes/MenuScene.js': read('src/scenes/MenuScene.js'),
    'src/scenes/MainScene.js': read('src/scenes/MainScene.js'),
    'src/scenes/CharacterSelectScene.js': read('src/scenes/CharacterSelectScene.js'),
    'src/audio/SoundManager.js': read('src/audio/SoundManager.js'),
    'src/logger.js': read('src/logger.js'),
    'src/game.js': read('src/game.js')
};

function dispatches(source, eventName) {
    return source.includes(`CustomEvent('${eventName}'`) || source.includes(`CustomEvent("${eventName}"`);
}
function listens(source, eventName) {
    return source.includes(`addEventListener('${eventName}'`) || source.includes(`addEventListener("${eventName}"`);
}

// Contrato de eventos: produtores -> ouvintes (ver AGENTS.md §8).
// consumer null = evento público ainda sem consumidor (não quebra, mas documentado).
const EVENT_CONTRACT = [
    { event: 'open-account-modal',      producers: ['src/scenes/MenuScene.js'], consumers: ['index.html'] },
    { event: 'open-gm-modal',           producers: ['src/scenes/MenuScene.js'], consumers: ['index.html'] },
    { event: 'open-nickname-modal',     producers: ['index.html'],              consumers: ['index.html'] },
    { event: 'open-join-modal',         producers: ['src/scenes/MenuScene.js'], consumers: ['index.html'] },
    { event: 'open-profile-modal',      producers: ['src/scenes/MenuScene.js'], consumers: ['index.html'] },
    { event: 'open-ranking-modal',      producers: ['src/scenes/MenuScene.js'], consumers: ['index.html'] },
    { event: 'submit-room-code',        producers: ['index.html'],              consumers: ['src/scenes/MenuScene.js'] },
    { event: 'nickname-changed',        producers: ['index.html'],              consumers: ['src/scenes/MenuScene.js'] },
    { event: 'account-state-changed',   producers: ['index.html'],              consumers: ['src/scenes/MenuScene.js'] },
    { event: 'admin-access-changed',    producers: ['index.html'],              consumers: ['src/scenes/MenuScene.js'] },
    { event: 'dev-set-timers',          producers: ['index.html'],              consumers: ['src/scenes/MainScene.js', 'src/scenes/MenuScene.js'] },
    { event: 'dev-anim-speeds',         producers: ['index.html'],              consumers: ['src/scenes/MainScene.js'] },
    { event: 'dev-streak',              producers: ['index.html'],              consumers: ['src/scenes/MainScene.js'] },
    { event: 'dev-next-question',       producers: ['index.html'],              consumers: ['src/scenes/MainScene.js'] },
    { event: 'dev-attack',              producers: ['index.html'],              consumers: ['src/scenes/MainScene.js'] },
    { event: 'dev-special',             producers: ['index.html'],              consumers: ['src/scenes/MainScene.js'] },
    { event: 'dev-ultimate',            producers: ['index.html'],              consumers: ['src/scenes/MainScene.js'] },
    { event: 'dev-reset',               producers: ['index.html'],              consumers: ['src/scenes/MainScene.js', 'src/scenes/MenuScene.js'] },
    { event: 'labcombat-log',           producers: ['src/logger.js'],           consumers: ['index.html'] },
    { event: 'labcombat-logs-cleared',  producers: ['src/logger.js'],           consumers: ['index.html'] },
    { event: 'labcombat-mute-changed',  producers: ['src/audio/SoundManager.js'], consumers: ['src/audio/SoundManager.js'] }
];

test('todo CustomEvent do contrato tem produtor e ouvinte', () => {
    for (const { event, producers, consumers } of EVENT_CONTRACT) {
        assert.ok(
            producers.some(f => dispatches(SRC[f], event)),
            `evento '${event}': nenhum produtor dispara (esperado em: ${producers.join(', ')})`
        );
        if (consumers) {
            assert.ok(
                consumers.some(f => listens(SRC[f], event)),
                `evento '${event}': nenhum consumidor escuta (esperado em: ${consumers.join(', ')})`
            );
        }
    }
});

test('ids de DOM usados pelas cenas existem no index.html', () => {
    const html = SRC['index.html'];
    const sceneFiles = ['src/scenes/MenuScene.js', 'src/scenes/MainScene.js',
        'src/scenes/CharacterSelectScene.js', 'src/game.js'];
    const ids = new Set();
    for (const f of sceneFiles) {
        for (const m of SRC[f].matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
            ids.add(m[1]);
        }
    }
    assert.ok(ids.size > 0, 'nenhum id de DOM coletado das cenas (sanidade)');
    for (const id of ids) {
        assert.ok(
            html.includes(`id="${id}"`) || html.includes(`id='${id}'`),
            `id de DOM '${id}' usado pelo jogo não existe no index.html`
        );
    }
});
