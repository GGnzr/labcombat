// Validação dos bancos de questões: o legado embutido (src/questions.js)
// e os arquivos base publicados pelo GM (public/assets/questions/*.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { questions } from '../src/questions.js';
import { validateQuestionBank } from '../src/questionBank.js';
import { publicPath, readJson } from './helpers.js';

function assertValidBank(bank, origem) {
    const result = validateQuestionBank(bank);
    assert.ok(result.valid, `${origem}: ${result.message}`);
    const ids = bank.map(q => q.id);
    assert.equal(new Set(ids).size, ids.length, `${origem}: ids duplicados`);
    for (const q of bank) {
        assert.ok(q.text.trim().length >= 10, `${origem} id=${q.id}: texto curto demais`);
        assert.ok(q.options.every(o => typeof o === 'string' && o.trim().length > 0),
            `${origem} id=${q.id}: opção vazia`);
        assert.ok(new Set(q.options).size === q.options.length,
            `${origem} id=${q.id}: opções duplicadas`);
    }
}

test('banco embutido (src/questions.js) é válido', () => {
    assert.ok(Array.isArray(questions) && questions.length >= 10);
    assertValidBank(questions, 'src/questions.js');
});

test('bancos base de public/assets/questions são válidos', () => {
    const dir = publicPath('/assets/questions');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    assert.ok(files.length >= 5, `esperava ≥5 bancos base, achei ${files.length}`);
    for (const f of files) {
        const bank = readJson(path.join(dir, f));
        assertValidBank(bank, `assets/questions/${f}`);
    }
});
