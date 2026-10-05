// Integridade dos dados dos professores e dos assets de sprite.
// Se este teste falhar, o jogo quebra ao carregar a luta ou a seleção.
import test from 'node:test';
import assert from 'node:assert/strict';
import { professors, getProfessorById } from '../src/professors.js';
import { existsCaseSensitive, atlasFrameNames, publicPath } from './helpers.js';
import fs from 'node:fs';

const EXPECTED_IDS = ['so', 'eng_soft', 'coringa', 'web', 'bd', 'redes'];

const REQUIRED_FIELDS = [
    'id', 'name', 'shortName', 'subject', 'quote', 'ultimateName', 'ultimateQuote',
    'color', 'portraitKey', 'portraitUrl',
    'atlasKey', 'atlasImage', 'atlasJson', 'scale'
];

// Frames que todo atlas de professor PRECISA ter (contrato com MainScene).
// Lista base gerada pelo separar_poses.py — ver AGENTS.md §7.
// + Frames de ultimate mesclados por merge_ultimates.py (animação {atlasKey}_ult
//   na MainScene: ult1..ult3 no lutador; projetil/impacto como sprites soltos).
const REQUIRED_ATLAS_FRAMES = [
    'idle', 'walk1', 'walk2', 'walk3', 'walk4',
    'run1', 'run2', 'run3', 'run4',
    'attack1', 'attack2', 'attack3', 'attack4',
    'defense', 'ready', 'special', 'hit', 'stun',
    'down', 'getup', 'jump', 'fall1', 'fall2',
    'ult1', 'ult2', 'ult3', 'projetil', 'impacto'
];

// Frames do contrato ainda PENDENTES por professor (pacote enviado incompleto).
// REMOVA a entrada assim que o pacote completo for mesclado.
const FRAMES_PENDENTES = {
    // (vazio — todas as entregas de ultimate estão completas)
};

test('existem exatamente os 6 professores esperados', () => {
    assert.equal(professors.length, 6);
    assert.deepEqual(professors.map(p => p.id).sort(), [...EXPECTED_IDS].sort());
});

test('todos os professores têm todos os campos obrigatórios', () => {
    for (const p of professors) {
        for (const field of REQUIRED_FIELDS) {
            assert.ok(p[field] !== undefined && p[field] !== null && p[field] !== '',
                `professor "${p.id}" sem campo "${field}"`);
        }
    }
});

test('ids, atlasKeys e portraitKeys são únicos', () => {
    const uniq = arr => new Set(arr).size === arr.length;
    assert.ok(uniq(professors.map(p => p.id)), 'ids duplicados');
    assert.ok(uniq(professors.map(p => p.atlasKey)), 'atlasKeys duplicadas');
    assert.ok(uniq(professors.map(p => p.portraitKey)), 'portraitKeys duplicadas');
});

test('arquivos de atlas e portrait existem em public/ com o case exato', () => {
    for (const p of professors) {
        assert.ok(existsCaseSensitive(p.atlasImage),
            `atlas PNG ausente/case errado: ${p.atlasImage} (${p.id})`);
        assert.ok(existsCaseSensitive(p.atlasJson),
            `atlas JSON ausente/case errado: ${p.atlasJson} (${p.id})`);
        assert.ok(existsCaseSensitive(p.portraitUrl),
            `portrait ausente/case errado: ${p.portraitUrl} (${p.id})`);
    }
});

test('todo atlas contém os frames do contrato', () => {
    for (const p of professors) {
        const frames = atlasFrameNames(p.atlasJson);
        const pendentes = new Set(FRAMES_PENDENTES[p.id] || []);
        const exigidos = REQUIRED_ATLAS_FRAMES.filter(f => !pendentes.has(f));
        for (const frame of exigidos) {
            assert.ok(frames.includes(frame),
                `atlas de "${p.id}" (${p.atlasJson}) sem o frame "${frame}"`);
        }
        // se o frame pendente já chegou, a isenção virou lixo: falha p/ forçar limpeza
        for (const frame of pendentes) {
            assert.ok(!frames.includes(frame),
                `"${frame}" já existe no atlas de "${p.id}" — remova de FRAMES_PENDENTES`);
        }
    }
});

test('scale de cada professor é um número plausível (0.3 a 1.5)', () => {
    for (const p of professors) {
        assert.equal(typeof p.scale, 'number', `${p.id}: scale não é número`);
        assert.ok(p.scale >= 0.3 && p.scale <= 1.5,
            `${p.id}: scale ${p.scale} fora da faixa plausível`);
    }
});

test('cada professor tem banco de questões base em assets/questions/<id>.json', () => {
    for (const p of professors) {
        // Coringa não tem banco próprio: em jogo puxa de todos os outros
        if (p.id === 'coringa') continue;
        const file = publicPath(`/assets/questions/${p.id}.json`);
        assert.ok(fs.existsSync(file),
            `banco base ausente: /assets/questions/${p.id}.json`);
    }
});

test('getProfessorById faz fallback para o primeiro professor em id inválido', () => {
    assert.equal(getProfessorById('so').id, 'so');
    assert.equal(getProfessorById('nao-existe').id, professors[0].id);
    assert.equal(getProfessorById(undefined).id, professors[0].id);
});
