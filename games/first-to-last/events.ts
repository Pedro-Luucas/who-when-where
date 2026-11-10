import { seededShuffle } from "@/lib/daily";
import { distanceKm } from "@/lib/geo";
import type { Localized } from "@/lib/i18n";

export type HistoryEvent = {
  id: string;
  /** Negative for BC. */
  year: number;
  /** The year is approximate ("c. 2560 BC"). */
  circa: boolean;
  lat: number;
  lon: number;
  name: Localized;
  place: Localized;
};

// One line per event: id, year, lat, lon, what happened (en, pt), where
// (en, pt — the Portuguese name may be left out when it is the same), and
// "c" when the year is approximate. The name must not give the year away.
// prettier-ignore
const RAW: [string, number, number, number, string, string, string, string?, "c"?][] = [
  // ── Europe ──
  ["bastille", 1789, 48.85, 2.37, "Storming of the Bastille", "Queda da Bastilha", "Paris"],
  ["waterloo", 1815, 50.68, 4.41, "Battle of Waterloo", "Batalha de Waterloo", "Waterloo"],
  ["gutenberg", 1455, 50.0, 8.27, "Gutenberg prints his Bible", "Gutenberg imprime sua Bíblia", "Mainz", "Mogúncia", "c"],
  ["luther", 1517, 51.87, 12.65, "Luther posts his 95 theses", "Lutero divulga suas 95 teses", "Wittenberg"],
  ["london-fire", 1666, 51.51, -0.09, "Great Fire of London", "Grande Incêndio de Londres", "London", "Londres"],
  ["lisbon-quake", 1755, 38.71, -9.14, "The great Lisbon earthquake", "O grande terremoto de Lisboa", "Lisbon", "Lisboa"],
  ["berlin-wall", 1989, 52.52, 13.4, "Fall of the Berlin Wall", "Queda do Muro de Berlim", "Berlin", "Berlim"],
  ["vesuvius", 79, 40.75, 14.49, "Vesuvius buries Pompeii", "O Vesúvio soterra Pompeia", "Pompeii", "Pompeia"],
  ["hastings", 1066, 50.91, 0.49, "Battle of Hastings", "Batalha de Hastings", "Hastings"],
  ["magna-carta", 1215, 51.44, -0.57, "King John seals Magna Carta", "O rei João sela a Magna Carta", "Runnymede"],
  ["caesar", -44, 41.9, 12.48, "Assassination of Julius Caesar", "Assassinato de Júlio César", "Rome", "Roma"],
  ["marathon", -490, 38.15, 23.96, "Battle of Marathon", "Batalha de Maratona", "Marathon", "Maratona"],
  ["olympics-athens", 1896, 37.97, 23.73, "First modern Olympic Games", "Primeiros Jogos Olímpicos modernos", "Athens", "Atenas"],
  ["sarajevo", 1914, 43.86, 18.43, "Assassination of Archduke Franz Ferdinand", "Assassinato do arquiduque Francisco Ferdinando", "Sarajevo"],
  ["october-revolution", 1917, 59.94, 30.31, "The October Revolution", "A Revolução de Outubro", "Petrograd", "Petrogrado"],
  ["chernobyl", 1986, 51.39, 30.1, "Chernobyl nuclear disaster", "Desastre nuclear de Chernobyl", "Chernobyl"],
  ["stalingrad", 1943, 48.71, 44.51, "German surrender at Stalingrad", "Rendição alemã em Stalingrado", "Stalingrad", "Stalingrado"],
  ["carnation", 1974, 38.72, -9.14, "The Carnation Revolution", "A Revolução dos Cravos", "Lisbon", "Lisboa"],
  ["granada", 1492, 37.18, -3.6, "Fall of Granada ends the Reconquista", "A queda de Granada encerra a Reconquista", "Granada"],
  ["eiffel", 1889, 48.86, 2.29, "The Eiffel Tower opens", "Inauguração da Torre Eiffel", "Paris"],
  ["charlemagne", 800, 41.9, 12.45, "Charlemagne is crowned emperor", "Carlos Magno é coroado imperador", "Rome", "Roma"],
  ["trafalgar", 1805, 36.18, -6.03, "Battle of Trafalgar", "Batalha de Trafalgar", "Cape Trafalgar", "Cabo Trafalgar"],
  ["versailles", 1919, 48.8, 2.12, "Treaty of Versailles is signed", "Assinatura do Tratado de Versalhes", "Versailles", "Versalhes"],
  ["westphalia", 1648, 51.96, 7.63, "Peace of Westphalia", "Paz de Vestfália", "Münster"],
  ["guernica", 1937, 43.31, -2.68, "Bombing of Guernica", "Bombardeio de Guernica", "Guernica"],
  ["lepanto", 1571, 38.25, 21.25, "Battle of Lepanto", "Batalha de Lepanto", "Gulf of Patras", "Golfo de Patras"],
  ["althing", 930, 64.26, -21.12, "Iceland's Althing first meets", "Primeira reunião do Althing da Islândia", "Þingvellir"],
  ["lindisfarne", 793, 55.68, -1.8, "Vikings raid Lindisfarne", "Vikings saqueiam Lindisfarne", "Lindisfarne"],
  ["d-day", 1944, 49.37, -0.88, "D-Day landings", "Desembarque do Dia D", "Normandy", "Normandia"],
  ["black-death", 1347, 38.19, 15.55, "The Black Death reaches Europe", "A Peste Negra chega à Europa", "Messina"],
  ["bologna", 1088, 44.49, 11.34, "Europe's oldest university is founded", "Fundação da universidade mais antiga da Europa", "Bologna", "Bolonha"],
  ["napoleon-moscow", 1812, 55.75, 37.62, "Napoleon enters Moscow", "Napoleão entra em Moscou", "Moscow", "Moscou"],
  ["gdansk", 1980, 54.35, 18.65, "Shipyard strike gives birth to Solidarity", "Greve no estaleiro dá origem ao Solidariedade", "Gdańsk"],
  ["14-bis", 1906, 48.86, 2.24, "Santos-Dumont flies the 14-bis", "Santos Dumont voa com o 14-bis", "Paris"],
  ["constantinople", 1453, 41.01, 28.98, "Fall of Constantinople", "Queda de Constantinopla", "Constantinople", "Constantinopla"],
  ["hagia-sophia", 537, 41.01, 28.98, "Hagia Sophia is completed", "Conclusão de Santa Sofia", "Constantinople", "Constantinopla"],

  // ── Middle East, North Africa & Central Asia ──
  ["giza", -2560, 29.98, 31.13, "The Great Pyramid is completed", "Conclusão da Grande Pirâmide", "Giza", "Gizé", "c"],
  ["suez", 1869, 31.26, 32.3, "The Suez Canal opens", "Inauguração do Canal de Suez", "Port Said"],
  ["baghdad-founded", 762, 33.31, 44.36, "Founding of Baghdad", "Fundação de Bagdá", "Baghdad", "Bagdá"],
  ["baghdad-sack", 1258, 33.34, 44.4, "The Mongols sack Baghdad", "Os mongóis saqueiam Bagdá", "Baghdad", "Bagdá"],
  ["hijra", 622, 24.47, 39.61, "The Hijra: Muhammad arrives in Medina", "A Hégira: Maomé chega a Medina", "Medina"],
  ["jerusalem-1099", 1099, 31.78, 35.23, "Crusaders capture Jerusalem", "Os cruzados tomam Jerusalém", "Jerusalem", "Jerusalém"],
  ["alexandria", -331, 31.2, 29.92, "Alexander founds Alexandria", "Alexandre funda Alexandria", "Alexandria"],
  ["tutankhamun", 1922, 25.74, 32.6, "Tutankhamun's tomb is discovered", "Descoberta da tumba de Tutancâmon", "Valley of the Kings", "Vale dos Reis"],
  ["rosetta", 1799, 31.4, 30.42, "The Rosetta Stone is found", "A Pedra de Roseta é encontrada", "Rosetta", "Roseta"],
  ["carthage", -146, 36.85, 10.32, "Rome destroys Carthage", "Roma destrói Cartago", "Carthage", "Cartago"],
  ["hammurabi", -1754, 32.54, 44.42, "The Code of Hammurabi", "O Código de Hamurábi", "Babylon", "Babilônia", "c"],
  ["iran-revolution", 1979, 35.69, 51.39, "The Iranian Revolution", "A Revolução Iraniana", "Tehran", "Teerã"],
  ["turkish-republic", 1923, 39.93, 32.86, "Atatürk proclaims the Turkish Republic", "Atatürk proclama a República da Turquia", "Ankara", "Ancara"],
  ["persepolis", -330, 29.93, 52.89, "Alexander burns Persepolis", "Alexandre incendeia Persépolis", "Persepolis", "Persépolis"],
  ["mansa-musa", 1324, 30.04, 31.24, "Mansa Musa's golden caravan reaches Cairo", "A caravana de ouro de Mansa Musa chega ao Cairo", "Cairo"],
  ["aswan", 1970, 23.97, 32.88, "The Aswan High Dam is completed", "Conclusão da Grande Represa de Assuã", "Aswan", "Assuã"],
  ["sputnik", 1957, 45.92, 63.34, "Sputnik, the first satellite, is launched", "Lançamento do Sputnik, o primeiro satélite", "Baikonur"],
  ["talas", 751, 42.52, 72.23, "Battle of Talas", "Batalha de Talas", "Talas"],
  ["timur", 1370, 39.65, 66.96, "Timur makes Samarkand his capital", "Tamerlão faz de Samarcanda sua capital", "Samarkand", "Samarcanda"],

  // ── Sub-Saharan Africa ──
  ["mandela", 1990, -33.92, 18.42, "Nelson Mandela walks free", "Nelson Mandela é libertado", "Cape Town", "Cidade do Cabo"],
  ["cape-town", 1652, -33.93, 18.42, "The Dutch found Cape Town", "Os holandeses fundam a Cidade do Cabo", "Cape Town", "Cidade do Cabo"],
  ["dias", 1488, -34.36, 18.47, "Bartolomeu Dias rounds the Cape of Good Hope", "Bartolomeu Dias dobra o Cabo da Boa Esperança", "Cape of Good Hope", "Cabo da Boa Esperança"],
  ["adwa", 1896, 14.17, 38.9, "Battle of Adwa", "Batalha de Adwa", "Adwa"],
  ["ghana", 1957, 5.56, -0.2, "Ghana becomes independent", "Independência de Gana", "Accra", "Acra"],
  ["livingstone", 1871, -4.91, 29.67, "\"Dr Livingstone, I presume?\"", "\"Dr. Livingstone, eu presumo?\"", "Ujiji"],
  ["isandlwana", 1879, -28.35, 30.65, "Battle of Isandlwana", "Batalha de Isandlwana", "Isandlwana"],
  ["lucy", 1974, 11.1, 40.6, "The fossil \"Lucy\" is discovered", "Descoberta do fóssil \"Lucy\"", "Hadar"],
  ["witwatersrand", 1886, -26.2, 28.05, "Gold is found on the Witwatersrand", "Descoberta de ouro no Witwatersrand", "Johannesburg", "Joanesburgo"],
  ["tondibi", 1591, 16.6, -0.2, "Battle of Tondibi topples the Songhai Empire", "A Batalha de Tondibi derruba o Império Songai", "Tondibi"],
  ["kenya", 1963, -1.29, 36.82, "Kenya becomes independent", "Independência do Quênia", "Nairobi", "Nairóbi"],
  ["zanzibar-war", 1896, -6.16, 39.19, "The shortest war in history", "A guerra mais curta da história", "Zanzibar"],
  ["malindi", 1498, -3.22, 40.12, "Vasco da Gama reaches Malindi", "Vasco da Gama chega a Melinde", "Malindi", "Melinde"],

  // ── South Asia ──
  ["taj-mahal", 1653, 27.17, 78.04, "The Taj Mahal is completed", "Conclusão do Taj Mahal", "Agra"],
  ["plassey", 1757, 23.8, 88.25, "Battle of Plassey", "Batalha de Plassey", "Plassey"],
  ["india-independence", 1947, 28.61, 77.21, "India becomes independent", "Independência da Índia", "New Delhi", "Nova Délhi"],
  ["salt-march", 1930, 20.89, 72.8, "Gandhi's Salt March reaches the sea", "A Marcha do Sal de Gandhi chega ao mar", "Dandi"],
  ["kalinga", -261, 20.19, 85.84, "Ashoka's Kalinga War", "Guerra de Kalinga, de Ashoka", "Kalinga", undefined, "c"],
  ["calicut", 1498, 11.25, 75.78, "Vasco da Gama lands in India", "Vasco da Gama desembarca na Índia", "Calicut", "Calecute"],
  ["everest", 1953, 27.99, 86.93, "First ascent of Mount Everest", "Primeira escalada do Everest", "Mount Everest", "Monte Everest"],
  ["hydaspes", -326, 32.83, 73.64, "Alexander fights King Porus", "Alexandre enfrenta o rei Poro", "Hydaspes River", "Rio Hidaspes"],
  ["panipat", 1526, 29.39, 76.97, "First Battle of Panipat founds the Mughal Empire", "A Primeira Batalha de Panipat funda o Império Mogol", "Panipat"],

  // ── East & South-East Asia ──
  ["hiroshima", 1945, 34.39, 132.45, "Atomic bombing of Hiroshima", "Bomba atômica sobre Hiroshima", "Hiroshima"],
  ["meiji", 1868, 35.01, 135.77, "The Meiji Restoration", "A Restauração Meiji", "Kyoto", "Quioto"],
  ["perry", 1853, 35.24, 139.72, "Commodore Perry's black ships arrive", "Chegada dos navios negros do comodoro Perry", "Edo Bay", "Baía de Edo"],
  ["forbidden-city", 1420, 39.92, 116.39, "The Forbidden City is completed", "Conclusão da Cidade Proibida", "Beijing", "Pequim"],
  ["prc", 1949, 39.9, 116.4, "The People's Republic of China is proclaimed", "Proclamação da República Popular da China", "Beijing", "Pequim"],
  ["qin", -221, 34.33, 108.71, "Qin Shi Huang unifies China", "Qin Shi Huang unifica a China", "Xianyang"],
  ["saigon", 1975, 10.78, 106.7, "Fall of Saigon", "Queda de Saigon", "Saigon"],
  ["krakatoa", 1883, -6.1, 105.42, "Krakatoa erupts", "Erupção do Krakatoa", "Sunda Strait", "Estreito de Sunda"],
  ["angkor-wat", 1150, 13.41, 103.87, "Angkor Wat is built", "Construção de Angkor Wat", "Angkor", undefined, "c"],
  ["mactan", 1521, 10.31, 124.0, "Magellan is killed in battle", "Magalhães é morto em combate", "Mactan"],
  ["singapore", 1819, 1.29, 103.85, "Raffles founds modern Singapore", "Raffles funda a Singapura moderna", "Singapore", "Singapura"],
  ["genghis", 1206, 48.5, 110.5, "Temüjin is proclaimed Genghis Khan", "Temujin é proclamado Gêngis Khan", "Onon River", "Rio Onon"],
  ["hangul", 1446, 37.58, 126.98, "King Sejong publishes the Korean alphabet", "O rei Sejong publica o alfabeto coreano", "Seoul", "Seul"],
  ["tokyo-olympics", 1964, 35.68, 139.71, "The first Olympics held in Asia", "Primeira Olimpíada realizada na Ásia", "Tokyo", "Tóquio"],
  ["hong-kong", 1997, 22.3, 114.17, "Hong Kong is handed back to China", "Devolução de Hong Kong à China", "Hong Kong"],
  ["dien-bien-phu", 1954, 21.39, 103.02, "Battle of Dien Bien Phu", "Batalha de Dien Bien Phu", "Dien Bien Phu"],
  ["borobudur", 825, -7.61, 110.2, "Borobudur is completed", "Conclusão de Borobudur", "Java", undefined, "c"],
  ["tambora", 1815, -8.25, 118.0, "Tambora erupts, causing a \"year without a summer\"", "Erupção do Tambora, que causa o \"ano sem verão\"", "Sumbawa"],
  ["wuchang", 1911, 30.55, 114.31, "The Wuchang Uprising brings down China's last dynasty", "A Revolta de Wuchang derruba a última dinastia chinesa", "Wuchang"],
  ["tunguska", 1908, 60.89, 101.89, "The Tunguska explosion", "A explosão de Tunguska", "Siberia", "Sibéria"],

  // ── Oceania, the Pacific & the poles ──
  ["first-fleet", 1788, -33.86, 151.21, "The First Fleet lands convicts in Australia", "A Primeira Frota desembarca condenados na Austrália", "Sydney Cove"],
  ["waitangi", 1840, -35.27, 174.08, "Treaty of Waitangi", "Tratado de Waitangi", "Waitangi"],
  ["cook-death", 1779, 19.48, -155.93, "Captain Cook is killed", "Morte do capitão Cook", "Kealakekua Bay", "Baía de Kealakekua"],
  ["pearl-harbor", 1941, 21.36, -157.95, "Attack on Pearl Harbor", "Ataque a Pearl Harbor", "Pearl Harbor"],
  ["south-pole", 1911, -89.9, 0, "Amundsen reaches the South Pole", "Amundsen chega ao Polo Sul", "South Pole", "Polo Sul"],
  ["opera-house", 1973, -33.86, 151.22, "The Sydney Opera House opens", "Inauguração da Ópera de Sydney", "Sydney"],
  ["castle-bravo", 1954, 11.69, 165.27, "The Castle Bravo hydrogen bomb test", "O teste da bomba de hidrogênio Castle Bravo", "Bikini Atoll", "Atol de Bikini"],
  ["eureka", 1854, -37.56, 143.85, "The Eureka Stockade rebellion", "A rebelião da Eureka Stockade", "Ballarat"],
  ["bounty", 1789, -19.75, -175.07, "Mutiny on the Bounty", "Motim do Bounty", "off Tofua", "ao largo de Tofua"],
  ["easter-island", 1722, -27.11, -109.35, "Europeans first sight Easter Island", "Europeus avistam a Ilha de Páscoa pela primeira vez", "Easter Island", "Ilha de Páscoa"],

  // ── North America & the Caribbean ──
  ["columbus", 1492, 24.06, -74.53, "Columbus makes landfall in the Americas", "Colombo desembarca nas Américas", "San Salvador (Bahamas)"],
  ["independence", 1776, 39.95, -75.15, "The United States declares independence", "Os Estados Unidos declaram independência", "Philadelphia", "Filadélfia"],
  ["mayflower", 1620, 41.96, -70.67, "The Mayflower pilgrims land", "Desembarque dos peregrinos do Mayflower", "Plymouth"],
  ["wright", 1903, 36.02, -75.67, "The Wright brothers' first powered flight", "Primeiro voo motorizado dos irmãos Wright", "Kitty Hawk"],
  ["gold-rush", 1848, 38.8, -120.89, "Gold at Sutter's Mill starts the California Gold Rush", "Ouro em Sutter's Mill inicia a Corrida do Ouro da Califórnia", "Coloma"],
  ["golden-spike", 1869, 41.62, -112.55, "The first transcontinental railroad is completed", "Conclusão da primeira ferrovia transcontinental", "Promontory Summit"],
  ["gettysburg", 1863, 39.81, -77.23, "Battle of Gettysburg", "Batalha de Gettysburg", "Gettysburg"],
  ["apollo-11", 1969, 28.57, -80.65, "Apollo 11 lifts off for the Moon", "A Apollo 11 decola rumo à Lua", "Cape Canaveral", "Cabo Canaveral"],
  ["jfk", 1963, 32.78, -96.81, "Assassination of John F. Kennedy", "Assassinato de John F. Kennedy", "Dallas"],
  ["trinity", 1945, 33.68, -106.48, "Trinity, the first nuclear test", "Trinity, o primeiro teste nuclear", "New Mexico", "Novo México"],
  ["sf-quake", 1906, 37.77, -122.42, "The great San Francisco earthquake", "O grande terremoto de São Francisco", "San Francisco", "São Francisco"],
  ["vinland", 1000, 51.6, -55.53, "Norse sailors settle in Vinland", "Navegadores nórdicos se instalam em Vinlândia", "L'Anse aux Meadows", undefined, "c"],
  ["quebec", 1608, 46.81, -71.21, "Champlain founds Quebec", "Champlain funda Quebec", "Quebec"],
  ["klondike", 1896, 64.06, -139.43, "Gold strike starts the Klondike rush", "Descoberta de ouro inicia a corrida do Klondike", "Klondike"],
  ["woodstock", 1969, 41.7, -74.88, "The Woodstock festival", "O festival de Woodstock", "Bethel (New York)", "Bethel (Nova York)"],
  ["tea-party", 1773, 42.35, -71.05, "The Boston Tea Party", "A Festa do Chá de Boston", "Boston"],
  ["alaska", 1867, 57.05, -135.33, "Russia hands Alaska to the United States", "A Rússia entrega o Alasca aos Estados Unidos", "Sitka"],
  ["chicago-fire", 1871, 41.88, -87.63, "The Great Chicago Fire", "O Grande Incêndio de Chicago", "Chicago"],
  ["tenochtitlan", 1521, 19.43, -99.13, "Tenochtitlan falls to Cortés", "Tenochtitlán cai diante de Cortés", "Tenochtitlan", "Tenochtitlán"],
  ["dolores", 1810, 21.16, -100.93, "The Cry of Dolores", "O Grito de Dolores", "Dolores"],
  ["panama-canal", 1914, 9.08, -79.68, "The Panama Canal opens", "Inauguração do Canal do Panamá", "Panama", "Panamá"],
  ["havana", 1959, 23.13, -82.38, "Fidel Castro enters Havana", "Fidel Castro entra em Havana", "Havana"],
  ["haiti", 1804, 19.45, -72.68, "Haiti declares independence", "O Haiti declara independência", "Gonaïves"],

  // ── South America ──
  ["cabral", 1500, -16.44, -39.06, "Cabral's fleet reaches Brazil", "A esquadra de Cabral chega ao Brasil", "Porto Seguro"],
  ["ipiranga", 1822, -23.58, -46.61, "The Cry of Ipiranga", "O Grito do Ipiranga", "São Paulo"],
  ["lei-aurea", 1888, -22.9, -43.18, "The Golden Law abolishes slavery in Brazil", "A Lei Áurea abole a escravidão no Brasil", "Rio de Janeiro"],
  ["brasilia", 1960, -15.79, -47.88, "Brasília is inaugurated", "Inauguração de Brasília", "Brasília"],
  ["cajamarca", 1532, -7.16, -78.51, "Pizarro captures the Inca emperor Atahualpa", "Pizarro captura o imperador inca Atahualpa", "Cajamarca"],
  ["machu-picchu", 1911, -13.16, -72.55, "Hiram Bingham is led to Machu Picchu", "Hiram Bingham é levado a Machu Picchu", "Machu Picchu"],
  ["tucuman", 1816, -26.82, -65.22, "Argentina declares independence", "A Argentina declara independência", "Tucumán"],
  ["ayacucho", 1824, -13.16, -74.22, "Battle of Ayacucho", "Batalha de Ayacucho", "Ayacucho"],
  ["boyaca", 1819, 5.45, -73.43, "Bolívar wins the Battle of Boyacá", "Bolívar vence a Batalha de Boyacá", "Boyacá"],
  ["salvador", 1549, -12.97, -38.51, "Salvador is founded as Brazil's first capital", "Fundação de Salvador, primeira capital do Brasil", "Salvador"],
  ["court-rio", 1808, -22.91, -43.17, "The Portuguese court arrives in Rio", "A corte portuguesa chega ao Rio", "Rio de Janeiro"],
  ["potosi", 1545, -19.58, -65.75, "Silver is found at Potosí", "Descoberta de prata em Potosí", "Potosí"],
  ["chile-coup", 1973, -33.44, -70.65, "Military coup against Salvador Allende", "Golpe militar contra Salvador Allende", "Santiago"],
  ["world-cup", 1930, -34.9, -56.16, "The first football World Cup final", "Final da primeira Copa do Mundo de futebol", "Montevideo", "Montevidéu"],
  ["maracanazo", 1950, -22.91, -43.23, "The Maracanaço: Uruguay beats Brazil", "O Maracanaço: o Uruguai vence o Brasil", "Rio de Janeiro"],
  ["palmares", 1694, -9.17, -36.08, "The Quilombo dos Palmares is destroyed", "Destruição do Quilombo dos Palmares", "Serra da Barriga"],
  ["teatro-amazonas", 1896, -3.13, -60.02, "An opera house opens in the rainforest", "Inauguração de um teatro de ópera na floresta", "Manaus"],
  ["canudos", 1897, -9.96, -39.16, "The War of Canudos ends", "Fim da Guerra de Canudos", "Canudos"],
  ["galapagos", 1835, -0.83, -90.98, "Darwin lands on the Galápagos", "Darwin desembarca nas Galápagos", "Galápagos"],
];

export const EVENTS: HistoryEvent[] = RAW.map(
  ([id, year, lat, lon, en, pt, placeEn, placePt, circa]) => ({
    id,
    year,
    circa: circa === "c",
    lat,
    lon,
    name: { en, pt },
    place: { en: placeEn, pt: placePt ?? placeEn },
  }),
);

const byId = new Map(EVENTS.map((event) => [event.id, event]));

export const eventById = (id: string): HistoryEvent | undefined => byId.get(id);

/** Events in one puzzle. */
export const PUZZLE_SIZE = 6;

// Two events can share a puzzle only if their order is a fair question and
// their pins don't sit on top of each other on a world map.
const MIN_YEARS_APART = 5;
const MIN_KM_APART = 2500;

const compatible = (a: HistoryEvent, b: HistoryEvent) =>
  Math.abs(a.year - b.year) >= MIN_YEARS_APART && distanceKm(a, b) >= MIN_KM_APART;

// Days per cycle. A little less than EVENTS / PUZZLE_SIZE, because a few
// events are left without a compatible group in each shuffle.
const CYCLE_DAYS = Math.floor(EVENTS.length / PUZZLE_SIZE) - 3;

const cycles = new Map<number, HistoryEvent[][]>();

/** Deals a cycle's shuffled events into puzzles, first fit. */
function puzzlesOfCycle(cycle: number): HistoryEvent[][] {
  let puzzles = cycles.get(cycle);
  if (!puzzles) {
    const open: HistoryEvent[][] = [];
    for (const event of seededShuffle(EVENTS, `first-to-last:${cycle}`)) {
      const fit = open.find(
        (group) => group.length < PUZZLE_SIZE && group.every((other) => compatible(other, event)),
      );
      if (fit) fit.push(event);
      else open.push([event]);
    }
    puzzles = open.filter((group) => group.length === PUZZLE_SIZE);
    cycles.set(cycle, puzzles);
  }
  return puzzles;
}

/** The day's six events, in the (shuffled) order they are lettered A–F. */
export function eventsForDay(day: number): HistoryEvent[] {
  const n = day - 1;
  const puzzles = puzzlesOfCycle(Math.floor(n / CYCLE_DAYS));
  const position = ((n % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS;
  return puzzles[position % puzzles.length];
}

/** The same events, earliest first. */
export const chronological = (events: HistoryEvent[]): HistoryEvent[] =>
  [...events].sort((a, b) => a.year - b.year);
