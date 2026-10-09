export const professors = [
    {
        id: 'so',
        name: 'Programação Orientada a Objetos',
        shortName: 'Prog. Orientada a Objetos',
        subject: 'Classes, Polimorfismo & Herança',
        quote: '"Tudo é objeto. Até o problema."',
        ultimateName: 'NULL POINTER EXCEPTION',
        ultimateQuote: '"Tentativa ilegal de acessar referência nula."',
        color: '#84cc16',
        portraitKey: 'prof_so_portrait',
        portraitUrl: '/assets/professors/so_portrait.png',
        atlasKey: 'atlas_so',
        atlasImage: '/assets/so/phaser/SO.png',
        atlasJson: '/assets/so/phaser/SO.json',
        scale: 0.65
    },
    {
        id: 'eng_soft',
        name: 'Engenharia de Software',
        shortName: 'Eng. de Software',
        subject: 'Scrum, Requisitos & Clean Code',
        quote: '"Todo bug caro começou como um requisito mal entendido."',
        ultimateName: 'DEPLOY EM PRODUÇÃO NA SEXTA',
        ultimateQuote: '"Rollback impossível. Sistema quebrado."',
        color: '#10b981',
        portraitKey: 'prof_eng_soft_portrait',
        portraitUrl: '/assets/professors/eng_soft_portrait.png',
        atlasKey: 'atlas_eng_soft',
        atlasImage: '/assets/eng/phaser/eng.png',
        atlasJson: '/assets/eng/phaser/eng.json',
        scale: 0.65
    },
    {
        id: 'coringa',
        name: 'Professor Coringa',
        shortName: 'Coringa',
        subject: 'Caos, Imprevisibilidade & Gambiarra',
        quote: '"A única regra é que não há regras."',
        ultimateName: 'CORINGA DO BARALHO (CHAOS MODE)',
        ultimateQuote: '"O jogo virou. Quem ri por último, ri melhor."',
        color: '#84cc16',
        portraitKey: 'prof_coringa_portrait',
        portraitUrl: '/assets/professors/coringa_portrait.png',
        atlasKey: 'atlas_coringa',
        atlasImage: '/assets/coringa/phaser/coringa.png',
        atlasJson: '/assets/coringa/phaser/coringa.json',
        scale: 0.65
    },
    {
        id: 'web',
        name: 'Web',
        shortName: 'Web',
        subject: 'Frontend, Fullstack & APIs',
        quote: '"Bom código funciona em qualquer tela."',
        ultimateName: '404 NOT FOUND (CORS ERROR)',
        ultimateQuote: '"Recurso permanentemente inacessível."',
        color: '#60a5fa',
        portraitKey: 'prof_web_portrait',
        portraitUrl: '/assets/professors/web_portrait.png',
        atlasKey: 'atlas_web',
        atlasImage: '/assets/web/phaser/web.png',
        atlasJson: '/assets/web/phaser/web.json',
        scale: 0.65
    },
    {
        id: 'bd',
        name: 'Banco de Dados',
        shortName: 'Banco de Dados',
        subject: 'SQL, Índices & Normalização',
        quote: '"Dado bem organizado vale mais que ouro."',
        ultimateName: 'DROP DATABASE --FORCE',
        ultimateQuote: '"Seus dados foram purgados do servidor."',
        color: '#c084fc',
        portraitKey: 'prof_bd_portrait',
        portraitUrl: '/assets/professors/bd_portrait.png',
        atlasKey: 'atlas_bd',
        atlasImage: '/assets/bd/phaser/bd.png',
        atlasJson: '/assets/bd/phaser/bd.json',
        scale: 0.728, // Calibrado para ter a mesma altura do Eng. de Software (345 * 0.65 = 224.25px vs 308 * 0.728 = 224.22px)
        portraitScale: 1.12,
        portraitOffsetY: -1
    },
    {
        id: 'redes',
        name: 'Redes de Computadores',
        shortName: 'Redes',
        subject: 'TCP/IP, Roteamento & Ping',
        quote: '"Toda conexão começa com um bom ping."',
        ultimateName: 'DDoS OVERLOAD (PING DA MORTE)',
        ultimateQuote: '"Tempo limite de resposta esgotado."',
        color: '#f59e0b',
        portraitKey: 'prof_redes_portrait',
        portraitUrl: '/assets/professors/redes_portrait.png',
        atlasKey: 'atlas_redes',
        atlasImage: '/assets/redes/phaser/redes.png',
        atlasJson: '/assets/redes/phaser/redes.json',
        scale: 0.65
    }
];

export function getProfessorById(id) {
    return professors.find(p => p.id === id) || professors[0];
}
