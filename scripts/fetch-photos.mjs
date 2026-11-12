// Builds games/year-snap/data/photos.json: the historical photos of Year Snap,
// each with the year it was taken, a caption in English and Portuguese, and
// its credit.
//
//   node scripts/fetch-photos.mjs           check every photo, download what is missing
//   node scripts/fetch-photos.mjs --check   only check: licences, sizes, dates on Commons
//
// The roster below is chosen by hand: well-known, well-dated photographs on
// Wikimedia Commons (many from the Library of Congress, NASA, national
// archives and museums), from the first daguerreotypes to the 2000s, a few
// per decade so no decade dominates. Each one has an exact year (no "circa",
// no decade-only dates); the script reads the file's own date on Commons and
// warns when it disagrees. Kept out on purpose: paintings, prints and maps;
// scans of newspapers, posters or documents (they print the date); photos
// of the dead or of violence.
//
// Only free files are kept: public domain, CC0, CC BY and CC BY-SA (read from
// each file's extmetadata). Each photo is fitted inside 640 × 720, saved as a
// JPEG under public/snaps/ with an opaque name (a file called
// titanic-1912.jpg would give the answer away) and stored with its credit.
// Answers from the Commons API are cached (scripts/.cache) and photos already
// saved are kept, so a run that was stopped (Commons rate-limits downloads)
// picks up where it left off.

import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ROOT, creditFrom, getJson, plain, politeFetch, setPace } from "./lib/wiki.mjs";

setPace(1500);

const OUT_JSON = path.join(ROOT, "games/year-snap/data/photos.json");
const FOLDER = "snaps";
const OUT_DIR = path.join(ROOT, "public", FOLDER);
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/** The largest a saved photo is; the Wikimedia thumbnail step it is cut from. */
const WIDTH = 640;
const HEIGHT = 720;
const FETCH_WIDTH = 960;
const MIN_WIDTH = 400;
const QUALITY = 78;
/** No decade keeps more photos than this (the first ones in the roster). */
const PER_DECADE = 10;

const CHECK_ONLY = process.argv.includes("--check");

// ── The roster ──────────────────────────────────────────────────────────────
// id (never changes: saved games name their photos by it) · year · Commons file
// · caption in English and Portuguese (shown only after the guess; never ending
// in a digit) · optional place [lat, lon] · optional { trim: { top, right,
// bottom, left } }, fractions cut off a photo whose margin prints its date.

const ROSTER = [
  // 1830s
  ["boulevard-du-temple", 1838, "Boulevard du Temple by Daguerre.jpg",
    "A Paris boulevard by Louis Daguerre: the man having his boots polished, bottom left, is the first person ever photographed",
    "Um bulevar de Paris por Louis Daguerre: o homem engraxando as botas, embaixo à esquerda, é a primeira pessoa já fotografada", [48.866, 2.366]],
  ["cornelius-self-portrait", 1839, "RobertCornelius.jpg",
    "Robert Cornelius's self-portrait, one of the first photographs of a person",
    "Autorretrato de Robert Cornelius, uma das primeiras fotos de uma pessoa", [39.95, -75.16]],
  ["neuhauser-strasse", 1839, "Kobell und Steinheil - Neuhauser Straße - München - 1839.jpg",
    "Neuhauser Straße in Munich, by Franz von Kobell and Carl August von Steinheil, among the first photos taken in Germany",
    "A Neuhauser Straße, em Munique, por Franz von Kobell e Carl August von Steinheil, entre as primeiras fotos tiradas na Alemanha", [48.139, 11.57]],

  // 1840s
  ["drowned-man", 1840, "Hippolyte Bayard - Drownedman 1840.jpg",
    "Hippolyte Bayard's \"Self-Portrait as a Drowned Man\", the first staged photograph",
    "O \"Autorretrato como afogado\" de Hippolyte Bayard, a primeira foto encenada"],
  ["draper-moon", 1840, "John W Draper-The first Moon Photograph 1840.jpg",
    "The Moon by John William Draper, the oldest surviving photograph of it",
    "A Lua por John William Draper, a foto mais antiga dela que se conservou"],
  ["john-quincy-adams", 1843, "John Quincy Adams - copy of 1843 Philip Haas Daguerreotype-1.jpg",
    "John Quincy Adams, the earliest photograph of a president of the United States",
    "John Quincy Adams, a foto mais antiga de um presidente dos Estados Unidos"],
  ["open-door", 1844, "The Open Door MET DP148629.jpg",
    "\"The Open Door\", by William Henry Fox Talbot, from the first book illustrated with photographs",
    "\"A porta aberta\", de William Henry Fox Talbot, do primeiro livro ilustrado com fotos"],
  ["daguerreotypist", 1845, "Portrait of a Daguerreotypist, 1845 (with Frame).jpg",
    "Portrait of a daguerreotypist, with the tools of his trade",
    "Retrato de um daguerreotipista, com as ferramentas do ofício"],
  ["chartist-meeting", 1848, "Chartist meeting on Kennington Common by William Edward Kilburn 1848 - restoration1.jpg",
    "The great Chartist meeting on Kennington Common, London: one of the first photos of a crowd",
    "O grande comício cartista em Kennington Common, Londres: uma das primeiras fotos de uma multidão", [51.483, -0.111]],
  ["barricade-saint-maur", 1848, "The Barricade in rue Saint-Maur-Popincourt after the attack by General Lamoricière's troops, Monday 26 June 1848.jpg",
    "A barricade on rue Saint-Maur, Paris, after the June Days uprising: one of the first news photographs",
    "Uma barricada na rua Saint-Maur, em Paris, depois da revolta das Jornadas de Junho: uma das primeiras fotos jornalísticas", [48.866, 2.379]],
  ["chopin", 1849, "Frederic Chopin photo.jpeg",
    "The composer Frédéric Chopin, in a daguerreotype by Louis-Auguste Bisson",
    "O compositor Frédéric Chopin, num daguerreótipo de Louis-Auguste Bisson"],

  // 1850s
  ["crystal-palace-sydenham", 1854, "Crystal Palace General view from Water Temple.jpg",
    "The Crystal Palace rebuilt at Sydenham, by Philip Henry Delamotte",
    "O Palácio de Cristal reconstruído em Sydenham, por Philip Henry Delamotte", [51.422, -0.075]],
  ["valley-of-the-shadow", 1855, "Valley of the shadow of death.jpg",
    "\"The Valley of the Shadow of Death\": cannonballs on a road in the Crimean War, by Roger Fenton",
    "\"O Vale da Sombra da Morte\": balas de canhão numa estrada da Guerra da Crimeia, por Roger Fenton", [44.56, 33.62]],
  ["fenton-van", 1855, "Roger Fenton's waggon.jpg",
    "Roger Fenton's darkroom wagon in the Crimea, with his assistant Marcus Sparling",
    "A carroça-laboratório de Roger Fenton na Crimeia, com o assistente Marcus Sparling", [44.6, 33.55]],
  ["crimean-heroes", 1856, "Hughes & Mullins after Cundall & Howlett - Heroes of the Crimean War - Joseph Numa, John Potter, and James Deal of the Coldstream Guards.jpg",
    "Joseph Numa, John Potter and James Deal of the Coldstream Guards, back from the Crimean War",
    "Joseph Numa, John Potter e James Deal, da Guarda Coldstream, de volta da Guerra da Crimeia"],
  ["brig-upon-the-water", 1856, "Gustave Le Gray - Brig upon the Water - Google Art Project.jpg",
    "\"Brig upon the Water\", a seascape by Gustave Le Gray",
    "\"Brigue sobre a água\", marinha de Gustave Le Gray"],
  ["great-eastern-chains", 1857, "Robert Howlett (Isambard Kingdom Brunel Standing Before the Launching Chains of the Great Eastern), The Metropolitan Museum of Art - restoration1.jpg",
    "The engineer Isambard Kingdom Brunel before the launching chains of his ship, the Great Eastern, by Robert Howlett",
    "O engenheiro Isambard Kingdom Brunel diante das correntes de lançamento do seu navio, o Great Eastern, por Robert Howlett", [51.49, -0.012]],
  ["old-pont-saint-michel", 1857, "Auguste-Hippolyte Collard, Ancien pont Saint-Michel, 1857 edit.jpg",
    "The old Saint-Michel bridge in Paris, shortly before it was pulled down, by Auguste-Hippolyte Collard",
    "A antiga ponte Saint-Michel, em Paris, pouco antes de ser demolida, por Auguste-Hippolyte Collard", [48.853, 2.344]],
  ["beggar-maid", 1858, "Lewis Carroll (British, Daresbury, Cheshire 1832–1898 Guildford).jpg",
    "Alice Liddell, the girl who inspired \"Alice in Wonderland\", posing as \"The Beggar Maid\" for Lewis Carroll",
    "Alice Liddell, a menina que inspirou \"Alice no País das Maravilhas\", posando como \"A mendiga\" para Lewis Carroll"],
  ["pavillon-mollien", 1859, "Gustave Le Gray, Pavillon Mollien, 1859.jpg",
    "The Pavillon Mollien of the Louvre, by Gustave Le Gray",
    "O Pavilhão Mollien do Louvre, por Gustave Le Gray", [48.861, 2.335]],

  // 1860s
  ["boston-from-a-balloon", 1860, "Boston, as the Eagle and the Wild Goose See It.jpg",
    "Boston seen from a balloon by James Wallace Black, the oldest surviving aerial photograph",
    "Boston vista de um balão por James Wallace Black, a foto aérea mais antiga que se conservou", [42.358, -71.06], { trim: { bottom: 0.14 } }],
  ["tartan-ribbon", 1861, "Tartan Ribbon.jpg",
    "A tartan ribbon: the first colour photograph, made for James Clerk Maxwell",
    "Uma fita xadrez: a primeira foto colorida, feita para James Clerk Maxwell"],
  ["lincoln-at-antietam", 1862, "PinkertonLincolnMcClernand.jpg",
    "President Abraham Lincoln at Antietam with Allan Pinkerton and General John McClernand, by Alexander Gardner",
    "O presidente Abraham Lincoln em Antietam com Allan Pinkerton e o general John McClernand, por Alexander Gardner", [39.47, -77.74]],
  ["quaker-guns", 1862, "Centreville, VA, Quaker Guns in the fort on the heights.jpg",
    "\"Quaker guns\" — logs dressed up as cannons — in a Confederate fort at Centreville, Virginia",
    "\"Canhões quakers\" — troncos disfarçados de canhões — num forte confederado em Centreville, Virgínia", [38.84, -77.43]],
  ["sarah-bernhardt", 1864, "Sarah Bernhardt, par Nadar, 1864.jpg",
    "The actress Sarah Bernhardt, by Nadar",
    "A atriz Sarah Bernhardt, por Nadar"],
  ["livingstone", 1864, "David Livingstone by Thomas Annan.jpg",
    "The explorer David Livingstone, by Thomas Annan",
    "O explorador David Livingstone, por Thomas Annan"],
  ["gaucho", 1868, "Gaucho1868b.jpg",
    "A gaucho of the Argentine pampas, by Eugenio Courret",
    "Um gaúcho dos pampas argentinos, por Eugenio Courret"],
  ["golden-spike", 1869, "East and West Shaking hands at the laying of last rail Union Pacific Railroad - Restoration.jpg",
    "\"East and West Shaking Hands\": the last rail of the first transcontinental railroad, at Promontory Summit, Utah",
    "\"Leste e Oeste se cumprimentam\": o último trilho da primeira ferrovia transcontinental, em Promontory Summit, Utah", [41.618, -112.551]],
  ["suez-canal-opening", 1869, "Opening of the Suez Canal, Port Said, 1869.jpg",
    "The opening of the Suez Canal at Port Said",
    "A inauguração do Canal de Suez em Port Said", [31.26, 32.3]],

  // 1870s
  ["sojourner-truth", 1870, "Sojourner Truth, 1870 (cropped, restored).jpg",
    "The abolitionist and women's rights campaigner Sojourner Truth",
    "A abolicionista e defensora dos direitos das mulheres Sojourner Truth"],
  ["commune-barricade", 1871, "Barricade rue Royale Commune Paris 1871.jpg",
    "A barricade of the Paris Commune on rue Royale, looking towards the Madeleine",
    "Uma barricada da Comuna de Paris na rua Royale, com a Madeleine ao fundo", [48.868, 2.323]],
  ["old-faithful", 1872, "Old Faithful in eruption, Yellowstone - NARA - 516797.jpg",
    "Old Faithful erupting, by William Henry Jackson, the year Yellowstone became the first national park",
    "O gêiser Old Faithful em erupção, por William Henry Jackson, no ano em que Yellowstone virou o primeiro parque nacional", [44.46, -110.83]],
  ["rimbaud", 1872, "Carjat Arthur Rimbaud 1872.jpg",
    "The poet Arthur Rimbaud at seventeen, by Étienne Carjat",
    "O poeta Arthur Rimbaud aos dezessete anos, por Étienne Carjat"],
  ["galli-marie-carmen", 1875, "Atelier Nadar - Galli-Marié in Bizet's Carmen.jpg",
    "Célestine Galli-Marié as Carmen, the role she created in Bizet's opera, by the Atelier Nadar",
    "Célestine Galli-Marié como Carmen, papel que criou na ópera de Bizet, pelo Ateliê Nadar"],
  ["victor-hugo", 1876, "Victor Hugo by Étienne Carjat 1876 - full.jpg",
    "The writer Victor Hugo, by Étienne Carjat",
    "O escritor Victor Hugo, por Étienne Carjat"],
  ["liberty-head", 1878, "Head Statue of Liberty, Paris 1878.png",
    "The head of the Statue of Liberty on show in Paris",
    "A cabeça da Estátua da Liberdade exposta em Paris", [48.86, 2.29]],
  ["brooklyn-bridge-towers", 1878, "Brooklyn Bridge Under Construction 1878.jpg",
    "The Brooklyn Bridge under construction: the towers and the first cables",
    "A Ponte do Brooklyn em construção: as torres e os primeiros cabos", [40.706, -73.997], { trim: { bottom: 0.11 } }],

  // 1880s
  ["oscar-wilde", 1882, "Oscar Wilde by Napoleon Sarony. Three-quarter-length photograph, seated.jpg",
    "The writer Oscar Wilde on his lecture tour of America, by Napoleon Sarony",
    "O escritor Oscar Wilde na sua turnê de palestras pela América, por Napoleon Sarony"],
  ["george-roper-wreck", 1883, "Wreck of the ship George Roper, Point Lonsdale (1883) by Fred Kruger.jpg",
    "The wreck of the George Roper at Point Lonsdale, by Fred Kruger",
    "O naufrágio do George Roper em Point Lonsdale, por Fred Kruger", [-38.29, 144.61]],
  ["liberty-workshop", 1883, "Men in a workshop hammering sheets of copper for the constr....jpg",
    "Workers hammering the copper sheets of the Statue of Liberty in a Paris workshop",
    "Operários martelando as chapas de cobre da Estátua da Liberdade numa oficina de Paris", [48.878, 2.311]],
  ["frances-cleveland", 1886, "Frances Folsom Cleveland, by Charles Milton Bell.jpg",
    "Frances Cleveland, the youngest first lady of the United States, the year she married",
    "Frances Cleveland, a primeira-dama mais jovem dos Estados Unidos, no ano em que se casou"],
  ["walt-whitman", 1887, "Walt Whitman - George Collins Cox.jpg",
    "The poet Walt Whitman, by George C. Cox",
    "O poeta Walt Whitman, por George C. Cox"],
  ["last-joke-bellagio", 1887, "Alfred Stieglitz - The Last Joke Bellagio, 1887.jpg",
    "\"The Last Joke, Bellagio\": children at a fountain, by Alfred Stieglitz",
    "\"A última piada, Bellagio\": crianças numa fonte, por Alfred Stieglitz", [45.98, 9.26]],
  ["eiffel-construction", 1888, "Louis-Emile Durandelle, The Eiffel Tower - State of the Construction, 1888.jpg",
    "The Eiffel Tower under construction, by Louis-Émile Durandelle",
    "A Torre Eiffel em construção, por Louis-Émile Durandelle", [48.858, 2.294]],
  ["bandits-roost", 1888, "Bandits Roost, 59 and a half Mulberry Street.jpg",
    "\"Bandit's Roost\", an alley off Mulberry Street in New York, by Jacob Riis",
    "\"Bandit's Roost\", um beco da Mulberry Street em Nova York, por Jacob Riis", [40.716, -73.998]],
  ["uppsala-cathedral", 1889, "Schenson Uppsala domkyrka 1889 - Restoration.jpg",
    "Uppsala Cathedral under repair, by Emma Schenson, one of the first women photographers in Sweden",
    "A Catedral de Uppsala em obras, por Emma Schenson, uma das primeiras fotógrafas da Suécia", [59.858, 17.633]],

  // 1890s
  ["buffalo-soldiers", 1890, "Buffalo soldiers1.jpg",
    "Buffalo Soldiers of the 25th Infantry, some in buffalo robes, at Fort Keogh, Montana",
    "\"Buffalo Soldiers\" da 25.ª Infantaria, alguns com mantos de bisão, no Forte Keogh, Montana", [46.38, -105.88]],
  ["winter-fifth-avenue", 1892, "Alfred Stieglitz Winter Fifth Avenue 1892.jpg",
    "\"Winter, Fifth Avenue\": a horse-drawn coach in a snowstorm, by Alfred Stieglitz",
    "\"Inverno, Quinta Avenida\": uma carruagem numa nevasca, por Alfred Stieglitz", [40.742, -73.99]],
  ["coburg-royals", 1894, "Queen Victoria surrounded by her family - Coburg, 1894 (1 of 2).jpg",
    "Queen Victoria surrounded by her family at a royal wedding in Coburg",
    "A rainha Vitória cercada pela família num casamento real em Coburgo", [50.26, 10.96]],
  ["first-x-ray", 1895, "First medical X-ray by Wilhelm Röntgen of his wife Anna Bertha Ludwig's hand - 18951222.jpg",
    "The first X-ray of a person: the hand of Wilhelm Röntgen's wife, Anna Bertha, with her ring",
    "A primeira radiografia de uma pessoa: a mão da mulher de Wilhelm Röntgen, Anna Bertha, com a aliança", [49.79, 9.94]],
  ["montparnasse-derailment", 1895, "Train wreck at Montparnasse 1895.jpg",
    "A train that overran the buffers at the Gare Montparnasse and fell into the street, Paris",
    "Um trem que passou do fim da linha na estação Montparnasse e caiu na rua, em Paris", [48.842, 2.32]],
  ["lilienthal-glider", 1895, "Otto Lilienthal gliding experiment LCCN2002722087.tif",
    "The aviation pioneer Otto Lilienthal in one of his gliders",
    "O pioneiro da aviação Otto Lilienthal num dos seus planadores", [52.43, 13.33]],
  ["olympic-marathon", 1896, "1896 Olympic marathon.jpg",
    "Runners in the marathon of the first modern Olympic Games, in Athens",
    "Corredores na maratona dos primeiros Jogos Olímpicos modernos, em Atenas", [37.968, 23.741]],
  ["tolstoy", 1897, "Leo Tolstoy 1897, black and white, 37767u.jpg",
    "The writer Leo Tolstoy",
    "O escritor Liev Tolstói"],
  ["chilkoot-pass", 1898, "Scales and summit of Chilkoot Pass, 1898 (MOHAI 7249).jpg",
    "Gold seekers hauling their gear up the Chilkoot Pass in the Klondike Gold Rush",
    "Garimpeiros levando a carga pelo Passo Chilkoot na Corrida do Ouro de Klondike", [59.696, -135.246], { trim: { bottom: 0.12 } }],
  ["tesla-colorado", 1899, "Nikola Tesla, with his equipment Wellcome M0014782 - restoration2.jpg",
    "Nikola Tesla in his Colorado Springs laboratory under giant sparks (a double exposure)",
    "Nikola Tesla no seu laboratório de Colorado Springs, sob faíscas gigantes (uma dupla exposição)", [38.83, -104.82]],

  // 1900s
  ["airship-eiffel", 1901, "Contorno da Torre Eiffel com o Dirigível Nº6 - 1-13651-0000-0000, Acervo do Museu Paulista da USP.jpg",
    "Santos-Dumont's airship No. 6 rounding the Eiffel Tower, the flight that won him the Deutsch prize",
    "O dirigível Nº 6 de Santos-Dumont contornando a Torre Eiffel, o voo que lhe deu o prêmio Deutsch", [48.858, 2.294]],
  ["lightning-eiffel", 1902, "Lightning striking the Eiffel Tower - NOAA.jpg",
    "Lightning striking the Eiffel Tower",
    "Um raio atingindo a Torre Eiffel", [48.858, 2.294]],
  ["first-flight", 1903, "First flight2.jpg",
    "The first powered flight: Orville Wright at the controls, Wilbur running alongside, at Kitty Hawk",
    "O primeiro voo motorizado: Orville Wright nos controles e Wilbur correndo ao lado, em Kitty Hawk", [36.019, -75.669]],
  ["flatiron", 1904, "Steichen flatiron.jpg",
    "The Flatiron Building at dusk, by Edward Steichen",
    "O Flatiron Building ao anoitecer, por Edward Steichen", [40.741, -73.99]],
  ["san-francisco-ruins", 1906, "San Francisco in ruin edit2.jpg",
    "San Francisco in ruins after the earthquake and fire, photographed from a kite by George R. Lawrence",
    "San Francisco em ruínas depois do terremoto e do incêndio, fotografada de uma pipa por George R. Lawrence", [37.79, -122.4]],
  ["fourteen-bis-donkey", 1906, "Santos-Dumont 14-bis cable test with donkey, July 1906.jpg",
    "Santos-Dumont's 14-bis tested hanging from a cable, pulled along by a donkey",
    "O 14-bis de Santos-Dumont testado pendurado num cabo, puxado por um burro", [48.86, 2.25]],
  ["steerage", 1907, "Alfred Stieglitz - The Steerage - Google Art Project.jpg",
    "\"The Steerage\": passengers on the lower decks of a liner, by Alfred Stieglitz",
    "\"A terceira classe\": passageiros nos conveses de baixo de um transatlântico, por Alfred Stieglitz"],
  ["mill-girl", 1908, "Child laborer.jpg",
    "A little spinner in a cotton mill in Newberry, South Carolina, by Lewis Hine",
    "Uma pequena fiandeira numa fábrica de algodão em Newberry, Carolina do Sul, por Lewis Hine", [34.27, -81.62]],
  ["kirillov-girls", 1909, "Russian peasant girls in front of a traditional wooden house in Kirillov.jpg",
    "Peasant girls in front of a wooden house, in colour, by Sergei Prokudin-Gorsky",
    "Moças camponesas diante de uma casa de madeira, em cores, por Serguei Prokudin-Gorski", [59.86, 38.38]],
  ["manhattan-bridge", 1909, "Manhattan Bridge Construction 1909.jpg",
    "The Manhattan Bridge under construction",
    "A Ponte de Manhattan em construção", [40.707, -73.991]],

  // 1910s
  ["brouhot-car", 1910, "A Brouhot car in Paris, 1910.jpg",
    "A Brouhot motor car in Paris",
    "Um automóvel Brouhot em Paris", [48.86, 2.34]],
  ["emir-of-bukhara", 1911, "Prokudin-Gorskii-19-v2.png",
    "Alim Khan, the Emir of Bukhara, in colour, by Sergei Prokudin-Gorsky",
    "Alim Khan, o emir de Bukhara, em cores, por Serguei Prokudin-Gorski", [39.77, 64.42]],
  ["titanic-departs", 1912, "RMS Titanic 3.jpg",
    "The Titanic leaving Southampton on her maiden voyage",
    "O Titanic deixando Southampton na viagem inaugural", [50.9, -1.41]],
  ["ford-assembly-line", 1913, "Ford assembly line - 1913.jpg",
    "The moving assembly line at Ford's Highland Park plant",
    "A linha de montagem móvel na fábrica da Ford em Highland Park", [42.41, -83.1]],
  ["pankhurst-arrest", 1914, "Mrs Emmeline Pankhurst, Leader of the Women's Suffragette movement, is arrested outside Buckingham Palace while trying to present a petition to King George V in May 1914. Q81486.jpg",
    "The suffragette leader Emmeline Pankhurst arrested outside Buckingham Palace",
    "A líder sufragista Emmeline Pankhurst presa diante do Palácio de Buckingham", [51.501, -0.142]],
  ["endurance-in-ice", 1915, "Endurance trapped in pack ice.jpg",
    "Shackleton's ship Endurance trapped in the pack ice of the Weddell Sea, by Frank Hurley",
    "O navio Endurance, de Shackleton, preso no gelo do mar de Weddell, por Frank Hurley", [-69, -51]],
  ["wall-street-strand", 1915, "Wall Street by Paul Strand, 1915.jpg",
    "\"Wall Street\": passers-by dwarfed by a bank's windows, by Paul Strand",
    "\"Wall Street\": transeuntes diminuídos pelas janelas de um banco, por Paul Strand", [40.706, -74.009]],
  ["somme-trench", 1916, "Cheshire Regiment trench Somme 1916.jpg",
    "British soldiers in a trench during the Battle of the Somme, one keeping watch",
    "Soldados britânicos numa trincheira durante a Batalha do Somme, um deles de vigia", [50.01, 2.7]],
  ["petrograd-july-days", 1917, "19170704 Riot on Nevsky prosp Petrograd.jpg",
    "Demonstrators scattering under gunfire on Nevsky Prospect, Petrograd, in the July Days",
    "Manifestantes fugindo dos tiros na Avenida Nevski, em Petrogrado, nas Jornadas de Julho", [59.934, 30.33]],
  ["armistice-london", 1918, "Armistice Day in London, 11 November 1918 Q47852.jpg",
    "Crowds celebrating the armistice that ended the First World War, in London",
    "Multidão comemorando o armistício que encerrou a Primeira Guerra Mundial, em Londres", [51.507, -0.128]],

  // 1920s
  ["power-house-mechanic", 1920, "Lewis Hine Power house mechanic working on steam pump.jpg",
    "\"Power House Mechanic Working on Steam Pump\", by Lewis Hine",
    "\"Mecânico da casa de força trabalhando numa bomba a vapor\", por Lewis Hine"],
  ["einstein-1921", 1921, "Albert Einstein 1921 by F Schmutzer.jpg",
    "The physicist Albert Einstein, by Ferdinand Schmutzer, the year he won the Nobel Prize",
    "O físico Albert Einstein, por Ferdinand Schmutzer, no ano em que ganhou o Nobel"],
  ["eclipse-saint-lazare", 1921, "Agence Rol, L’éclipse, gare Saint-Lazare, 1921.jpg",
    "Parisians watching an eclipse of the Sun outside the Gare Saint-Lazare",
    "Parisienses observando um eclipse do Sol diante da estação Saint-Lazare", [48.876, 2.325]],
  ["tutankhamun-antechamber", 1922, "Tutankhamun tomb photographs 2 020.jpg",
    "The antechamber of Tutankhamun's tomb, just opened, by Harry Burton",
    "A antecâmara do túmulo de Tutancâmon, recém-aberta, por Harry Burton", [25.74, 32.6]],
  ["bea-kyle", 1924, "Bea Kyle Standing Fire Engine and Pickle 1924, edited.jpg",
    "The high diver Beatrice Kyle by a fire engine, between acts of a charity circus at Fort Myer, Virginia",
    "A saltadora Beatrice Kyle junto a um carro de bombeiros, num intervalo de um circo beneficente em Fort Myer, Virgínia", [38.88, -77.08]],
  ["bertha-lutz", 1925, "Bertha Lutz 1925.jpg",
    "The scientist and feminist Bertha Lutz",
    "A cientista e feminista Bertha Lutz"],
  ["monolith-half-dome", 1927, "Ansel-adams-monolith-the-face-of-half-dome - edit1.jpg",
    "\"Monolith, the Face of Half Dome\", in Yosemite, by Ansel Adams",
    "\"Monólito, a face do Half Dome\", em Yosemite, por Ansel Adams", [37.746, -119.533]],
  ["spirit-of-st-louis", 1927, "Charles Lindbergh and airplane \"Spirit of St. Louis\" LCCN2016888581.jpg",
    "Charles Lindbergh with the Spirit of St. Louis, the plane of the first solo non-stop flight across the Atlantic",
    "Charles Lindbergh com o Spirit of St. Louis, o avião do primeiro voo solo sem escalas sobre o Atlântico"],
  ["inupiat-family", 1929, "Inupiat Family from Noatak, Alaska, 1929, Edward S. Curtis (restored).jpg",
    "An Iñupiat family from Noatak, Alaska, by Edward S. Curtis",
    "Uma família inupiat de Noatak, Alasca, por Edward S. Curtis", [67.57, -162.97]],

  // 1930s
  ["icarus-empire-state", 1930, "Icarus, Empire State Building MET DP106525.jpg",
    "\"Icarus\": a worker high on the frame of the Empire State Building, by Lewis Hine",
    "\"Ícaro\": um operário no alto da estrutura do Empire State Building, por Lewis Hine", [40.748, -73.986]],
  ["lunch-atop-a-skyscraper", 1932, "Lunch atop a Skyscraper - Charles Clyde Ebbets.jpg",
    "\"Lunch atop a Skyscraper\": ironworkers eating on a girder above Manhattan, on the RCA Building",
    "\"Almoço no topo de um arranha-céu\": operários comendo numa viga sobre Manhattan, no RCA Building", [40.759, -73.979]],
  ["soba-deliveryman", 1935, "Soba-Noodles-Deliveryman-Tokyo-1935.png",
    "A soba noodle deliveryman cycling through Tokyo with a tower of bowls",
    "Um entregador de soba pedalando por Tóquio com uma torre de tigelas", [35.68, 139.76]],
  ["champs-elysees-night", 1935, "Auto's op de Champs-Elysées, met op de achtergrond de verlichte showroom van Cit, Bestanddeelnr 191-0378.jpg",
    "Cars on the Champs-Élysées at night, with a lit-up car showroom behind",
    "Carros na Champs-Élysées à noite, com uma loja de automóveis iluminada ao fundo", [48.87, 2.307]],
  ["migrant-mother", 1936, "Lange-MigrantMother02.jpg",
    "\"Migrant Mother\": Florence Owens Thompson and her children, by Dorothea Lange",
    "\"Mãe migrante\": Florence Owens Thompson e os filhos, por Dorothea Lange", [35.04, -120.48]],
  ["dust-storm-farmer", 1936, "Farmer walking in dust storm Cimarron County Oklahoma2.jpg",
    "A farmer and his sons walking in a dust storm in the Dust Bowl, by Arthur Rothstein",
    "Um fazendeiro e os filhos caminhando numa tempestade de poeira no Dust Bowl, por Arthur Rothstein", [36.75, -102.5]],
  ["bessie-smith", 1936, "Bessie Smith (1936) by Carl Van Vechten.jpg",
    "The blues singer Bessie Smith, by Carl Van Vechten",
    "A cantora de blues Bessie Smith, por Carl Van Vechten"],
  ["owens-and-long", 1936, "Luz Long and Jesse Owens.png",
    "Jesse Owens and Luz Long, rivals and friends, at the Berlin Olympics",
    "Jesse Owens e Luz Long, rivais e amigos, nas Olimpíadas de Berlim", [52.515, 13.239]],
  ["hindenburg", 1937, "Hindenburg disaster, 1937.jpg",
    "The airship Hindenburg bursting into flames at Lakehurst, New Jersey",
    "O dirigível Hindenburg pegando fogo em Lakehurst, Nova Jersey", [40.03, -74.35]],
  ["colored-water-cooler", 1939, "Negro drinking at \"Colored\" water cooler in streetcar terminal, Oklahoma City, Oklahoma by Russell Lee.jpg",
    "A man drinking at a segregated water cooler in Oklahoma City, by Russell Lee",
    "Um homem bebendo num bebedouro segregado em Oklahoma City, por Russell Lee", [35.47, -97.52]],

  // 1940s
  ["wait-for-me-daddy", 1940, "British Columbia Regiment 1940.jpg",
    "\"Wait for Me, Daddy\": a boy runs after his father as soldiers march off to war, New Westminster",
    "\"Espere por mim, papai\": um menino corre atrás do pai enquanto soldados partem para a guerra, New Westminster", [49.2, -122.91]],
  ["st-pauls-survives", 1940, "St Paul's Survives.jpg",
    "\"St Paul's Survives\": the cathedral's dome in the smoke of the Blitz",
    "\"St Paul's sobrevive\": a cúpula da catedral na fumaça da Blitz", [51.514, -0.098]],
  ["vultee-riveter", 1943, "Rosie the Riveter (Vultee).jpg",
    "A real-life \"Rosie the Riveter\" drilling on a dive bomber at the Vultee plant in Nashville",
    "Uma \"Rosie the Riveter\" de verdade trabalhando com a furadeira num bombardeiro na fábrica da Vultee em Nashville", [36.12, -86.68]],
  ["tehran-conference", 1943, "Joseph Stalin, Franklin D Roosevelt and Winston Churchill, in Teheran, 1943, edit.jpg",
    "Stalin, Roosevelt and Churchill at the Tehran Conference",
    "Stálin, Roosevelt e Churchill na Conferência de Teerã", [35.69, 51.42]],
  ["into-the-jaws", 1944, "Into the Jaws of Death 23-0455M edit.jpg",
    "\"Into the Jaws of Death\": American troops wading ashore at Omaha Beach on D-Day",
    "\"Nas mandíbulas da morte\": soldados americanos desembarcando na praia de Omaha no Dia D", [49.37, -0.87]],
  ["iwo-jima-flag", 1945, "Raising the Flag on Iwo Jima, larger.jpeg",
    "\"Raising the Flag on Iwo Jima\", by Joe Rosenthal",
    "\"Hasteando a bandeira em Iwo Jima\", por Joe Rosenthal", [24.75, 141.29]],
  ["kissing-the-war-goodbye", 1945, "Kissing the War Goodbye.jpg",
    "A sailor kisses a woman in Times Square on V-J Day, by Victor Jorgensen",
    "Um marinheiro beija uma mulher na Times Square no Dia da Vitória sobre o Japão, por Victor Jorgensen", [40.758, -73.985]],
  ["first-photo-from-space", 1946, "First photo from space.jpg",
    "The first photo from space, taken from a V-2 rocket over New Mexico",
    "A primeira foto do espaço, tirada de um foguete V-2 sobre o Novo México", [32.9, -106.4]],
  ["armstrong-in-colour", 1947, "Louis Armstrong in Color (restored).jpg",
    "The jazz trumpeter Louis Armstrong, in colour, by William P. Gottlieb",
    "O trompetista de jazz Louis Armstrong, em cores, por William P. Gottlieb"],
  ["dali-atomicus", 1948, "Salvador Dali A (Dali Atomicus) 09633u.jpg",
    "\"Dalí Atomicus\": Salvador Dalí in mid-air with flying cats and a splash of water, by Philippe Halsman",
    "\"Dalí Atomicus\": Salvador Dalí no ar com gatos voando e um jato de água, por Philippe Halsman"],

  // 1950s
  ["taedong-bridge", 1950, "Max Desfor - Flight of Refugees Across Wrecked Bridge in Korea.jpg",
    "Refugees crossing a wrecked bridge over the Taedong River in the Korean War, by Max Desfor",
    "Refugiados atravessando uma ponte destruída sobre o rio Taedong na Guerra da Coreia, por Max Desfor", [39.02, 125.75]],
  ["einstein-tongue", 1951, "Albert Einstein sticks his tongue.jpg",
    "Albert Einstein sticking out his tongue on his birthday, by Arthur Sasse",
    "Albert Einstein mostrando a língua no aniversário, por Arthur Sasse", [40.35, -74.66]],
  ["pit-river-rescue", 1953, "Rescue on Pit River Bridge (sharpened).jpg",
    "A truck driver rescued from his cab hanging off the Pit River Bridge, California",
    "Um caminhoneiro resgatado da cabine pendurada na ponte do rio Pit, Califórnia", [40.75, -122.31]],
  ["seven-year-itch", 1954, "Marilyn Monroe photo pose Seven Year Itch, edit.jpg",
    "Marilyn Monroe's famous pose over a subway grate, for the film \"The Seven Year Itch\"",
    "A famosa pose de Marilyn Monroe sobre a grade do metrô, para o filme \"O pecado mora ao lado\""],
  ["althea-gibson", 1956, "Althea Gibson in 1956 by Fred Palumbo (NYWTS).jpg",
    "The tennis champion Althea Gibson",
    "A campeã de tênis Althea Gibson"],
  ["rosa-parks", 1956, "Rosa Parks being fingerprinted by Deputy Sheriff D.H. Lackey after being arrested on February 22, 1956, during the Montgomery bus boycott.jpg",
    "Rosa Parks being fingerprinted after her arrest during the Montgomery bus boycott",
    "Rosa Parks tendo as digitais colhidas depois de presa, durante o boicote aos ônibus de Montgomery", [32.377, -86.3]],
  ["milk-drop-coronet", 1957, "Milk Drop Coronet, 1957.jpg",
    "\"Milk Drop Coronet\": a splash of milk frozen by Harold Edgerton's stroboscope",
    "\"Coroa de gota de leite\": um respingo de leite congelado pelo estroboscópio de Harold Edgerton"],
  ["faith-and-confidence", 1957, "Faith and Confidence.jpg",
    "\"Faith and Confidence\": a police officer talks to a two-year-old at a Chinese New Year parade in Washington, D.C.",
    "\"Fé e confiança\": um policial conversa com um menino de dois anos num desfile do Ano-Novo Chinês em Washington"],
  ["segni-adenauer", 1959, "Antonio Segni and Konrad Adenauer by Giuseppe Moro, August 1959.jpg",
    "The Italian prime minister Antonio Segni and the German chancellor Konrad Adenauer, by Giuseppe Moro",
    "O primeiro-ministro italiano Antonio Segni e o chanceler alemão Konrad Adenauer, por Giuseppe Moro"],
  ["brasilia-construction", 1959, "Construção de Brasília 1959-37.jpg",
    "Brasília under construction, the year before it became the capital",
    "Brasília em construção, um ano antes de virar a capital", [-15.8, -47.86]],

  // 1960s
  ["kittinger-jump", 1960, "Kittinger-jump.jpg",
    "Joseph Kittinger jumping from a balloon gondola 31 km up, a record that stood for half a century",
    "Joseph Kittinger saltando da gôndola de um balão a 31 km de altura, recorde que durou meio século", [32.9, -106.1]],
  ["guerrillero-heroico", 1960, "Che Guevara - Guerrillero Heroico by Alberto Korda.jpg",
    "\"Guerrillero Heroico\": Che Guevara, by Alberto Korda",
    "\"Guerrillero Heroico\": Che Guevara, por Alberto Korda", [23.13, -82.38]],
  ["ruby-bridges", 1960, "US Marshals with Young Ruby Bridges on School Steps.jpg",
    "US Marshals escorting six-year-old Ruby Bridges to her newly desegregated school in New Orleans",
    "Agentes federais escoltando Ruby Bridges, de seis anos, à escola recém-dessegregada em Nova Orleans", [29.96, -90.03]],
  ["march-on-washington", 1963, "Civil Rights March on Washington, D.C. (Dr. Martin Luther King, Jr. and Mathew Ahmann in a crowd.) - NARA - 542015 - Restoration.jpg",
    "Martin Luther King Jr. in the crowd of the March on Washington",
    "Martin Luther King Jr. na multidão da Marcha sobre Washington", [38.889, -77.035]],
  ["malcolm-x", 1964, "Malcolm X NYWTS 2a.jpg",
    "Malcolm X at a press conference",
    "Malcolm X numa entrevista coletiva"],
  ["katherine-johnson", 1966, "Katherine Johnson at NASA, in 1966.jpg",
    "The mathematician Katherine Johnson at her desk at NASA",
    "A matemática Katherine Johnson na sua mesa na NASA", [37.09, -76.38]],
  ["western-wall-paratroopers", 1967, "צנחנים בכותל המערבי.jpg",
    "Israeli paratroopers at the Western Wall in the Six-Day War, by David Rubinger",
    "Paraquedistas israelenses no Muro das Lamentações na Guerra dos Seis Dias, por David Rubinger", [31.777, 35.234]],
  ["artists-against-censorship", 1968, "Artistas protestam contra a Ditadura Militar - Tônia Carreiro, Eva Wilma, Odete Lara, Norma Bengell e Cacilda Becker - Restoration.jpg",
    "The actresses Tônia Carrero, Eva Wilma, Odete Lara, Norma Bengell and Cacilda Becker protesting against censorship under the military dictatorship in Brazil",
    "As atrizes Tônia Carrero, Eva Wilma, Odete Lara, Norma Bengell e Cacilda Becker protestando contra a censura da ditadura militar no Brasil", [-22.906, -43.176]],
  ["earthrise", 1968, "NASA Earthrise AS08-14-2383 Apollo 8 1968-12-24.jpg",
    "\"Earthrise\": the Earth rising over the Moon, taken by Bill Anders from Apollo 8 in orbit around the Moon",
    "\"Nascer da Terra\": a Terra surgindo sobre a Lua, foto de Bill Anders da Apollo 8 em órbita da Lua"],
  ["aldrin-on-the-moon", 1969, "Aldrin Apollo 11.jpg",
    "Buzz Aldrin on the Moon during Apollo 11, photographed by Neil Armstrong",
    "Buzz Aldrin na Lua durante a Apollo 11, fotografado por Neil Armstrong"],

  // 1970s
  ["elvis-meets-nixon", 1970, "Elvis Presley, Delbert Sonny West, and Jerry Schilling meeting Richard Nixon.jpg",
    "Elvis Presley and his friends Sonny West and Jerry Schilling meeting President Richard Nixon at the White House",
    "Elvis Presley e os amigos Sonny West e Jerry Schilling com o presidente Richard Nixon na Casa Branca", [38.897, -77.037]],
  ["apollo-15-rover", 1971, "Apollo 15 flag, rover, LM, Irwin.jpg",
    "James Irwin with the flag, the lunar rover and the lander of the Apollo 15 mission",
    "Na missão Apollo 15, James Irwin com a bandeira, o jipe lunar e o módulo lunar"],
  ["blue-marble", 1972, "The Blue Marble, AS17-148-22727.jpg",
    "\"The Blue Marble\": the whole Earth, seen from Apollo 17 on its way to the Moon",
    "\"A bolinha azul\": a Terra inteira, vista da Apollo 17 a caminho da Lua"],
  ["kathmandu-hashish-shop", 1973, "Legal hashish shop in Kathmandu, Nepal in 1973.jpg",
    "A legal hashish shop in Kathmandu, a stop on the hippie trail",
    "Uma loja legal de haxixe em Katmandu, parada da trilha hippie", [27.704, 85.307]],
  ["leonov", 1974, "Alexei Leonov.jpg",
    "The cosmonaut Alexei Leonov, the first person to walk in space",
    "O cosmonauta Alexei Leonov, a primeira pessoa a caminhar no espaço"],
  ["apollo-soyuz-crews", 1975, "Portrait of ASTP crews - restoration.jpg",
    "The American and Soviet crews of Apollo–Soyuz, the first joint space mission",
    "As tripulações americana e soviética da Apollo–Soyuz, a primeira missão espacial conjunta"],
  ["shuttle-enterprise", 1976, "The Shuttle Enterprise - GPN-2000-001363.jpg",
    "The first space shuttle, Enterprise, rolled out with the cast of \"Star Trek\"",
    "O primeiro ônibus espacial, o Enterprise, apresentado com o elenco de \"Jornada nas Estrelas\"", [34.63, -118.08]],
  ["godot-avignon", 1978, "En attendant Godot, Festival d'Avignon, 1978 f22.jpg",
    "\"Waiting for Godot\" on stage at the Avignon Festival",
    "\"Esperando Godot\" no palco do Festival de Avignon", [43.95, 4.807]],
  ["mary-jackson", 1979, "Mary Jackson 1979 Portrait (LRC-1979-B701 P-07085).jpg",
    "The NASA engineer Mary Jackson",
    "A engenheira da NASA Mary Jackson"],

  // 1980s
  ["boat-people", 1980, "Vietnamkrieg Bootsflüchtling 1980.jpg",
    "A young Vietnamese refugee, one of the \"boat people\", in a camp in Malaysia",
    "Um jovem refugiado vietnamita, um dos \"boat people\", num campo na Malásia"],
  ["mount-st-helens", 1980, "MSH80 eruption mount st helens 05-18-80-dramatic-edit.jpg",
    "The eruption of Mount St. Helens",
    "A erupção do monte Santa Helena", [46.2, -122.19]],
  ["first-shuttle-launch", 1981, "Space Shuttle Columbia launching.jpg",
    "The first launch of a space shuttle: Columbia lifts off",
    "O primeiro lançamento de um ônibus espacial: o Columbia decola", [28.608, -80.604]],
  ["gainsbourg", 1981, "Serge Gainsbourg par Claude Truong-Ngoc 1981.jpg",
    "The singer Serge Gainsbourg, by Claude Truong-Ngoc",
    "O cantor Serge Gainsbourg, por Claude Truong-Ngoc"],
  ["vietnam-memorial-veteran", 1982, "World War I veteran Joseph Ambrose, 86, at the dedication day parade for the Vietnam Veterans Memorial in 1982.jpg",
    "Joseph Ambrose, a First World War veteran, holding his son's flag at the dedication of the Vietnam Veterans Memorial",
    "Joseph Ambrose, veterano da Primeira Guerra Mundial, com a bandeira do filho na inauguração do Memorial dos Veteranos do Vietnã", [38.891, -77.048]],
  ["mccandless-spacewalk", 1984, "Bruce McCandless II during EVA in 1984.jpg",
    "Bruce McCandless floating free in space on the first untethered spacewalk",
    "Bruce McCandless flutuando livre no espaço na primeira caminhada espacial sem cabo"],
  ["jobs-macintosh", 1984, "Steve Jobs and Macintosh computer, January 1984, by Bernard Gotfryd - edited.jpg",
    "Steve Jobs with the first Macintosh computer, by Bernard Gotfryd",
    "Steve Jobs com o primeiro computador Macintosh, por Bernard Gotfryd"],
  ["geneva-summit", 1985, "President Ronald Reagan and Soviet General Secretary Gorbachev at The First Summit in Geneva Switzerland - DPLA - b534f3d00bb05c3cc293789b180d2116.jpg",
    "Ronald Reagan and Mikhail Gorbachev at their first summit, in Geneva",
    "Ronald Reagan e Mikhail Gorbachev na primeira reunião de cúpula, em Genebra", [46.2, 6.15]],
  ["berlin-wall-opening", 1989, "A crowd of West German citizens gathers at the newly created opening in the Berlin Wall at Potsdamer Platz.jpg",
    "Crowds at a new opening in the Berlin Wall at Potsdamer Platz, days after it fell",
    "Multidão numa nova abertura do Muro de Berlim na Potsdamer Platz, dias depois da queda", [52.509, 13.376]],

  // 1990s
  ["mae-jemison", 1992, "Mae Carol Jemison.jpg",
    "The astronaut Mae Jemison aboard the space shuttle Endeavour",
    "A astronauta Mae Jemison a bordo do ônibus espacial Endeavour"],
  ["desert-storm-oil-fires", 1991, "Operation Desert Storm 22.jpg",
    "Oil wells set on fire in Kuwait at the end of the Gulf War",
    "Poços de petróleo incendiados no Kuwait no fim da Guerra do Golfo", [29.0, 47.9]],
  ["oslo-accords-handshake", 1993, "Bill Clinton, Yitzhak Rabin, Yasser Arafat at the White House 1993-09-13.jpg",
    "Yitzhak Rabin and Yasser Arafat shake hands, with Bill Clinton, at the signing of the Oslo Accords",
    "Yitzhak Rabin e Yasser Arafat apertam as mãos, com Bill Clinton, na assinatura dos Acordos de Oslo", [38.897, -77.037]],
  ["hubble-repair", 1993, "Repair-Hubble-2-shuttle.jpg",
    "Astronauts repairing the Hubble Space Telescope from the space shuttle Endeavour",
    "Astronautas consertando o Telescópio Espacial Hubble a partir do ônibus espacial Endeavour"],
  ["atlantis-docked-to-mir", 1995, "Atlantis docked to MIR - GPN-2000-001315.jpg",
    "The space shuttle Atlantis docked to the Mir space station",
    "O ônibus espacial Atlantis acoplado à estação espacial Mir"],
  ["pillars-of-creation", 1995, "Eagle.column1.arp.750pix.jpg",
    "One of the \"Pillars of Creation\" in the Eagle Nebula, from the Hubble Space Telescope",
    "Um dos \"Pilares da Criação\" na Nebulosa da Águia, do Telescópio Espacial Hubble"],
  ["atlantis-rollout", 1996, "STS-79 rollout.jpg",
    "The space shuttle Atlantis rolling out to its launch pad",
    "O ônibus espacial Atlantis a caminho da plataforma de lançamento", [28.6, -80.6]],
  ["sojourner", 1997, "Sojourner on Mars PIA01122.jpg",
    "The rover Sojourner on Mars, the first wheeled vehicle on another planet",
    "O jipe Sojourner em Marte, o primeiro veículo com rodas em outro planeta"],
  ["zarya-module", 1998, "Zarya from STS-88.jpg",
    "Zarya, the first module of the International Space Station, seen from the space shuttle Endeavour",
    "O Zarya, primeiro módulo da Estação Espacial Internacional, visto do ônibus espacial Endeavour"],

  // 2000s
  ["elk-bath", 2000, "Deerfire high res.jpg",
    "\"Elk Bath\": elk sheltering in a river from a forest fire in Montana, by John McColgan",
    "\"Banho de alces\": alces se abrigando num rio de um incêndio florestal em Montana, por John McColgan", [45.7, -114.0]],
  ["concorde-final-flights", 2003, "Concorde The Final YYZ-JFK-LHR Flight (4385501371).jpg",
    "Concorde on one of its final flights, the year it was retired",
    "O Concorde num dos últimos voos, no ano em que foi aposentado"],
  ["soyuz-launch", 2004, "Soyuz TMA-5 launch.jpg",
    "A Soyuz rocket lifting off from Baikonur with a crew for the International Space Station",
    "Um foguete Soyuz decolando de Baikonur com uma tripulação para a Estação Espacial Internacional", [45.92, 63.34]],
  ["metallica", 2004, "James Hetfield with Metallica -- 7 October 2004.jpg",
    "James Hetfield on stage with Metallica",
    "James Hetfield no palco com o Metallica"],
  ["space-station", 2005, "ISS Aug2005.jpg",
    "The International Space Station, seen from the departing space shuttle Discovery",
    "A Estação Espacial Internacional vista do ônibus espacial Discovery, ao partir"],
  ["katrina-flooding", 2005, "KatrinaNewOrleansFlooded edit2.jpg",
    "New Orleans flooded after Hurricane Katrina",
    "Nova Orleans inundada depois do furacão Katrina", [29.95, -90.07]],
  ["iphone-keynote", 2007, "Steve Jobs presents iPhone.jpg",
    "Steve Jobs presenting the first iPhone",
    "Steve Jobs apresentando o primeiro iPhone", [37.784, -122.401]],
  ["obama-inauguration", 2009, "Crowd at National Mall for Obama inauguration 1-20-09 hires 090120-F-6184M-007a.jpg",
    "The crowd on the National Mall for Barack Obama's inauguration",
    "A multidão no National Mall para a posse de Barack Obama", [38.889, -77.023]],
];

// ── Commons ─────────────────────────────────────────────────────────────────

const META_FIELDS = ["License", "LicenseShortName", "LicenseUrl", "UsageTerms", "NonFree", "Artist", "Credit", "DateTimeOriginal", "ObjectName"].join("|");

/** What Commons says about each file, keyed by the name asked for. */
async function fileInfos(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 40) {
    const chunk = files.slice(i, i + 40);
    const url =
      `${COMMONS_API}?action=query&format=json&formatversion=2&prop=imageinfo` +
      `&iiprop=url|size|mime|extmetadata&iiurlwidth=${FETCH_WIDTH}&iiextmetadatafilter=${META_FIELDS}` +
      `&titles=${encodeURIComponent(chunk.map((file) => `File:${file}`).join("|"))}`;
    const data = await getJson(url);
    const asked = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    const redirects = new Map((data.query?.redirects ?? []).map((r) => [r.to, r.from]));
    for (const page of data.query?.pages ?? []) {
      let title = page.title;
      title = redirects.get(title) ?? title;
      title = asked.get(title) ?? title;
      const info = page.imageinfo?.[0];
      if (info) out.set(title.replace(/^File:/, ""), { ...info, file: page.title.replace(/^File:/, "") });
    }
  }
  return out;
}

/** Free licences only: public domain, CC0, CC BY and CC BY-SA (any version). */
function isFree(meta) {
  const value = (key) => plain(meta?.[key]?.value);
  if (value("NonFree") === "true") return false;
  const code = value("License").toLowerCase();
  if (/^(pd\b|pd-|cc0|cc-zero|cc-by-(sa-)?\d(\.\d)?\b)/.test(code)) return true;
  if (code) return false;
  const name = value("LicenseShortName").toLowerCase();
  return /^(public domain|pd\b|cc0|cc by(-sa)? \d(\.\d)?\b|no restrictions)/.test(name);
}

/** The years Commons gives for the file's own date, if it reads as one. */
function commonsYears(meta) {
  const text = plain(meta?.DateTimeOriginal?.value);
  return [...new Set((text.match(/\b(1[89]\d\d|20[0-2]\d)\b/g) ?? []).map(Number))];
}

const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  );

/** The photo's file name under public/snaps: opaque, but always the same for the same id. */
const savedName = (id) => `${createHash("sha1").update(`www:year-snap:${id}`).digest("hex").slice(0, 12)}.jpg`;

/**
 * Saves a photo, cut down by `trim` (fractions of each side) when its mount or
 * margin prints something that would give the year away.
 */
async function savePhoto(id, info, trim) {
  const file = savedName(id);
  const out = path.join(OUT_DIR, file);
  if (!(await exists(out))) {
    const res = await politeFetch(info.thumburl ?? info.url);
    let buffer = Buffer.from(await res.arrayBuffer());
    if (trim) {
      const upright = await sharp(buffer).rotate().toBuffer({ resolveWithObject: true });
      const { width, height } = upright.info;
      const left = Math.round(width * (trim.left ?? 0));
      const top = Math.round(height * (trim.top ?? 0));
      buffer = await sharp(upright.data)
        .extract({
          left,
          top,
          width: Math.round(width * (1 - (trim.right ?? 0))) - left,
          height: Math.round(height * (1 - (trim.bottom ?? 0))) - top,
        })
        .toBuffer();
    }
    await sharp(buffer)
      .rotate()
      .flatten({ background: "#000000" })
      .resize({ width: WIDTH, height: HEIGHT, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
      .toFile(out);
  }
  const meta = await sharp(out).metadata();
  return { src: `/${FOLDER}/${file}`, width: meta.width, height: meta.height };
}

async function writePhotos(photos) {
  const sorted = [...photos].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  await writeFile(OUT_JSON, JSON.stringify(sorted, null, 1) + "\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

const decadeOf = (year) => Math.floor(year / 10) * 10;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const entries = ROSTER.map(([id, year, file, en, pt, at, options]) => ({ id, year, file, caption: { en, pt }, at, ...options }));

  // The roster itself: unique ids, exact years in range, captions that read well.
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate id ${entry.id}`);
    ids.add(entry.id);
    if (!Number.isInteger(entry.year) || entry.year < 1830 || entry.year > 2025) throw new Error(`Bad year for ${entry.id}`);
    for (const text of Object.values(entry.caption))
      if (!text || /\d$/.test(text.trim())) throw new Error(`Caption of ${entry.id} is empty or ends in a digit`);
  }

  const infos = await fileInfos(entries.map((entry) => entry.file));
  const photos = [];
  const problems = [];
  const perDecade = new Map();

  for (const entry of entries) {
    const info = infos.get(entry.file);
    const why = !info
      ? "not on Commons"
      : !isFree(info.extmetadata)
        ? `licence (${plain(info.extmetadata?.LicenseShortName?.value) || "none"})`
        : !/^image\/(jpeg|png|tiff|webp)$/.test(info.mime)
          ? `type ${info.mime}`
          : info.width < MIN_WIDTH
            ? `too small (${info.width}px)`
            : null;
    if (why) {
      problems.push(`${entry.id}: ${why}`);
      continue;
    }
    const decade = decadeOf(entry.year);
    if ((perDecade.get(decade) ?? 0) >= PER_DECADE) {
      problems.push(`${entry.id}: the ${decade}s are full`);
      continue;
    }
    const years = commonsYears(info.extmetadata);
    if (years.length && !years.includes(entry.year))
      console.log(`  note ${entry.id}: Commons dates it ${plain(info.extmetadata.DateTimeOriginal.value).slice(0, 60)}`);
    if (CHECK_ONLY) {
      perDecade.set(decade, (perDecade.get(decade) ?? 0) + 1);
      continue;
    }
    try {
      const image = await savePhoto(entry.id, info, entry.trim);
      photos.push({
        id: entry.id,
        year: entry.year,
        caption: entry.caption,
        ...(entry.at ? { place: { lat: entry.at[0], lon: entry.at[1] } } : {}),
        image: { ...image, credit: creditFrom("commons", info.file, info.extmetadata) },
      });
      perDecade.set(decade, (perDecade.get(decade) ?? 0) + 1);
      process.stdout.write(".");
      // Saved as it goes: a run stopped by the rate limits still leaves a usable roster.
      if (photos.length % 10 === 0) await writePhotos(photos);
    } catch (err) {
      problems.push(`${entry.id}: download failed (${err.message})`);
    }
  }

  console.log("");
  for (const problem of problems) console.log(`  skipped ${problem}`);
  console.log(
    [...perDecade]
      .sort((a, b) => a[0] - b[0])
      .map(([decade, n]) => `${decade}s ${n}`)
      .join(" · "),
  );
  if (CHECK_ONLY) return;

  await writePhotos(photos);
  console.log(`${photos.length} photos → ${path.relative(ROOT, OUT_JSON)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
