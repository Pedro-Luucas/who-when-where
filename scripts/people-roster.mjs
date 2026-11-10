// English Wikipedia article titles for the Who When Where roster.
// Everyone here needs a documented birth and death (year + place).
export const ROSTER = [
  // Science & mathematics
  "Charles Darwin",
  "Albert Einstein",
  "Isaac Newton",
  "Marie Curie",
  "Galileo Galilei",
  "Nikola Tesla",
  "Alan Turing",
  "Ada Lovelace",
  "Stephen Hawking",
  "Richard Feynman",
  "Niels Bohr",
  "Johannes Kepler",
  "Nicolaus Copernicus",
  "Louis Pasteur",
  "Dmitri Mendeleev",
  "Alexander von Humboldt",
  "Carl Sagan",
  "Rosalind Franklin",
  "Leonhard Euler",
  "Carl Friedrich Gauss",
  "Srinivasa Ramanujan",
  "Emmy Noether",
  "Leonardo da Vinci",
  "Blaise Pascal",
  // Philosophy & social thought
  "Immanuel Kant",
  "René Descartes",
  "Voltaire",
  "Jean-Jacques Rousseau",
  "Karl Marx",
  "Friedrich Nietzsche",
  "Sigmund Freud",
  "Gottfried Wilhelm Leibniz",
  "Baruch Spinoza",
  "Adam Smith",
  "Simone de Beauvoir",
  "Hannah Arendt",
  "Ludwig Wittgenstein",
  "Bertrand Russell",
  "Avicenna",
  "Ibn Khaldun",
  "Paulo Freire",
  // Literature
  "Virginia Woolf",
  "Fyodor Dostoevsky",
  "Leo Tolstoy",
  "Franz Kafka",
  "Jorge Luis Borges",
  "Machado de Assis",
  "Fernando Pessoa",
  "Gabriel García Márquez",
  "Rabindranath Tagore",
];

// Manual corrections, deep-merged over the fetched entry. Keyed by roster title.
// Use these when Wikidata points at a building, a vague region, or an odd label.
// Coordinates are left alone: a house inside the right town is precise enough.
// Descriptions are shown during play, so they must not give a place away.
const place = (en, pt = en) => ({ place: { name: { en, pt } } });
const desc = (en, pt) => ({
  description: { ...(en && { en }), ...(pt && { pt }) },
});

export const OVERRIDES = {
  "Charles Darwin": { birth: place("Shrewsbury"), death: place("Downe, Kent") },
  "Isaac Newton": {
    birth: place("Woolsthorpe-by-Colsterworth"),
    death: place("Kensington, London", "Kensington, Londres"),
  },
  "Marie Curie": { death: place("Passy, Haute-Savoie") },
  "Galileo Galilei": {
    ...desc(null, "físico e astrônomo italiano"),
    death: place("Arcetri, Florence", "Arcetri, Florença"),
  },
  "Nikola Tesla": {
    ...desc(null, "inventor e engenheiro sérvio-americano"),
    birth: place("Smiljan"),
    death: place("New York City", "Nova York"),
  },
  "Alan Turing": { birth: place("Maida Vale, London", "Maida Vale, Londres") },
  "Ada Lovelace": { death: place("Marylebone, London", "Marylebone, Londres") },
  "Richard Feynman": {
    ...desc(null, "físico teórico americano"),
    birth: place("Queens, New York City", "Queens, Nova York"),
    death: place("Los Angeles"),
  },
  "Niels Bohr": desc(null, "físico dinamarquês"),
  "Nicolaus Copernicus": desc("Renaissance mathematician and astronomer"),
  "Louis Pasteur": { death: place("Marnes-la-Coquette") },
  "Carl Sagan": {
    ...desc(null, "astrônomo e divulgador científico americano"),
    birth: place("Brooklyn, New York City", "Brooklyn, Nova York"),
  },
  "Rosalind Franklin": {
    birth: place("Notting Hill, London", "Notting Hill, Londres"),
    death: place("Chelsea, London", "Chelsea, Londres"),
  },
  "Carl Friedrich Gauss": { birth: place("Brunswick", "Braunschweig") },
  "Srinivasa Ramanujan": {
    name: { pt: "Srinivasa Ramanujan" },
    death: place("Kumbakonam"),
  },
  "Leonardo da Vinci": {
    ...desc(null, "artista, inventor e cientista do Renascimento italiano"),
    birth: place("Anchiano, Vinci"),
    death: place("Amboise"),
  },
  "Blaise Pascal": { birth: place("Clermont-Ferrand") },
  "Immanuel Kant": {
    birth: {
      place: {
        name: { en: "Königsberg (now Kaliningrad)", pt: "Königsberg (atual Kaliningrado)" },
        country: { en: "Russia", pt: "Rússia" },
      },
    },
    death: {
      place: {
        name: { en: "Königsberg (now Kaliningrad)", pt: "Königsberg (atual Kaliningrado)" },
        country: { en: "Russia", pt: "Rússia" },
      },
    },
  },
  "René Descartes": {
    birth: place("La Haye en Touraine (now Descartes)", "La Haye en Touraine (atual Descartes)"),
  },
  "Jean-Jacques Rousseau": desc(
    "Philosopher, writer and composer",
    "filósofo, escritor e compositor",
  ),
  "Baruch Spinoza": desc(
    "Dutch philosopher of Portuguese-Jewish origin",
    "filósofo holandês de origem judaico-portuguesa",
  ),
  "Adam Smith": desc(null, "filósofo e economista escocês"),
  "Simone de Beauvoir": { birth: place("Paris"), death: place("Paris") },
  "Hannah Arendt": {
    ...desc(
      "German-American historian and philosopher",
      "filósofa e teórica política alemã-americana",
    ),
    birth: place("Linden, Hanover", "Linden, Hanôver"),
    death: place("New York City", "Nova York"),
  },
  "Ludwig Wittgenstein": { birth: place("Vienna", "Viena") },
  "Bertrand Russell": {
    birth: place("Trellech, Wales", "Trellech, País de Gales"),
    death: place("Penrhyndeudraeth, Wales", "Penrhyndeudraeth, País de Gales"),
  },
  Avicenna: {
    ...desc(null, "filósofo, matemático e médico persa"),
    birth: place("Afshona, near Bukhara", "Afshona, perto de Bucara"),
  },
  "Ibn Khaldun": {
    name: { pt: "Ibn Khaldun" },
    ...desc(null, "historiador e filósofo árabe"),
  },
  "Fyodor Dostoevsky": {
    ...desc(null, "romancista e filósofo russo"),
    birth: place("Moscow", "Moscou"),
  },
  "Franz Kafka": {
    ...desc("German-language novelist and writer", "escritor de língua alemã"),
    death: place("Kierling, Klosterneuburg"),
  },
};
