export const arenas = [
    {
        id: 'quadra',
        name: 'Quadra Poliesportiva',
        key: 'arena_quadra',
        image: '/assets/arenas/arena_quadra.jpg',
        description: 'Educação Física & Jogos Internos'
    },
    {
        id: 'classroom',
        name: 'Sala de Aula',
        key: 'arena_classroom',
        image: '/assets/arenas/arena_classroom.jpg',
        description: 'Fundamentos & Teoria'
    },
    {
        id: 'lab09',
        name: 'Laboratório 09',
        key: 'arena_lab09',
        image: '/assets/arenas/arena_lab09.jpg',
        description: 'Engenharia de Software & Kanban'
    },
    {
        id: 'lab08',
        name: 'Laboratório 08',
        key: 'arena_lab08',
        image: '/assets/arenas/arena_lab08.jpg',
        description: 'Banco de Dados & Diagramas UML'
    },
    {
        id: 'lab07',
        name: 'Laboratório 07',
        key: 'arena_lab07',
        image: '/assets/arenas/arena_lab07.jpg',
        description: 'Redes de Computadores & Infraestrutura'
    },
    {
        id: 'biblioteca',
        name: 'Biblioteca',
        key: 'arena_biblioteca',
        image: '/assets/arenas/arena_biblioteca.jpg',
        description: 'Pesquisa, Algoritmos & Silêncio'
    }
];

export function getArenaById(id) {
    return arenas.find(a => a.id === id) || arenas[0];
}

export function getRandomArena() {
    const randomIndex = Math.floor(Math.random() * arenas.length);
    return arenas[randomIndex];
}
