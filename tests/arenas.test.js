// Integridade das arenas (cenários de fundo da luta).
import test from 'node:test';
import assert from 'node:assert/strict';
import { arenas, getArenaById, getRandomArena } from '../src/arenas.js';
import { existsCaseSensitive } from './helpers.js';

test('existem 6 arenas com campos obrigatórios', () => {
    assert.equal(arenas.length, 6);
    for (const a of arenas) {
        for (const field of ['id', 'name', 'key', 'image', 'description']) {
            assert.ok(a[field], `arena sem campo "${field}": ${JSON.stringify(a)}`);
        }
    }
});

test('ids e keys das arenas são únicos', () => {
    assert.equal(new Set(arenas.map(a => a.id)).size, arenas.length, 'ids duplicados');
    assert.equal(new Set(arenas.map(a => a.key)).size, arenas.length, 'keys duplicadas');
});

test('imagens das arenas existem em public/ com o case exato', () => {
    for (const a of arenas) {
        assert.ok(existsCaseSensitive(a.image),
            `imagem de arena ausente/case errado: ${a.image}`);
    }
});

test('getArenaById retorna a arena certa e faz fallback para a primeira', () => {
    assert.equal(getArenaById('quadra').id, 'quadra');
    assert.equal(getArenaById('biblioteca').id, 'biblioteca');
    assert.equal(getArenaById('invalida').id, arenas[0].id);
    assert.equal(getArenaById(undefined).id, arenas[0].id);
});

test('getRandomArena sempre retorna uma arena válida', () => {
    for (let i = 0; i < 50; i++) {
        assert.ok(arenas.includes(getRandomArena()));
    }
});
