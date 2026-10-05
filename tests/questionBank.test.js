// Regras de validateQuestionBank() — a mesma validação usada pelo painel GM
// ao importar questões e (indiretamente) pelo carregamento em partida.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestionBank, resolveMatchProfessorIds } from '../src/questionBank.js';

const validQuestion = {
    id: 1,
    text: 'Pergunta de exemplo?',
    options: ['A', 'B'],
    correctIndex: 0
};

test('rejeita valores que não são array não-vazio', () => {
    for (const bad of [null, undefined, {}, 'x', 42, []]) {
        const r = validateQuestionBank(bad);
        assert.equal(r.valid, false, `deveria rejeitar: ${JSON.stringify(bad)}`);
    }
});

test('aceita um banco mínimo válido', () => {
    const r = validateQuestionBank([validQuestion]);
    assert.equal(r.valid, true);
    assert.match(r.message, /1 questões válidas/);
});

test('rejeita questões sem campos obrigatórios', () => {
    const cases = [
        { ...validQuestion, id: null },                       // sem id
        { ...validQuestion, text: 123 },                      // text não-string
        { ...validQuestion, options: 'A' },                   // options não-array
        { ...validQuestion, options: ['só uma'] },            // menos de 2 opções
        { ...validQuestion, correctIndex: -1 },               // índice negativo
        { ...validQuestion, correctIndex: 2 },                // fora do range
        { ...validQuestion, correctIndex: 1.5 },              // não inteiro
    ];
    for (const badQ of cases) {
        const r = validateQuestionBank([badQ]);
        assert.equal(r.valid, false, `deveria rejeitar: ${JSON.stringify(badQ)}`);
        assert.match(r.message, /id, text, options e correctIndex/);
    }
});

test('uma questão inválida contamina o banco inteiro', () => {
    const r = validateQuestionBank([validQuestion, { ...validQuestion, id: 2 }, { text: 'x' }]);
    assert.equal(r.valid, false);
});

// Regra do Coringa: escolhido por qualquer lado, a partida puxa as questões
// de TODOS os outros professores (ele não tem banco próprio).
test('sem coringa: mantém exatamente os bancos dos 2 lutadores (sem duplicar)', () => {
    assert.deepEqual(resolveMatchProfessorIds(['so', 'bd']), ['so', 'bd']);
    assert.deepEqual(resolveMatchProfessorIds(['so', 'so']), ['so']);
    assert.deepEqual(resolveMatchProfessorIds([null, 'web']), ['web']);
});

test('com coringa: catálogo vira a união de todos os OUTROS professores', () => {
    const esperado = ['so', 'eng_soft', 'web', 'bd', 'redes'];
    assert.deepEqual(resolveMatchProfessorIds(['coringa', 'bd']), esperado);
    assert.deepEqual(resolveMatchProfessorIds(['so', 'coringa']), esperado);
    assert.deepEqual(resolveMatchProfessorIds(['coringa', 'coringa']), esperado);
});
