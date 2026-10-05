// Contrato código ↔ sprites: nenhum frame de atlas referenciado nas cenas pode
// faltar nos atlases dos professores. Protege contra regenerar sprites com
// nomes de frame diferentes (pipeline separar_poses.py) ou usar frame inexistente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { professors } from '../src/professors.js';
import { ROOT, atlasFrameNames } from './helpers.js';

const SCENE_FILES = [
    'src/scenes/MainScene.js',
    'src/scenes/CharacterSelectScene.js',
    'src/scenes/AnimationTestScene.js'
];

// Nomes de frame válidos no contrato código ↔ sprites.
// Só conta se o trecho ENTRE ASPAS for EXATAMENTE o nome do frame —
// assim eventos ('dev-ultimate') e mensagens ('...ultimate do GM:')
// não viram falso-positivo de frame.
const FRAME_NAMES = new Set([
    'idle', 'walk1', 'walk2', 'walk3', 'walk4',
    'run1', 'run2', 'run3', 'run4',
    'attack1', 'attack2', 'attack3', 'attack4',
    'defense', 'ready', 'special', 'hit', 'stun',
    'down', 'getup', 'jump', 'fall1', 'fall2', 'ko',
    'ult1', 'ult2', 'ult3', 'projetil', 'impacto'
]);

// Frames referenciados no código que podem faltar em atlases específicos
// (entregas parciais documentadas — remover a entrada quando completar).
const FRAMES_PENDENTES = {
    // (vazio — todas as entregas de ultimate estão completas)
};

function extractReferencedFrames(source) {
    const quoted = source.match(/'[^'\n]{1,40}'/g) || [];
    const frames = new Set();
    for (const token of quoted) {
        const inner = token.slice(1, -1);
        if (FRAME_NAMES.has(inner)) frames.add(inner);
    }
    return frames;
}

// MainScene precisa registrar as anims de caminhada (walk1..4) e ataque (attack1+attack4)
test('MainScene registra as animações _walk (walk1-4) e _attack (attack1+attack4)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/scenes/MainScene.js'), 'utf-8');
    for (const f of ['walk1', 'walk2', 'walk3', 'walk4', 'attack1', 'attack4']) {
        assert.ok(src.includes(`'${f}'`), `MainScene não referencia o frame '${f}'`);
    }
});

test('frames usados no código existem em TODOS os atlases', () => {
    const used = new Set();
    for (const rel of SCENE_FILES) {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
        for (const f of extractReferencedFrames(src)) used.add(f);
    }
    // Garantia de sanidade: a coleta tem que achar os frames centrais da luta.
    for (const expected of ['idle', 'hit', 'defense', 'attack2']) {
        assert.ok(used.has(expected), `coleta não achou o frame '${expected}' usado na luta`);
    }

    for (const p of professors) {
        const atlas = new Set(atlasFrameNames(p.atlasJson));
        const pendentes = new Set(FRAMES_PENDENTES[p.id] || []);
        for (const frame of used) {
            if (pendentes.has(frame)) continue;
            assert.ok(atlas.has(frame),
                `código usa o frame '${frame}', mas o atlas de "${p.id}" não o contém`);
        }
    }
});
