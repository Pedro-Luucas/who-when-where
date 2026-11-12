// Words that give a place away: countries, nationalities, peoples, empires and
// kingdoms, regions, seas and rivers, and big or famous cities — in English and
// Portuguese. Used two ways:
//
//   findGiveaways(text)        what in a clue, hint or description names a place
//   stripNationality(text, l)  "English naturalist and biologist" → "Naturalist and biologist"
//
// The data scripts strip descriptions with it, and scripts/check-giveaways.mjs
// fails when any text a player sees before the answer still has one.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const json = (file) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));

// ── English ────────────────────────────────────────────────────────────────

/** Nationalities and demonyms, modern and historical. Matched with or without a plural "s". */
const DEMONYMS_EN = `
Afghan Albanian Algerian American Andorran Angolan Antiguan Argentine Argentinian Armenian Australian Austrian
Azerbaijani Azeri Bahamian Bahraini Bangladeshi Barbadian Belarusian Belgian Belizean Beninese Bhutanese Bolivian
Bosnian Botswanan Brazilian British Bruneian Bulgarian Burkinabe Burmese Burundian Cambodian Cameroonian Canadian
Cape Verdean Chadian Chilean Chinese Colombian Comorian Congolese Costa Rican Croatian Cuban Cypriot Czech Danish
Djiboutian Dominican Dutch Ecuadorian Egyptian Emirati English Equatoguinean Eritrean Estonian Ethiopian Fijian
Filipino Finnish Flemish French Gabonese Gambian Georgian German Ghanaian Greek Grenadian Guatemalan Guinean
Guyanese Haitian Honduran Hungarian Icelandic Indian Indonesian Iranian Iraqi Irish Israeli Italian Ivorian
Jamaican Japanese Jordanian Kazakh Kazakhstani Kenyan Kiribati Korean Kosovar Kuwaiti Kyrgyz Lao Laotian Latvian
Lebanese Liberian Libyan Liechtensteiner Lithuanian Luxembourgish Macedonian Malagasy Malawian Malaysian Maldivian
Malian Maltese Marshallese Mauritanian Mauritian Mexican Micronesian Moldovan Monegasque Mongolian Montenegrin
Moroccan Mozambican Namibian Nauruan Nepalese Nepali New Zealander Nicaraguan Nigerian Nigerien Norwegian Omani
Pakistani Palauan Palestinian Panamanian Papuan Paraguayan Peruvian Polish Portuguese Qatari Romanian Russian
Rwandan Salvadoran Samoan Saudi Scottish Scots Senegalese Serbian Seychellois Singaporean Slovak Slovenian Somali
South African Spanish Sri Lankan Sudanese Surinamese Swazi Swedish Swiss Syrian Taiwanese Tajik Tanzanian Thai
Timorese Togolese Tongan Trinidadian Tunisian Turkish Turkmen Tuvaluan Ugandan Ukrainian Uruguayan Uzbek
Venezuelan Vietnamese Welsh Yemeni Zambian Zimbabwean Brazillian Phillipine
Prussian Bavarian Castilian Catalan Basque Galician Andalusian Florentine Venetian Genoese Neapolitan Sicilian
Sardinian Milanese Roman Parisian Viennese Corsican Breton Cornish Bohemian Moravian Silesian Flemish Walloon
Anglo-Irish Anglo-Saxon Bengali Punjabi Tamil Gujarati Sindhi Kashmiri Tibetan Cantonese Manchu Uyghur Persian
Ottoman Soviet Yugoslav Czechoslovak Andalusi Texan Californian Hawaiian Bostonian Carioca Paulista Hong Kong
Scandinavian Iberian Balkan Baltic Caucasian Siberian Patagonian Andean Amazonian Saharan Arabian Levantine
Mesopotamian Anatolian Hellenic Hellenistic Byzantine Latin American Latino Hispanic Caribbean Mediterranean
African European Asian Oceanian Polynesian Melanesian Pacific Atlantic Arctic Antarctic Nordic Celtic Gaelic
Mesoamerican Pre-Columbian Precolumbian
`;

/** Peoples, cultures and dynasties that pin a place down. */
const PEOPLES_EN = `
Inca Incan Incas Maya Mayan Mayas Aztec Aztecs Olmec Toltec Zapotec Mixtec Moche Chimu Chimú Nazca Wari Tiwanaku
Muisca Taino Taíno Arawak Puebloan Anasazi Hohokam Mississippian Iroquois Cherokee Lakota Sioux Navajo Hopi Inuit
Maori Māori Rapa Nui Aboriginal Khmer Cham Angkorian Srivijayan Majapahit Javanese Balinese Burman Siamese
Nabataean Nabataeans Phoenician Phoenicians Punic Carthaginian Etruscan Etruscans Minoan Mycenaean Spartan Athenian
Trojan Macedonian Thracian Dacian Illyrian Celt Celts Gaul Gauls Briton Britons Pict Picts Saxon Saxons Norman Normans
Viking Vikings Norse Frankish Franks Visigoth Visigoths Ostrogoth Lombard Lombards Vandal Vandals Hun Huns Goth Goths
Mongol Mongols Tatar Tatars Turkic Seljuk Mughal Mughals Rajput Maratha Chola Gupta Maurya Mauryan Kushan Vedic
Harappan Sumerian Sumerians Akkadian Babylonian Babylonians Assyrian Assyrians Hittite Hittites Elamite Median
Achaemenid Parthian Sasanian Sassanid Seleucid Ptolemaic Pharaonic Kushite Nubian Nubians Aksumite Axumite
Shona Swahili Zulu Xhosa Yoruba Igbo Hausa Ashanti Akan Bantu Berber Berbers Tuareg Bedouin Moor Moors Moorish
Arab Arabs Jewish Hebrew Israelite Israelites Judean Samaritan Canaanite Philistine Armenian Kurdish Druze
Han Tang Ming Qing Zhou Shang Qin Yuan Joseon Goryeo Silla Edo Heian Tokugawa Ainu
Habsburg Bourbon Tudor Stuart Plantagenet Romanov Medici Carolingian Merovingian Umayyad Abbasid Fatimid
Mamluk Almohad Almoravid Nasrid Safavid Timurid Ghaznavid Khmer Toltecs Olmecs Zapotecs
Bedonkohe Chiricahua Lenape Shawnee Comanches Guarani Guaraní Tupi Tupinamba Tupinambá Tairona Quechua Aymara Mapuche Kalinago Mohawk Apache Comanche Pueblo
`;

/** States, empires and kingdoms as words. */
const POLITY_EN = `
empire empires imperial kingdom kingdoms dynasty dynasties caliphate caliphates sultanate sultanates khanate
khanates emirate emirates principality republic of confederacy commonwealth of tsardom shogunate
`;

/** Regions, seas, rivers, mountains, deserts, continents and old place names. */
const REGIONS_EN = `
Africa Asia Europe America Americas Oceania Antarctica Eurasia Australasia
North America South America Central America Latin America New World Old World Middle East Near East Far East
Orient Occident Sahara Sahel Kalahari Gobi Negev Sinai Arabia Persia Anatolia Asia Minor Levant Mesopotamia
Fertile Crescent Caucasus Balkans Scandinavia Siberia Patagonia Yucatan Yucatán Mesoamerica Andes Alps Pyrenees
Himalaya Himalayas Hindu Kush Pamir Tibet Deccan Bengal Punjab Kashmir Gujarat Rajasthan Indochina Polynesia
Melanesia Micronesia Iberia Gaul Britannia Hispania Germania Bohemia Moravia Silesia Prussia Bavaria Saxony
Castile Aragon Catalonia Andalusia Tuscany Lombardy Sicily Sardinia Corsica Crete Cyprus Rhodes Malta Anatolia
Thrace Macedonia Byzantium Constantinople Judea Judaea Galilee Canaan Phoenicia Nubia Kush Aksum Axum Abyssinia
Carthage Numidia Mauretania Maghreb Barbary Cathay Siam Ceylon Formosa Burma Persia Mughal Manchuria Mongolia
Amazon Amazonia Orinoco Nile Congo Niger Zambezi Limpopo Indus Ganges Brahmaputra Yangtze Yellow River Mekong
Irrawaddy Tigris Euphrates Jordan River Danube Rhine Rhône Seine Thames Tiber Po Volga Dnieper Mississippi
Missouri Rio Grande Colorado River Yukon St Lawrence Mediterranean Aegean Adriatic Ionian Tyrrhenian Baltic
North Sea Black Sea Red Sea Dead Sea Caspian Arabian Sea Persian Gulf Gulf of Mexico Caribbean Pacific Atlantic
Indian Ocean Arctic Southern Ocean Bosporus Bosphorus Dardanelles Gibraltar Silk Road Great Rift Valley
Rift Valley Serengeti Kilimanjaro Everest Vesuvius Etna Olympus Ararat Fuji Sumatra Java Borneo Bali Luzon
Mindanao Honshu Hokkaido Tasmania Madagascar Zanzibar Sri Lanka Greenland Iceland Hawaii Easter Island
Galápagos Galapagos Tierra del Fuego Cape Horn Cape of Good Hope Strait of Magellan Mohave Mojave Atacama
Altiplano Titicaca Cusco Cuzco Yucatan Chiapas Oaxaca Petén Peten Guatemala Highlands Pampas Gran Chaco
Outback Kimberley Arnhem Land Great Barrier Reef Uluru Ayers Rock Scotland England Wales Ulster Cornwall
Holland Flanders Wallonia Normandy Brittany Provence Burgundy Alsace Lorraine Gascony Aquitaine Navarre Galicia
Asturias Lusitania Bactria Sogdiana Khorasan Transoxiana Turkestan Hejaz Yemen Oman Dalmatia Illyria Dacia
Cappadocia Lydia Phrygia Ionia Attica Peloponnese Laconia Boeotia Euboea Sparta Athens Rome Troy Babylon Nineveh
Ur Uruk Memphis Thebes Luxor Karnak Giza Alexandria Jerusalem Bethlehem Nazareth Mecca Medina Damascus Baghdad
Byblos Tyre Sidon Petra Palmyra Persepolis Pompeii Herculaneum Ostia Mycenae Knossos Delphi Olympia Ephesus
Pergamon Angkor Bagan Ayutthaya Kyoto Nara Xi'an Xian Beijing Peking Nanjing Teotihuacan Tenochtitlan Chichen Itza
Tikal Palenque Machu Picchu Cahokia Timbuktu Kilwa Mombasa Zimbabwe Meroë Meroe Aksum Lalibela Fez Marrakesh
Cordoba Córdoba Granada Seville Toledo Venice Florence Naples Milan Paris London Vienna Berlin Moscow Lisbon
Madrid Istanbul Cairo Tehran Delhi Agra Varanasi Kathmandu Lhasa Samarkand Bukhara Kabul Herodium Masada
Hadrian's Wall Holy Land Promised Land Iberian Peninsula Arabian Peninsula Indian subcontinent Subcontinent
Horn of Africa Gold Coast Ivory Coast Slave Coast Spice Islands Moluccas West Indies East Indies
`;

/**
 * Rulers, gods and heroes tied to one place: a clue that names them gives the
 * site away ("Herod's fortress", "the city of Priam and Hector").
 */
const FIGURES_EN = `
Herod Herodes Pharaoh Pharaohs Caesar Caesars Augustus Hadrian Trajan Nero Constantine Justinian Charlemagne
Alexander Darius Xerxes Cyrus Hammurabi Nebuchadnezzar Gilgamesh Sargon Ramesses Ramses Tutankhamun Akhenaten
Nefertiti Cleopatra Hatshepsut Khufu Cheops Priam Hector Achilles Agamemnon Odysseus Homer Homer's Minos Theseus
Pachacuti Atahualpa Montezuma Moctezuma Suryavarman Jayavarman Ashoka Akbar Shah Jahan Genghis Kublai Tamerlane
Timur Saladin Hannibal Dido Pericles Leonidas Romulus Vishnu Shiva Buddha Zeus Athena
Poseidon Osiris Isis Anubis Amun Quetzalcoatl Kukulkan Inti Viracocha
Marduk Ishtar Baal Confucius Laozi Mansa Musa Sundiata Shaka Menelik Ezana
Herod's Hadrian's Priam's
`;

// ── Portuguese ─────────────────────────────────────────────────────────────

/**
 * Portuguese nationalities by their masculine singular; the feminine and
 * plural forms are made by rule ("inglês" → inglesa, ingleses, inglesas).
 */
const DEMONYMS_PT = `
afegão albanês argelino americano estadunidense norte-americano andorrano angolano argentino armênio arménio
australiano austríaco azerbaijano bahamense bareinita bengali bangladês barbadiano bielorrusso belga belizenho
beninense butanês boliviano bósnio bosniano botsuanês brasileiro britânico bruneano búlgaro burquinense birmanês
burundiano cambojano camaronês canadense canadiano cabo-verdiano chadiano chileno chinês colombiano comorense
congolês costarriquenho costa-riquenho croata cubano cipriota tcheco checo dinamarquês djibutiano dominicano
holandês neerlandês equatoriano egípcio emiradense emiratense inglês eritreu estoniano etíope fijiano filipino
finlandês flamengo francês gabonês gambiano georgiano alemão ganês grego granadino guatemalteco guineense guianense
haitiano hondurenho húngaro islandês indiano indonésio iraniano iraquiano irlandês israelense israelita
italiano marfinense jamaicano japonês jordaniano cazaque queniano coreano kosovar kuwaitiano quirguiz laosiano
letão libanês liberiano líbio liechtensteinense lituano luxemburguês macedônio macedónio malgaxe malauiano malaio
malásio maldívio maliano maltês marshallino mauritano mauriciano mexicano micronésio moldávio monegasco mongol
montenegrino marroquino moçambicano namibiano nauruano nepalês neozelandês nicaraguense nigeriano nigerino norueguês
omanense paquistanês palauano palestino panamenho papuásio paraguaio peruano polonês polaco português catarense
romeno russo ruandês salvadorenho samoano saudita escocês senegalês sérvio seichelense singapurense eslovaco
esloveno somali sul-africano espanhol cingalês sri-lankês sudanês surinamês suazi sueco suíço sírio taiwanês
tadjique tanzaniano tailandês timorense togolês tonganês trinitário tunisiano turco turcomeno tuvaluano ugandense
ucraniano uruguaio uzbeque venezuelano vietnamita galês iemenita zambiano zimbabuano
prussiano bávaro castelhano catalão basco galego andaluz florentino veneziano genovês napolitano siciliano
sardo milanês romano parisiense vienense corso bretão boêmio morávio flamengo valão anglo-saxão punjabi tâmil
tibetano cantonês manchu persa otomano soviético iugoslavo checoslovaco tchecoslovaco texano havaiano carioca
paulista nordestino gaúcho baiano pernambucano escandinavo ibérico balcânico báltico caucasiano siberiano
patagônico andino amazônico saariano arábico arábio levantino mesopotâmico anatólio helênico helenístico bizantino
latino-americano hispânico caribenho mediterrâneo africano europeu asiático oceânico polinésio melanésio nórdico
celta gaélico mesoamericano pré-colombiano luso-brasileiro
`;

const PEOPLES_PT = `
inca maia asteca olmeca tolteca zapoteca mixteca moche chimu nazca tiahuanaco muísca taino taíno aruaque iroquês
cheroqui navajo inuíte maori khmer quemer cham javanês balinês siamês nabateu fenício púnico cartaginês etrusco
minoico micênico espartano ateniense troiano trácio dácio ilírio gaulês bretão picto saxão normando viking nórdico
visigodo ostrogodo lombardo vândalo huno godo mongol tártaro turcomano seljúcida mogol mugal rajput marata
chola gupta máuria védico harapense sumério acádio babilônico babilônio assírio hitita elamita aquemênida
sassânida selêucida ptolomaico faraônico cuxita núbio axumita xona suaíli zulu xhosa iorubá igbo haúça
axânti banto berbere tuaregue beduíno mouro mourisco árabe judeu judaico hebreu israelita judeu-português cananeu
filisteu curdo druso habsburgo tudor romanov médici carolíngio merovíngio omíada abássida fatímida mameluco
almóada almorávida nasrida safávida timúrida
guarani tupi tupinambá tairona quíchua aimará mapuche apache comanche
`;

/** Titles and roles that belong to one culture: a "samurai" or a "conquistador" says where. */
const TITLES = `
samurai samurais shogun shoguns xógum daimyo daimio geisha gueixa maharaja maharajah
maharajá marajá rajá sultan sultão sultana tsar tsars tsarina tsarevich czar czarina czarevich kaiser mikado caliph califa
pharaoh pharaohs faraó faraós khedive quediva emir emires mandarim
`;

const POLITY_PT = `
império impérios imperial imperiais reino reinos dinastia dinastias califado califados sultanato sultanatos
canato canatos emirado emirados principado xogunato czarado
`;

const REGIONS_PT = `
África Ásia Europa América Américas Oceania Antártida Eurásia Australásia América do Norte América do Sul
América Central América Latina Novo Mundo Velho Mundo Oriente Médio Oriente Próximo Extremo Oriente Oriente
Ocidente Saara Sael Kalahari Gobi Negueve Sinai Arábia Pérsia Anatólia Ásia Menor Levante Mesopotâmia
Crescente Fértil Cáucaso Bálcãs Escandinávia Sibéria Patagônia Iucatã Iucatão Mesoamérica Andes Alpes Pirineus
Himalaia Indocina Polinésia Melanésia Micronésia Ibéria Gália Britânia Hispânia Germânia Boêmia Morávia Silésia
Prússia Baviera Saxônia Castela Aragão Catalunha Andaluzia Toscana Lombardia Sicília Sardenha Córsega Creta
Chipre Rodes Trácia Macedônia Bizâncio Constantinopla Judeia Galileia Canaã Fenícia Núbia Cuxe Axum Abissínia
Cartago Numídia Mauritânia Magrebe Catai Sião Ceilão Formosa Birmânia Manchúria Amazônia Amazonas Orinoco Nilo
Níger Zambeze Limpopo Indo Ganges Bramaputra Yangtzé Iangtzé Rio Amarelo Mekong Tigre Eufrates Rio Jordão Danúbio
Reno Ródano Sena Tâmisa Tibre Volga Dniepre Mississípi Mediterrâneo Egeu Adriático Jônico Tirreno Báltico
Mar do Norte Mar Negro Mar Vermelho Mar Morto Cáspio Mar Arábico Golfo Pérsico Golfo do México Caribe Pacífico
Atlântico Oceano Índico Ártico Bósforo Dardanelos Gibraltar Rota da Seda Vale do Rift Serengeti Kilimanjaro
Everest Vesúvio Etna Olimpo Ararat Fuji Sumatra Java Bornéu Bali Tasmânia Madagascar Zanzibar Groenlândia
Islândia Havaí Ilha de Páscoa Galápagos Terra do Fogo Cabo Horn Cabo da Boa Esperança Estreito de Magalhães
Atacama Altiplano Titicaca Cusco Cuzco Chiapas Oaxaca Petén Pampas Grande Chaco Escócia Inglaterra País de Gales
Holanda Flandres Normandia Bretanha Provença Borgonha Alsácia Lorena Gasconha Aquitânia Navarra Galiza Astúrias
Lusitânia Báctria Sogdiana Turquestão Hejaz Dalmácia Ilíria Dácia Capadócia Lídia Frígia Jônia Ática
Peloponeso Lacônia Beócia Eubeia Esparta Atenas Roma Troia Babilônia Nínive Uruk Mênfis Tebas Luxor Karnak Gizé
Alexandria Jerusalém Belém Nazaré Meca Medina Damasco Bagdá Biblos Tiro Sídon Petra Palmira Persépolis Pompeia
Herculano Óstia Micenas Cnossos Delfos Olímpia Éfeso Pérgamo Angkor Bagan Aiutaia Quioto Nara Xian Pequim Nanquim
Teotihuacan Tenochtitlán Chichén Itzá Tikal Palenque Machu Picchu Tombuctu Quíloa Mombaça Meroé Lalibela Fez
Marraquexe Córdoba Granada Sevilha Toledo Veneza Florença Nápoles Milão Paris Londres Viena Berlim Moscou Lisboa
Madri Istambul Cairo Teerã Délhi Agra Varanasi Catmandu Lassa Samarcanda Bucara Cabul Heródio Massada
Muralha de Adriano Terra Santa Terra Prometida Península Ibérica Península Arábica subcontinente indiano
Chifre da África Costa do Ouro Ilhas das Especiarias Molucas Índias Ocidentais Índias Orientais
`;

const FIGURES_PT = `
Herodes Faraó Faraós César Césares Augusto Adriano Trajano Nero Constantino Justiniano Carlos Magno Alexandre
Dario Xerxes Ciro Hamurábi Nabucodonosor Gilgamesh Sargão Ramsés Tutancâmon Aquenáton Nefertiti Cleópatra
Hatshepsut Quéops Príamo Heitor Aquiles Agamenon Ulisses Odisseu Homero Minos Teseu Pachacuti Atahualpa
Montezuma Moctezuma Suryavarman Jayavarman Asoka Axoca Akbar Xá Jahan Gengis Kublai Tamerlão Saladino
Aníbal Dido Péricles Leônidas Rômulo Vishnu Xiva Shiva Buda Zeus Atena
Poseidon Osíris Ísis Anúbis Amon Quetzalcóatl Kukulcán Inti Viracocha Marduk Ishtar
Baal Confúcio Lao-Tsé Mansa Musa Sundiata Shaka Menelik Ezana
`;

// ── Building the matchers ──────────────────────────────────────────────────

const words = (block) =>
  block
    .split(/\n/)
    .flatMap((line) => line.trim().split(/\s{2,}|\t/))
    .join(" ")
    .split(" ")
    .filter(Boolean);

/** Multi-word names ("Cape Verdean", "Rio Grande") in a block, kept whole; the rest one word each. */
function terms(block, multi) {
  const flat = block.replace(/\s+/g, " ").trim();
  const found = [];
  let rest = flat;
  for (const phrase of multi) {
    if (rest.includes(phrase)) {
      found.push(phrase);
      rest = rest.split(phrase).join(" ");
    }
  }
  return [...found, ...words(rest)];
}

const MULTI_EN = [
  "Cape Verdean", "Costa Rican", "New Zealander", "South African", "Sri Lankan", "Hong Kong", "Latin American",
  "Rapa Nui", "North America", "South America", "Central America", "Latin America", "New World", "Old World",
  "Middle East", "Near East", "Far East", "Asia Minor", "Fertile Crescent", "Hindu Kush", "Yellow River",
  "Jordan River", "Rio Grande", "Colorado River", "St Lawrence", "North Sea", "Black Sea", "Red Sea", "Dead Sea",
  "Arabian Sea", "Persian Gulf", "Gulf of Mexico", "Indian Ocean", "Southern Ocean", "Silk Road",
  "Great Rift Valley", "Rift Valley", "Sri Lanka", "Easter Island", "Tierra del Fuego", "Cape Horn",
  "Cape of Good Hope", "Strait of Magellan", "Gran Chaco", "Arnhem Land", "Great Barrier Reef", "Ayers Rock",
  "Chichen Itza", "Machu Picchu", "Hadrian's Wall", "Holy Land", "Promised Land", "Iberian Peninsula",
  "Arabian Peninsula", "Indian subcontinent", "Horn of Africa", "Gold Coast", "Ivory Coast", "Slave Coast",
  "Spice Islands", "West Indies", "East Indies", "Guatemala Highlands", "Shah Jahan", "Mansa Musa",
  "republic of", "confederacy", "commonwealth of",
];
const MULTI_PT = [
  "América do Norte", "América do Sul", "América Central", "América Latina", "Novo Mundo", "Velho Mundo",
  "Oriente Médio", "Oriente Próximo", "Extremo Oriente", "Ásia Menor", "Crescente Fértil", "Rio Amarelo",
  "Rio Jordão", "Mar do Norte", "Mar Negro", "Mar Vermelho", "Mar Morto", "Mar Arábico", "Golfo Pérsico",
  "Golfo do México", "Oceano Índico", "Rota da Seda", "Vale do Rift", "Ilha de Páscoa", "Terra do Fogo",
  "Cabo Horn", "Cabo da Boa Esperança", "Estreito de Magalhães", "Grande Chaco", "País de Gales",
  "Chichén Itzá", "Machu Picchu", "Muralha de Adriano", "Terra Santa", "Terra Prometida", "Península Ibérica",
  "Península Arábica", "subcontinente indiano", "Chifre da África", "Costa do Ouro", "Ilhas das Especiarias",
  "Índias Ocidentais", "Índias Orientais", "Carlos Magno", "Mansa Musa", "Lao-Tsé",
];

/** Feminine and plural forms of a Portuguese nationality. */
export function ptForms(word) {
  const w = word.toLowerCase();
  const swap = (from, ...to) => [w, ...to.map((end) => w.slice(0, -from.length) + end)];
  if (/ês$/.test(w)) return swap("ês", "esa", "eses", "esas");
  if (/ão$/.test(w)) return swap("ão", "ã", "ães", "ãos", "ãs", "ona", "oa", "oas");
  if (/eu$/.test(w)) return swap("eu", "eia", "eus", "eias");
  if (/ol$/.test(w)) return swap("ol", "ola", "óis", "olas");
  if (/z$/.test(w)) return swap("z", "za", "zes", "zas");
  if (/o$/.test(w)) return swap("o", "a", "os", "as");
  if (/[ae]$/.test(w)) return [w, `${w}s`];
  if (/[iu]$/.test(w)) return [w, `${w}s`];
  if (/l$/.test(w)) return [w, w.slice(0, -1) + "is"];
  return [w, `${w}es`];
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const L = "\\p{L}\\p{M}\\p{N}";
const bounded = (alternatives, flags) =>
  new RegExp(`(?<![${L}])(?:${alternatives.map(escape).join("|")})(?![${L}])`, `gu${flags}`);

/** City names from lib/data/cities.json that are also everyday words. */
const CITY_STOPWORDS = new Set([
  "Male", "Nice", "Mobile", "Reading", "Bath", "Split", "Victoria", "Of", "Valencia", "Santiago", "Kingston",
  "Georgetown", "Hamilton", "Columbus", "Lincoln", "Wellington", "Washington", "Jackson", "Nelson", "Charlotte",
  "Florence", "Phoenix", "Memphis", "Alexandria", "Troy", "Paris", "Vitória", "Natal", "Belém", "Salvador",
  "Recife", "Santos", "Fortaleza", "Lagos", "Porto", "Concepción", "San José", "Granada", "Córdoba", "Toledo",
]);

let cache = null;

/** Every matcher, built once: [{ kind, term, re }], longest terms first. */
function matchers() {
  if (cache) return cache;
  const countries = json("lib/data/countries.json");
  const cities = json("lib/data/cities.json");

  const caseSensitive = new Map(); // term → kind; matched as written
  const anyCase = new Map(); // lower-case term → kind

  const add = (map, list, kind) => {
    for (const term of list) if (term && !map.has(term)) map.set(term, kind);
  };

  add(caseSensitive, countries.flatMap((c) => [c.name.en, c.name.pt]), "country");
  add(caseSensitive, ["USA", "U.S.", "UK", "Britain", "Great Britain", "Soviet Union", "USSR", "Holland",
    "Czechoslovakia", "Yugoslavia", "Zaire", "Rhodesia", "Persia", "Siam", "Ceylon", "Burma", "Prussia",
    "Bohemia", "Estados Unidos da América", "EUA", "Grã-Bretanha", "União Soviética", "URSS", "Checoslováquia",
    "Tchecoslováquia", "Iugoslávia", "Zaire", "Rodésia", "Pérsia", "Sião", "Ceilão", "Birmânia", "Prússia",
    "Inglaterra", "Escócia", "Irlanda do Norte", "Kingdom of", "Reino de", "Império", "Holy Roman", "Sacro Império",
    "Brandenburg", "Brandemburgo", "Saxony", "Hanover", "Hanôver"], "country");
  add(caseSensitive, terms(DEMONYMS_EN, MULTI_EN), "nationality");
  add(caseSensitive, terms(PEOPLES_EN, MULTI_EN), "people");
  add(caseSensitive, terms(REGIONS_EN, MULTI_EN), "place");
  add(caseSensitive, terms(REGIONS_PT, MULTI_PT), "place");
  add(caseSensitive, terms(FIGURES_EN, MULTI_EN), "figure");
  add(caseSensitive, terms(FIGURES_PT, MULTI_PT), "figure");
  add(
    caseSensitive,
    cities
      .filter((city) => city.capital || city.pop >= 1_500_000)
      .flatMap((city) => [city.name.en, city.name.pt])
      .filter((name) => !CITY_STOPWORDS.has(name)),
    "city",
  );

  add(anyCase, terms(POLITY_EN, MULTI_EN).map((t) => t.toLowerCase()), "polity");
  add(anyCase, terms(POLITY_PT, MULTI_PT).map((t) => t.toLowerCase()), "polity");
  add(anyCase, words(TITLES), "figure");
  // Portuguese nationalities are written in lower case; at a sentence start they are capitalised.
  for (const word of [...words(DEMONYMS_PT), ...words(PEOPLES_PT)]) {
    const kind = PEOPLES_PT.includes(word) ? "people" : "nationality";
    add(anyCase, ptForms(word), kind);
  }
  // English nationalities and peoples, plural too.
  for (const [term, kind] of [...caseSensitive]) {
    if ((kind === "nationality" || kind === "people") && !/s$/.test(term)) caseSensitive.set(`${term}s`, kind);
  }

  const groups = new Map();
  const push = (term, kind, flags) => {
    const key = `${kind}:${flags}`;
    if (!groups.has(key)) groups.set(key, { kind, flags, terms: [] });
    groups.get(key).terms.push(term);
  };
  for (const [term, kind] of caseSensitive) push(term, kind, "");
  for (const [term, kind] of anyCase) push(term, kind, "i");
  cache = [...groups.values()].map(({ kind, flags, terms: list }) => ({
    kind,
    re: bounded(
      list.sort((a, b) => b.length - a.length),
      flags,
    ),
  }));
  return cache;
}

/** Words in `text` that name or point at a place: [{ term, kind, index }]. */
export function findGiveaways(text) {
  if (!text) return [];
  const hits = [];
  for (const { kind, re } of matchers()) {
    re.lastIndex = 0;
    for (const m of text.normalize("NFC").matchAll(re)) hits.push({ term: m[0], kind, index: m.index });
  }
  // Keep the longest match where two overlap ("South African" over "African").
  hits.sort((a, b) => a.index - b.index || b.term.length - a.term.length);
  const kept = [];
  for (const hit of hits) {
    const last = kept.at(-1);
    if (last && hit.index < last.index + last.term.length) continue;
    kept.push(hit);
  }
  return kept;
}

// ── Stripping nationalities from descriptions ──────────────────────────────

const STRIP_KINDS = new Set(["nationality", "people", "country"]);

/**
 * A description without its nationality: "German-born theoretical physicist" →
 * "Theoretical physicist", "filósofo holandês de origem judaico-portuguesa" →
 * "filósofo". What's left may still name a place (`findGiveaways` tells);
 * callers fall back to something plainer then.
 */
export function stripNationality(text, lang = "en") {
  if (!text) return text;
  let out = text.normalize("NFC");
  const capital = /^\p{Lu}/u.test(out);

  // Whole phrases first: "of Portuguese-Jewish origin", "de origem judaica", "de língua alemã",
  // "naturalizada francesa", "in the service of Spain", "known as …".
  out = out
    .replace(/\s+of\s+[\p{L}\s-]+?\s+(origin|descent|ancestry)\b/giu, "")
    .replace(/\s+(de|com)\s+(origem|ascendência|ascendencia)\s+[\p{L}-]+(\s+e\s+[\p{L}-]+)?/giu, "")
    .replace(/\s+de\s+língua\s+[\p{L}-]+/giu, "")
    .replace(/\s+naturalizad[oa]s?\s+[\p{L}-]+/giu, "")
    .replace(/\s+in the service of\s+[\p{L}\s]+?(?=[,;]|$)/giu, "")
    .replace(/\s+a serviço d[aeo]s?\s+[\p{L}\s]+?(?=[,;]|$)/giu, "");

  // Then every nationality, people or country word, with its hyphenated partners and "-born".
  const PREFIX = new RegExp(
    "(?<![\\p{L}])(?:anglo|franco|ítalo|italo|luso|sino|nipo|teuto|austro|hispano|greco|afro|indo|euro|américo|germano|eslavo)[-–]$",
    "iu",
  );
  for (let pass = 0; pass < 4; pass++) {
    const hits = findGiveaways(out).filter((hit) => STRIP_KINDS.has(hit.kind));
    if (!hits.length) break;
    // A country is part of a phrase ("King of Macedonia", "nascida na Alemanha"): cutting it
    // leaves nonsense, so give up and let the caller use something plainer.
    if (hits.some((hit) => hit.kind === "country" && !/^[-–](born|nascid)/iu.test(out.slice(hit.index + hit.term.length)))) {
      return "";
    }
    // Last first, so earlier indexes stay right; a hit overlapping a cut waits for the next pass.
    let cut = Infinity;
    for (const hit of hits.reverse()) {
      let start = hit.index;
      let end = hit.index + hit.term.length;
      if (end > cut) continue;
      // Partners joined by a hyphen or dash ("Polish-French", "sérvio-americano"): the dash goes
      // with this word, the partner with its own hit; a bare prefix ("sino-", "luso-") goes too.
      const before = out.slice(0, start);
      const prefix = PREFIX.exec(before);
      if (prefix) start -= prefix[0].length;
      else if (/[-–]$/.test(before)) start -= 1;
      const tail = /^(?:[-–](?:born|based|speaking|language|nascid[oa]s?))+/iu.exec(out.slice(end));
      if (tail) end += tail[0].length;
      out = out.slice(0, start) + out.slice(end);
      cut = start;
    }
  }

  out = out
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([,;.])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;–-]+|[\s,;–-]+$/g, "")
    .replace(/^(and|e)\s+/i, "")
    .replace(/\s+(and|e)$/i, "")
    .replace(/\s+(of|from|in|de|do|da|dos|das|em|no|na)(\s+(the|a|an|o|os|as))?$/i, "")
    .trim();
  // Words left hanging where a name was cut out ("Rei da e", "King of, …").
  if (!out || /(?<![\p{L}])(of|from|in|at|da|do|dos|das|de|na|no|nos|nas|em)(?:\s+(the|a|o|os|as))?\s*(?:[,;.)]|\s(?:e|and)(?![\p{L}])|$)/iu.test(out)) {
    return "";
  }
  // English descriptions start with a capital; Portuguese ones as they came.
  if (capital || lang === "en") out = out[0].toLocaleUpperCase(lang) + out.slice(1);
  return out;
}
