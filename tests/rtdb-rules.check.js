// Teste das regras do Firebase RTDB (database.rules.json) no emulador local.
// Rode: npx firebase-tools emulators:exec --only database "node tests/rtdb-rules.check.js"
//
// OpenCode execuÃ§Ã£o isolada (nÃ£o entra no npm test de regressÃ£o: precisa do
// emulador rodando). CenÃ¡rios cobrem a Fase 4.2 â€” anti-trapaÃ§a de HP.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

const PASS = '  âœ…';
const FAIL = '  âŒ';
let failures = 0;

function check(name, ok) {
    console.log(PASS + ' ' + name);
    if (!ok) { failures++; console.log('\x1b[31m%s\x1b[0m', FAIL + ' ' + name + ' (FALHOU!)'); }
}
async function expectOk(name, promise) { try { await assertSucceeds(promise); check(name, true); } catch (e) { failures++; console.log('\x1b[31m%s\x1b[0m', FAIL + ' ' + name + ' (era pra PASSAR): ' + e.message); } }
async function expectFail(name, promise) { try { await assertFails(promise); check(name, true); } catch (e) { failures++; console.log('\x1b[31m%s\x1b[0m', FAIL + ' ' + name + ' (era pra BLOQUEAR): ' + e.message); } }

const rules = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf-8');

const testEnv = await initializeTestEnvironment({
    projectId: 'demo-labcombat',
    database: { rules, host: '127.0.0.1', port: 9001 }
});

// Contextos: anÃ´nimo (sem login), host (p1), convidado (p2), intruso, admin
const anon = testEnv.unauthenticatedContext().database();
const host = testEnv.authenticatedContext('uid_host').database();
const guest2 = testEnv.authenticatedContext('uid_p2').database();
const intruder = testEnv.authenticatedContext('uid_intruso').database();
const admin = testEnv.authenticatedContext('uid_admin').database();
const dbAdmin = testEnv.authenticatedContext('qualquer', {}, { database: {} }); // nÃ£o usado

// Seed: uid_admin como GM + uma sala existente de outra era (sem uid)
await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await db.ref('adminUsers/uid_admin').set(true);
});

console.log('\nâ”€â”€ Granularidade: sala nova exige uid do criador em p1 â”€â”€');
await expectFail('anÃ´nimo NÃƒO cria sala', anon.ref('rooms/TEST').set({ p1: { uid: 'x' } }));
await expectFail('criaÃ§Ã£o com uid de OUTRO Ã© bloqueada', guest2.ref('rooms/TEST').set({ p1: { uid: 'uid_host', nickname: 'H' } }));
await expectOk('host cria sala com o prÃ³prio uid', host.ref('rooms/TEST').set({ p1: { uid: 'uid_host', nickname: 'H', hp: 100 }, round: 0 }));

console.log('\nâ”€â”€ Anti-trapaÃ§a: HP sÃ³ o host/dono do nÃ³ escreve â”€â”€');
await expectOk('p2 entra na sala (escreve prÃ³prio nÃ³)', guest2.ref('rooms/TEST/p2').set({ uid: 'uid_p2', nickname: 'G', hp: 100 }));
await expectOk('p2 responde (escreve nos prÃ³prios campos)', guest2.ref('rooms/TEST/p2').update({ answered: true, answerCorrect: true }));
await expectFail('p2 NÃƒO edita HP do host (rooms/TEST/p1/hp)', guest2.ref('rooms/TEST/p1/hp').set(0));
await expectOk('host (p1) aplica dano no p2 ao resolver', host.ref('rooms/TEST/p2/hp').set(80));
await expectFail('intruso NÃƒO edita nada na sala', intruder.ref('rooms/TEST/p1/hp').set(0));
await expectFail('intruso NÃƒO cria campos de rodada', intruder.ref('rooms/TEST/round').set(99));
await expectOk('host escreve campos compartilhados (round)', host.ref('rooms/TEST/round').set(1));
await expectOk('p2 fallback escreve no root da sala (guia P1 travado)', guest2.ref('rooms/TEST').update({ currentQuestionId: 7 }));
await expectOk('GM remove sala qualquer', admin.ref('rooms/TEST').remove());
await expectFail('intruso NÃƒO remove sala alheia', intruder.ref('rooms/XPTO').set(null));

console.log('\nâ”€â”€ Salas antigas (sem uid) ficam travadas como previsto â”€â”€');
await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref('rooms/LEGADO').set({ p1: { nickname: 'velho' } });
});
await expectFail('sala legada sem uid: ninguÃ©m escreve', intruder.ref('rooms/LEGADO/round').set(1));
await expectOk('GM limpa sala legada', admin.ref('rooms/LEGADO').remove());

console.log('\nâ”€â”€ questionBanks: sÃ³ GM publica â”€â”€');
await expectFail('jogador NÃƒO publica banco de questÃµes', host.ref('questionBanks/so').set([{ id: 1 }]));
await expectOk('GM publica banco de questÃµes', admin.ref('questionBanks/so').set([{ id: 1 }]));
await expectOk('leitura de questÃµes livre (anÃ´nimo)', anon.ref('questionBanks/so').get());

console.log('\nâ”€â”€ leaderboard: cada um escreve sÃ³ o prÃ³prio; GM zera temporada â”€â”€');
await expectOk('jogador grava o prÃ³prio ranking', host.ref('leaderboard/uid_host').set({ points: 25, wins: 1 }));
await expectFail('jogador NÃƒO grava ranking de outro', host.ref('leaderboard/uid_p2').set({ points: 0 }));
await expectOk('GM zera temporada (remove o nÃ³ inteiro)', admin.ref('leaderboard').remove());
await expectFail('anÃ´nimo NÃƒO escreve ranking', anon.ref('leaderboard/x').set({ points: 999 }));
await expectOk('leitura do ranking livre (menu)', anon.ref('leaderboard').get());

console.log('\nâ”€â”€ nicknames: reserva pelo dono â”€â”€');
await expectOk('conta reserva seu apelido', host.ref('nicknames/demigod').set('uid_host'));
await expectFail('ninguÃ©m toma apelido reservado', guest2.ref('nicknames/demigod').set('uid_p2'));
await expectOk('dono remove o prÃ³prio apelido', host.ref('nicknames/demigod').remove());

console.log('\nâ”€â”€ logs: escreve autenticado, lÃª GM â”€â”€');
await expectOk('jogador grava log', host.ref('logs/l1').set({ type: 'warn', message: 'x' }));
await expectFail('jogador NÃƒO lÃª logs', host.ref('logs').get());
await expectOk('GM lÃª logs', admin.ref('logs').get());

console.log('\nâ”€â”€ users: cada um sÃ³ vÃª/edita o prÃ³prio perfil â”€â”€');
await expectOk('cria o prÃ³prio perfil', guest2.ref('users/uid_p2').set({ nickname: 'G' }));
await expectFail('NÃƒO lÃª perfil alheio', host.ref('users/uid_p2').get());
await expectFail('NÃƒO edita perfil alheio', host.ref('users/uid_p2').set({ nickname: 'hack' }));
await expectOk('edita o prÃ³prio perfil', guest2.ref('users/uid_p2').update({ lastLoginAt: 1 }));

await testEnv.cleanup();
console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
if (failures === 0) {
    console.log('\x1b[32m%s\x1b[0m', 'OK â€” todos os cenÃ¡rios das regras passaram âœ…');
    process.exit(0);
} else {
    console.log('\x1b[31m%s\x1b[0m', `${failures} cenÃ¡rio(s) FALHARAM âŒ`);
    process.exit(1);
}

