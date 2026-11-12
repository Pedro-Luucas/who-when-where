// The line shown under each person's name while the player hunts for where
// and when they were born and died. Keyed by roster title (people-roster.mjs).
//
// These replace Wikidata's descriptions, which open with a nationality
// ("English naturalist", "químico francês") and so give the birthplace away.
// Keep them that way: what the person did, never a country, a nationality, a
// people, a city or a region (npm run check:text fails otherwise), and never
// their dates.

export const DESCRIPTIONS = {
  "Charles Darwin": [
    "Naturalist and biologist behind the theory of evolution by natural selection",
    "Naturalista e biólogo, autor da teoria da evolução por seleção natural",
  ],
  "Albert Einstein": ["Theoretical physicist, author of the theory of relativity", "Físico teórico, autor da teoria da relatividade"],
  "Isaac Newton": [
    "Mathematician and physicist who described gravity and the laws of motion",
    "Matemático e físico que descreveu a gravidade e as leis do movimento",
  ],
  "Marie Curie": [
    "Physicist and chemist, pioneer of radioactivity and twice a Nobel laureate",
    "Física e química, pioneira da radioatividade e duas vezes premiada com o Nobel",
  ],
  "Galileo Galilei": [
    "Physicist and astronomer who turned the telescope to the sky",
    "Físico e astrônomo que apontou o telescópio para o céu",
  ],
  "Nikola Tesla": [
    "Engineer and inventor of alternating-current power systems",
    "Engenheiro e inventor dos sistemas de corrente alternada",
  ],
  "Alan Turing": [
    "Mathematician, codebreaker and father of theoretical computer science",
    "Matemático, decifrador de códigos e pai da ciência da computação teórica",
  ],
  "Ada Lovelace": [
    "Mathematician who wrote the first published computer program",
    "Matemática que escreveu o primeiro programa de computador publicado",
  ],
  "Stephen Hawking": [
    "Theoretical physicist and cosmologist who studied black holes",
    "Físico teórico e cosmólogo que estudou os buracos negros",
  ],
  "Richard Feynman": [
    "Theoretical physicist of quantum electrodynamics, famous for his diagrams",
    "Físico teórico da eletrodinâmica quântica, famoso por seus diagramas",
  ],
  "Niels Bohr": [
    "Physicist who modelled the atom and helped found quantum theory",
    "Físico que modelou o átomo e ajudou a fundar a teoria quântica",
  ],
  "Johannes Kepler": [
    "Astronomer and mathematician who found the laws of planetary motion",
    "Astrônomo e matemático que descobriu as leis do movimento dos planetas",
  ],
  "Nicolaus Copernicus": [
    "Renaissance astronomer who put the Sun at the centre of the universe",
    "Astrônomo renascentista que pôs o Sol no centro do universo",
  ],
  "Louis Pasteur": [
    "Chemist and microbiologist, pioneer of vaccines and germ theory",
    "Químico e microbiologista, pioneiro das vacinas e da teoria dos germes",
  ],
  "Dmitri Mendeleev": [
    "Chemist who arranged the elements into the periodic table",
    "Químico que organizou os elementos na tabela periódica",
  ],
  "Alexander von Humboldt": [
    "Naturalist and explorer, one of the founders of modern geography",
    "Naturalista e explorador, um dos fundadores da geografia moderna",
  ],
  "Carl Sagan": [
    "Astronomer and science communicator who brought the cosmos to television",
    "Astrônomo e divulgador científico que levou o cosmos para a televisão",
  ],
  "Rosalind Franklin": [
    "Chemist whose X-ray images revealed the shape of DNA",
    "Química cujas imagens de raios X revelaram a forma do DNA",
  ],
  "Leonhard Euler": [
    "Mathematician and physicist, one of the most prolific of all time",
    "Matemático e físico, um dos mais prolíficos de todos os tempos",
  ],
  "Carl Friedrich Gauss": [
    "Mathematician and physicist known as the prince of mathematicians",
    "Matemático e físico conhecido como o príncipe da matemática",
  ],
  "Srinivasa Ramanujan": [
    "Self-taught mathematician of astonishing formulas and infinite series",
    "Matemático autodidata de fórmulas espantosas e séries infinitas",
  ],
  "Emmy Noether": [
    "Mathematician who tied every symmetry of nature to a conservation law",
    "Matemática que ligou cada simetria da natureza a uma lei de conservação",
  ],
  "Leonardo da Vinci": ["Renaissance painter, inventor and anatomist", "Pintor, inventor e anatomista do Renascimento"],
  "Blaise Pascal": [
    "Mathematician, physicist, inventor and religious philosopher",
    "Matemático, físico, inventor e filósofo religioso",
  ],
  "Immanuel Kant": ["Philosopher of reason, knowledge and moral duty", "Filósofo da razão, do conhecimento e do dever moral"],
  "René Descartes": [
    "Philosopher and mathematician: “I think, therefore I am”",
    "Filósofo e matemático: “penso, logo existo”",
  ],
  "Voltaire": [
    "Writer and philosopher of the Enlightenment, champion of free speech",
    "Escritor e filósofo do Iluminismo, defensor da liberdade de expressão",
  ],
  "Jean-Jacques Rousseau": [
    "Philosopher, writer and composer, author of The Social Contract",
    "Filósofo, escritor e compositor, autor de O Contrato Social",
  ],
  "Karl Marx": [
    "Philosopher and economist, co-author of The Communist Manifesto",
    "Filósofo e economista, coautor do Manifesto Comunista",
  ],
  "Friedrich Nietzsche": [
    "Philosopher of the will to power, who declared that God is dead",
    "Filósofo da vontade de potência, que declarou que Deus está morto",
  ],
  "Sigmund Freud": ["Neurologist and founder of psychoanalysis", "Neurologista e fundador da psicanálise"],
  "Gottfried Wilhelm Leibniz": [
    "Polymath who invented calculus at the same time as a famous rival",
    "Polímata que inventou o cálculo ao mesmo tempo que um rival famoso",
  ],
  "Baruch Spinoza": [
    "Rationalist philosopher who saw God and nature as one",
    "Filósofo racionalista que via Deus e a natureza como uma coisa só",
  ],
  "Adam Smith": [
    "Economist and moral philosopher, author of The Wealth of Nations",
    "Economista e filósofo moral, autor de A Riqueza das Nações",
  ],
  "Simone de Beauvoir": [
    "Philosopher, novelist and feminist, author of The Second Sex",
    "Filósofa, romancista e feminista, autora de O Segundo Sexo",
  ],
  "Hannah Arendt": [
    "Political philosopher of totalitarianism and the banality of evil",
    "Filósofa política do totalitarismo e da banalidade do mal",
  ],
  "Ludwig Wittgenstein": ["Philosopher of logic and language", "Filósofo da lógica e da linguagem"],
  "Bertrand Russell": [
    "Philosopher, logician and Nobel laureate in literature",
    "Filósofo, lógico e ganhador do Nobel de Literatura",
  ],
  "Avicenna": [
    "Polymath and physician, author of The Canon of Medicine",
    "Polímata e médico, autor de O Cânone da Medicina",
  ],
  "Ibn Khaldun": [
    "Historian and philosopher, one of the founders of sociology",
    "Historiador e filósofo, um dos fundadores da sociologia",
  ],
  "Paulo Freire": [
    "Educator and philosopher, author of Pedagogy of the Oppressed",
    "Educador e filósofo, autor de Pedagogia do Oprimido",
  ],
  "Virginia Woolf": [
    "Modernist novelist and essayist, author of A Room of One’s Own",
    "Romancista e ensaísta modernista, autora de Um Teto Todo Seu",
  ],
  "Fyodor Dostoevsky": [
    "Novelist of guilt and faith, author of Crime and Punishment",
    "Romancista da culpa e da fé, autor de Crime e Castigo",
  ],
  "Leo Tolstoy": ["Novelist, author of War and Peace", "Romancista, autor de Guerra e Paz"],
  "Franz Kafka": [
    "Novelist and short-story writer, author of The Metamorphosis",
    "Romancista e contista, autor de A Metamorfose",
  ],
  "Jorge Luis Borges": [
    "Writer of labyrinths, mirrors and infinite libraries",
    "Escritor de labirintos, espelhos e bibliotecas infinitas",
  ],
  "Machado de Assis": [
    "Novelist and short-story writer, author of Dom Casmurro",
    "Romancista e contista, autor de Dom Casmurro",
  ],
  "Fernando Pessoa": [
    "Poet who wrote as dozens of invented authors",
    "Poeta que escreveu como dezenas de autores inventados",
  ],
  "Gabriel García Márquez": [
    "Novelist of magical realism and Nobel laureate",
    "Romancista do realismo mágico e ganhador do Nobel",
  ],
  "Rabindranath Tagore": [
    "Poet, composer and philosopher, Nobel laureate in literature",
    "Poeta, compositor e filósofo, ganhador do Nobel de Literatura",
  ],
};
