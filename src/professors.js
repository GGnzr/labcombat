export const professors = [
    {
        id: 'so',
        name: 'Prof. Sistemas Operacionais',
        shortName: 'Sistemas Operacionais',
        subject: 'Threads, Processos & Kernel',
        quote: '"Todo programa é um processo esperando a sua vez."',
        ultimateName: 'KERNEL PANIC (TELA AZUL)',
        ultimateQuote: '"Processo encerrado com código de erro fatal."',
        color: '#ef4444',
        idleKey: 'prof_so_idle',
        portraitKey: 'prof_so_portrait',
        idleUrl: '/assets/professors/so_idle.png',
        portraitUrl: '/assets/professors/so_portrait.png'
    },
    {
        id: 'eng_soft',
        name: 'Prof. Engenharia de Software',
        shortName: 'Eng. de Software',
        subject: 'Scrum, Requisitos & Clean Code',
        quote: '"Todo bug caro começou como um requisito mal entendido."',
        ultimateName: 'DEPLOY EM PRODUÇÃO NA SEXTA',
        ultimateQuote: '"Rollback impossível. Sistema quebrado."',
        color: '#10b981',
        idleKey: 'prof_eng_soft_idle',
        portraitKey: 'prof_eng_soft_portrait',
        idleUrl: '/assets/professors/eng_soft_idle.png',
        portraitUrl: '/assets/professors/eng_soft_portrait.png'
    },
    {
        id: 'poo',
        name: 'Prof. POO',
        shortName: 'Programação OO',
        subject: 'Classes, Polimorfismo & Herança',
        quote: '"Tudo é objeto. Até o problema."',
        ultimateName: 'NULL POINTER EXCEPTION',
        ultimateQuote: '"Tentativa ilegal de acessar referência nula."',
        color: '#84cc16',
        idleKey: 'prof_poo_idle',
        portraitKey: 'prof_poo_portrait',
        idleUrl: '/assets/professors/poo_idle.png',
        portraitUrl: '/assets/professors/poo_portrait.png'
    },
    {
        id: 'web',
        name: 'Prof. Web & Mobile',
        shortName: 'Web & Mobile',
        subject: 'Frontend, Fullstack & APIs',
        quote: '"Bom código funciona em qualquer tela."',
        ultimateName: '404 NOT FOUND (CORS ERROR)',
        ultimateQuote: '"Recurso permanentemente inacessível."',
        color: '#3b82f6',
        idleKey: 'prof_web_idle',
        portraitKey: 'prof_web_portrait',
        idleUrl: '/assets/professors/web_idle.png',
        portraitUrl: '/assets/professors/web_portrait.png'
    },
    {
        id: 'bd',
        name: 'Prof. Banco de Dados',
        shortName: 'Banco de Dados',
        subject: 'SQL, Índices & Normalização',
        quote: '"Dado bem organizado vale mais que ouro."',
        ultimateName: 'DROP DATABASE --FORCE',
        ultimateQuote: '"Seus dados foram purgados do servidor."',
        color: '#a855f7',
        idleKey: 'prof_bd_idle',
        portraitKey: 'prof_bd_portrait',
        idleUrl: '/assets/professors/bd_idle.png',
        portraitUrl: '/assets/professors/bd_portrait.png'
    },
    {
        id: 'redes',
        name: 'Prof. Redes de Computadores',
        shortName: 'Redes',
        subject: 'TCP/IP, Roteamento & Ping',
        quote: '"Toda conexão começa com um bom ping."',
        ultimateName: 'DDoS OVERLOAD (PING DA MORTE)',
        ultimateQuote: '"Tempo limite de resposta esgotado."',
        color: '#f59e0b',
        idleKey: 'prof_redes_idle',
        portraitKey: 'prof_redes_portrait',
        idleUrl: '/assets/professors/redes_idle.png',
        portraitUrl: '/assets/professors/redes_portrait.png'
    }
];

export function getProfessorById(id) {
    return professors.find(p => p.id === id) || professors[0];
}
