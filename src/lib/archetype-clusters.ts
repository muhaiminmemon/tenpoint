/**
 * What a library keeps coming back to, at a grain a genre cannot reach.
 *
 * Genres are eighteen loose buckets applied by committee: they say "Thriller"
 * where a person would say "surveillance thriller shot in one room". Only one
 * of those is worth being called. TMDB's keywords carry the second kind, about
 * twenty per film, and every film in the catalogue now has them.
 *
 * A cluster is a theme somebody can be named after, spelled out as the
 * keywords that mean it. A film joins a cluster if it carries any one of them,
 * and a film can belong to several: watching a heist in space is both.
 */
export type Cluster = {
  key: string;
  /** the name a person gets called */
  name: string;
  /**
   * What the theme counts, in plain words.
   *
   * Written to slot into "your films are about ___", and written flat on
   * purpose: an evocative name earns a second glance, but a person reading
   * the binder is asking what the name *means*, and answering that with
   * another riddle is how the old archetype quotes failed.
   */
  note: string;
  keywords: string[];
};

/**
 * Keywords that describe the production rather than the film.
 *
 * TMDB mixes three things into one list: themes, production facts, and a newer
 * set of mood tags. "sequel" and "duringcreditsstinger" say nothing about
 * taste, and the mood tags ("bold", "hopeful", "amused") are applied loosely
 * enough that they would name people after noise. Both are dropped before
 * anything is counted.
 */
export const KEYWORD_STOPLIST = new Set([
  // production and release facts
  "sequel", "prequel", "reboot", "remake", "spin off", "live action remake",
  "duringcreditsstinger", "aftercreditsstinger", "based on novel or book",
  "based on comic", "based on true story", "based on young adult novel",
  "based on children's book", "based on tv series", "based on video game",
  "based on toy", "3d animation", "live action and animation", "woman director",
  "cartoon", "anime", "marvel cinematic universe (mcu)", "dc extended universe (dceu)",
  "cliché", "breaking the fourth wall",
  // mood tags: sentiment, not subject
  "amused", "excited", "bold", "suspenseful", "enthusiastic", "intense", "admiring",
  "inspirational", "hilarious", "hopeful", "cheerful", "joyful", "adoring", "playful",
  "nostalgic", "exhilarated", "awestruck", "vibrant", "complex", "dramatic",
  "aggressive", "tragic", "ambiguous", "whimsical", "comforting", "powerful", "witty",
  "joyous", "frightened", "antagonistic", "appreciative", "compassionate", "depressing",
  "angry", "casual", "reflective", "grim", "thoughtful", "loving", "lighthearted",
  "dreary", "tense", "melancholy", "critical", "shocking", "empathetic", "somber",
  "sentimental", "audacious", "sympathetic", "intimate", "optimistic", "celebratory",
  "bewildered", "defiant", "brisk", "assertive", "mischievous", "cautionary", "anxious",
  "romantic", "philosophical", "surreal", "violence", "fear", "tuwaderalit",
]);

/**
 * The clusters, most specific first.
 *
 * Order matters only for reading; selection is by how far past ordinary a
 * library sits on each, never by position.
 */
export const CLUSTERS: Cluster[] = [
  {
    key: "heist",
    name: "Fence",
    note: "heists, robberies and con jobs",
    keywords: ["heist", "robbery", "bank robbery", "con artist", "thief", "burglary", "safe", "casino", "money", "smuggling", "con man"],
  },
  {
    key: "loop",
    name: "Repeat Offender",
    note: "time travel and time loops",
    keywords: ["time travel", "time loop", "alternate timeline", "alternate reality", "multiverse", "paradox", "parallel world", "time machine", "future"],
  },
  {
    key: "slasher",
    name: "Final Girl",
    note: "slashers, serial killers and survival horror",
    keywords: ["slasher", "serial killer", "survival horror", "home invasion", "masked killer", "halloween", "gore", "psychopath", "stalker", "torture", "brutality"],
  },
  {
    key: "occult",
    name: "Adept",
    note: "witches, cults and possession",
    keywords: ["witch", "cult", "occult", "ritual", "possession", "demon", "exorcism", "curse", "supernatural horror", "school of witchcraft", "folk horror", "paganism"],
  },
  {
    key: "body",
    name: "Specimen",
    note: "body horror and transformation",
    keywords: ["body horror", "transformation", "mutant", "virus", "infection", "experiment", "mutation", "parasite", "disease"],
  },
  {
    key: "void",
    name: "Voidgazer",
    note: "space travel and life aboard ships",
    keywords: ["space", "space travel", "spacecraft", "space opera", "astronaut", "alien planet", "moon", "black hole", "space station", "space marine", "isolation", "transhumanism"],
  },
  {
    key: "machine",
    name: "Operator",
    note: "artificial intelligence, robots and cyberpunk",
    keywords: ["artificial intelligence (a.i.)", "robot", "android", "cyberpunk", "man vs machine", "inventor", "scientist", "cyborg", "simulation", "hacker", "computer"],
  },
  {
    key: "dissident",
    name: "Agitator",
    note: "dystopias, surveillance and rebellion",
    keywords: ["dystopia", "rebellion", "totalitarianism", "corruption", "terrorism", "conspiracy", "surveillance", "propaganda", "resistance", "revolution", "insurgence", "oppression"],
  },
  {
    key: "apocalypse",
    name: "Holdout",
    note: "the end of the world and surviving it",
    keywords: ["post-apocalyptic future", "end of the world", "survival", "zombie", "wasteland", "disaster", "disaster movie", "apocalypse", "outbreak", "nuclear", "famine"],
  },
  {
    key: "revenge",
    name: "Cleaner",
    note: "revenge, vigilantes and hired killers",
    keywords: ["revenge", "vigilante", "vendetta", "betrayal", "retribution", "bounty hunter", "hitman", "assassin", "contract killer", "justice"],
  },
  {
    key: "comingofage",
    name: "Greenhorn",
    note: "growing up, school and first love",
    keywords: ["coming of age", "high school", "teenager", "school", "first love", "bullying", "teenage girl", "growing up", "adolescence", "graduation", "summer camp", "teacher"],
  },
  {
    key: "grief",
    name: "Mourner",
    note: "loss, grief and mental illness",
    keywords: ["loss of loved one", "dying and death", "grief", "loneliness", "mental illness", "alcoholism", "addiction", "depression", "suicide", "mourning", "terminal illness", "alcoholic"],
  },
  /**
   * What used to be one cluster called The Sleuth.
   *
   * It was the greediest net in the file and it named eleven of sixty-five
   * accounts, because "detectives, police work and missing people" is four
   * different tastes wearing one word: the person who watches procedurals and
   * the person who watches locked-room mysteries have almost nothing in common
   * and were being handed the same name. Split, they get four.
   *
   * The generic "investigation" keyword is gone rather than reassigned. Of the
   * thirty-seven titles carrying it, thirty-two already carry a specific tag,
   * and the five it alone caught were Attack of the Clones, Source Code,
   * Ghost in the Shell, 21 Jump Street and a cartoon about sheep. It describes
   * a story shape, not a subject, which is the same reason "based on manga"
   * came out of the shounen list.
   */
  {
    key: "procedural",
    name: "Badge",
    note: "police work, federal agents and interrogations",
    keywords: ["police", "fbi", "central intelligence agency (cia)", "interrogation", "police detective", "police officer", "forensic", "crime scene", "autopsy", "police procedural"],
  },
  {
    key: "gumshoe",
    name: "Gumshoe",
    note: "detectives working cases of their own",
    keywords: ["detective", "private detective", "private investigator", "hardboiled", "amateur detective"],
  },
  {
    key: "whodunit",
    name: "Puzzler",
    note: "murder mysteries and puzzles with a solution",
    keywords: ["whodunit", "mystery", "clue", "cold case", "locked room mystery", "murder mystery", "riddle"],
  },
  {
    key: "missing",
    name: "Searcher",
    note: "disappearances, manhunts and people who are gone",
    keywords: ["missing person", "disappearance", "manhunt", "kidnapping", "hostage", "search party", "abducted child"],
  },
  {
    key: "identity",
    name: "Sleepwalker",
    note: "amnesia, dreams and psychological unease",
    keywords: ["amnesia", "identity", "doppelganger", "dreams", "surrealism", "magic realism", "psychological thriller", "psychological horror", "psychological drama", "hallucination", "memory", "mind"],
  },
  {
    key: "court",
    name: "Advocate",
    note: "courtrooms, trials and lawyers",
    keywords: ["courtroom", "trial", "lawyer", "wrongful conviction", "testimony", "court", "legal drama", "jury", "district attorney"],
  },
  {
    key: "blade",
    name: "Duelist",
    note: "martial arts, samurai and swordplay",
    keywords: ["martial arts", "kung fu", "samurai", "sword", "hand to hand combat", "training", "fight", "dojo", "wuxia", "ninja", "swordplay", "duel"],
  },
  {
    key: "spy",
    name: "Sleeper",
    note: "spies, espionage and undercover work",
    keywords: ["spy", "secret agent", "espionage", "undercover", "fictional government agency", "double agent", "defector", "cold war", "secret identity"],
  },
  {
    key: "prison",
    name: "Lifer",
    note: "prison, escape and captivity",
    keywords: ["prison", "escape", "imprisonment", "prisoner", "jail", "prison escape", "hostage", "kidnapping", "captivity"],
  },
  {
    key: "town",
    name: "Townie",
    note: "small towns and rural life",
    keywords: ["small town", "rural", "farm", "village", "community", "suburb", "countryside", "neighbours"],
  },
  {
    key: "road",
    name: "Drifter",
    note: "road trips, journeys and being on the run",
    keywords: ["road trip", "journey", "travel", "on the run", "adventurer", "desert", "hitchhiking", "quest", "expedition", "wilderness"],
  },
  {
    key: "sport",
    name: "Journeyman",
    note: "sport, competition and training",
    keywords: ["sports", "boxing", "racing", "car race", "competition", "rivalry", "teamwork", "olympics", "football", "baseball", "coach", "championship"],
  },
  {
    key: "stage",
    name: "Understudy",
    note: "music, dance and the cost of being good at it",
    keywords: ["musical", "music", "singer", "band", "concert", "dance", "stage", "orchestra", "songwriter", "opera", "performance", "jazz", "musician", "drums", "guitar", "rock band", "ballet", "choreography", "rehearsal", "conservatory", "obsession", "perfectionist"],
  },
  {
    key: "deadpan",
    name: "Cynic",
    note: "dark comedy, parody and absurd humour",
    keywords: ["dark comedy", "absurd", "parody", "slapstick comedy", "buddy comedy", "farce", "black comedy", "spoof", "irony"],
  },
  {
    key: "satire",
    name: "Provocateur",
    note: "satire, class and social commentary",
    keywords: ["satire", "social commentary", "class conflict", "racism", "politics", "allegory", "capitalism", "inequality", "media", "society"],
  },
  {
    key: "noir",
    name: "Nightcrawler",
    note: "noir, gangsters and organised crime",
    keywords: ["neo-noir", "film noir", "gangster", "organized crime", "mafia", "crime boss", "drugs", "drug dealer", "shootout", "underworld", "femme fatale", "double cross"],
  },
  {
    key: "period",
    name: "Antiquarian",
    note: "period drama, royalty and old money",
    keywords: ["period drama", "historical fiction", "19th century", "castle", "kingdom", "royalty", "princess", "prince", "aristocracy", "18th century", "victorian", "monarchy"],
  },
  {
    key: "truestory",
    name: "Witness",
    note: "biographies and true stories",
    keywords: ["biography", "historical figure", "real events", "docudrama", "true crime", "memoir", "journalism", "scandal"],
  },
  {
    key: "war",
    name: "Veteran",
    note: "war, soldiers and the military",
    keywords: ["war", "world war ii", "military", "army", "soldier", "battle", "nazi", "combat", "veteran", "world war i", "vietnam war", "trenches"],
  },
  {
    key: "myth",
    name: "Warlock",
    note: "magic, wizards, dragons and prophecy",
    keywords: ["magic", "wizard", "dragon", "elves", "dwarf", "fairy tale", "prophecy", "chosen one", "sword and sorcery", "dark fantasy", "mythology", "spell", "sorcerer"],
  },
  {
    key: "hearth",
    name: "Bloodline",
    note: "families, parents and children",
    keywords: ["family relationships", "parent child relationship", "father son relationship", "mother son relationship", "sibling relationship", "dysfunctional family", "single mother", "father daughter relationship", "adoption", "divorce", "inheritance", "orphan"],
  },
  {
    key: "romance",
    name: "Suitor",
    note: "romance, marriage and heartbreak",
    keywords: ["romance", "love", "romcom", "love of one's life", "wedding", "marriage", "infidelity", "love triangle", "long distance relationship", "heartbreak", "courtship"],
  },
  {
    key: "ink",
    name: "Celluloid",
    note: "animation, talking animals and toys",
    keywords: ["anthropomorphism", "talking animal", "animals", "dog", "wolf", "lion", "toy", "puppet", "stop motion", "hand drawn"],
  },
  {
    key: "caped",
    name: "Vigilante",
    note: "superheroes and super powers",
    keywords: ["superhero", "super power", "supervillain", "superhero team", "teen superhero", "super villain", "superhuman", "mutant", "secret lair", "alter ego"],
  },
  {
    key: "creature",
    name: "Handler",
    note: "monsters, dinosaurs and giant creatures",
    keywords: ["dinosaur", "giant monster", "kaiju", "tyrannosaurus rex", "monster", "creature", "shark", "sea monster", "beast", "godzilla"],
  },
  {
    key: "ghost",
    name: "Haunted",
    note: "ghosts, haunted houses and the supernatural",
    keywords: ["ghost", "haunted house", "spirit", "supernatural", "afterlife", "seance", "poltergeist", "haunting", "skeleton"],
  },
  {
    key: "undead",
    name: "Nightfeeder",
    note: "vampires, werewolves and the undead",
    keywords: ["vampire", "werewolf", "undead", "blood", "immortality", "zombie apocalypse", "mummy"],
  },
  {
    key: "sea",
    name: "Smuggler",
    note: "pirates, ships and the sea",
    keywords: ["pirate", "ship", "sea", "island", "exotic island", "ocean", "sailing", "submarine", "shipwreck", "navy"],
  },
  {
    key: "flight",
    name: "Aviator",
    note: "planes, pilots and flying",
    keywords: ["airplane", "flying", "pilot", "aviation", "air force", "helicopter", "skydiving"],
  },
  {
    key: "speed",
    name: "Wheelman",
    note: "cars, chases and racing",
    keywords: ["cars", "car chase", "motorcycle", "street racing", "getaway", "chase", "car crash", "driver"],
  },
  {
    key: "outsider",
    name: "Stray",
    note: "immigrants, outsiders and prejudice",
    keywords: ["lgbt", "gay theme", "immigrant", "discrimination", "coming out", "outcast", "minority", "refugee", "exile", "prejudice"],
  },
  {
    key: "faith",
    name: "Penitent",
    note: "religion, faith and redemption",
    keywords: ["religion", "faith", "priest", "church", "god", "monastery", "pilgrimage", "miracle", "sin", "redemption"],
  },
  {
    key: "alien",
    name: "Signalman",
    note: "aliens, invasions and first contact",
    keywords: ["alien", "alien invasion", "extraterrestrial", "ufo", "first contact", "abduction", "invasion"],
  },
  /**
   * The three below are television's own, and exist because it did not have any.
   *
   * Every cluster above was measured off a film catalogue, so a heavy watcher of
   * series came out holding a noun drawn from cinema: The Office and The Simpsons
   * and Attack on Titan matched nothing at all, and their viewers fell through to
   * whatever their handful of films happened to say. The commonest keywords across
   * the season catalogue are sitcom, adult animation and shounen, and none of them
   * appear anywhere above.
   */
  {
    key: "sitcom",
    name: "Roommate",
    note: "sitcoms, workplace comedy and ensemble casts",
    keywords: [
      "sitcom", "workplace comedy", "situation comedy", "office", "employer employee relationship",
      "mockumentary", "roommate", "ensemble cast", "boss", "work",
    ],
  },
  {
    key: "shounen",
    name: "Contender",
    note: "shounen, manga adaptations and power escalation",
    // "based on manga" is deliberately absent. It was in this list and it
    // caught every manga adaptation there is, so a library of Monster, Cowboy
    // Bebop and Frieren came back as shounen: the adaptation source says
    // nothing about whether the thing is a battle series.
    keywords: [
      "shounen", "super power", "tournament", "rival",
      "power up", "quirk", "titan", "martial arts tournament",
    ],
  },
  {
    key: "adultanimation",
    name: "Degenerate",
    note: "adult animation and animated satire",
    keywords: [
      "adult animation", "adult humor", "cartoon", "animated sitcom", "social satire",
    ],
  },
  {
    key: "winterholiday",
    name: "December Regular",
    note: "Christmas and holiday films",
    keywords: ["christmas", "holiday", "santa claus", "new year", "thanksgiving", "snow", "winter"],
  },
];

/**
 * How much of the catalogue falls into each cluster.
 *
 * Measured across the catalogue and frozen rather than recomputed: a title
 * should move when somebody's taste moves, not when the catalogue grows.
 * Nothing here passes 19%, where the leading genre tag reached 41%, which is
 * the whole reason the noun moved off genre.
 *
 * The basis is one row per rateable unit, which is films and seasons: a season
 * is what somebody rates, so a twelve-season series contributes twelve to this
 * denominator exactly as it can contribute twelve to a library. Whole-show rows
 * are excluded because counting them too would count every series twice.
 *
 * These were re-measured on that basis when television arrived. The earlier
 * numbers were taken across films alone, and leaving them while adding three
 * television clusters measured another way would have put two denominators in
 * one table, which reliably ends with two parts of this codebase disagreeing
 * about the same quantity.
 */
export const CLUSTER_PREVALENCE: Record<string, number> = {
  hearth: 0.189, caped: 0.146, deadpan: 0.135, comingofage: 0.123,
  dissident: 0.122, sitcom: 0.116, satire: 0.103, procedural: 0.067,
  grief: 0.101, myth: 0.101, blade: 0.095, noir: 0.095, shounen: 0.092,
  road: 0.093, machine: 0.091, revenge: 0.087, void: 0.086, period: 0.085,
  slasher: 0.083, adultanimation: 0.08, ghost: 0.077, identity: 0.073,
  apocalypse: 0.072, ink: 0.07, alien: 0.07, creature: 0.069, war: 0.067,
  romance: 0.066, sea: 0.061, occult: 0.06, spy: 0.059, loop: 0.057,
  stage: 0.054, prison: 0.05, body: 0.045, sport: 0.042, heist: 0.039,
  missing: 0.034, whodunit: 0.028, gumshoe: 0.022,
  undead: 0.035, winterholiday: 0.035, truestory: 0.03, faith: 0.027,
  town: 0.026, flight: 0.025, outsider: 0.024, speed: 0.02, court: 0.015,
};

/**
 * Which card stock a theme is printed on.
 *
 * The finish used to be picked from the leading genre, which handed 77% of
 * libraries the same Filmstrip and made Marble literally unreachable. Themes
 * are spread far more evenly, so the same five stocks distribute properly the
 * moment they are chosen this way instead.
 *
 * Grouped so each stock covers a comparable slice of the catalogue, not a
 * comparable number of themes: ten rare themes add up to less than six common
 * ones, and balancing by count is how the problem creeps back in.
 */
/**
 * Which finish a theme reads to.
 *
 * Measured, not assigned by feel. Across 83 libraries the previous partition
 * gave Neon Rain 43% and Nebula 27%, so seven shelves in ten came out as one
 * of two finishes, which is the same failure the genre mapping had before it
 * when 77% of libraries came out Filmstrip. A finish most people hold is not
 * telling anybody anything.
 *
 * Four clusters were each winning outright while filed under a coat that did
 * not fit: `occult` at 11% and `identity` at 13% were both inside Neon Rain
 * alongside police procedurals, and `myth` at 10% and `ink` at 8% were inside
 * Nebula alongside deep space. Each now has its own stock, and the largest
 * finish falls from 43% to 18%.
 */
export const STOCK_BY_CLUSTER: Record<string, string> = {
  // motion, bodies, momentum
  heist: "Filmstrip", revenge: "Filmstrip", blade: "Filmstrip", speed: "Filmstrip",
  sport: "Filmstrip", war: "Filmstrip", caped: "Filmstrip", road: "Filmstrip",
  sea: "Filmstrip", flight: "Filmstrip",
  // the case, and whoever is working it
  noir: "Neon Rain", procedural: "Neon Rain", spy: "Neon Rain", prison: "Neon Rain",
  gumshoe: "Neon Rain", whodunit: "Neon Rain", missing: "Neon Rain",
  dissident: "Neon Rain",
  // what should not be there
  occult: "Oxblood", slasher: "Oxblood", body: "Oxblood", ghost: "Oxblood",
  undead: "Oxblood", creature: "Oxblood",
  // a mind that will not hold still
  identity: "Bromide",
  // people, rooms, paper
  hearth: "Vellum", romance: "Vellum", comingofage: "Vellum", grief: "Vellum",
  town: "Vellum", outsider: "Vellum", faith: "Vellum", stage: "Vellum",
  sitcom: "Vellum",
  // what could not happen, by physics
  void: "Nebula", machine: "Nebula", loop: "Nebula", alien: "Nebula",
  apocalypse: "Nebula",
  // what could not happen, by magic
  myth: "Gilt",
  // drawn rather than filmed
  ink: "Cel", shounen: "Cel", adultanimation: "Cel",
  // the record, and remarks upon it
  period: "Marble", satire: "Marble", truestory: "Marble", court: "Marble",
  deadpan: "Marble", winterholiday: "Marble",
};

/** Every keyword any cluster cares about, for the query that counts them. */
export const CLUSTER_KEYWORDS: string[] = [
  ...new Set(CLUSTERS.flatMap((c) => c.keywords)),
];
