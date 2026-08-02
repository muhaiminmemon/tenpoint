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
  /** the theme in a reader's own words, for the line that proves it */
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
    name: "The Inside Man",
    note: "crews, scores and the one last job",
    keywords: ["heist", "robbery", "bank robbery", "con artist", "thief", "burglary", "safe", "casino", "money", "smuggling", "con man"],
  },
  {
    key: "loop",
    name: "The Loopwalker",
    note: "time folding back on itself",
    keywords: ["time travel", "time loop", "alternate timeline", "alternate reality", "multiverse", "paradox", "parallel world", "time machine", "future"],
  },
  {
    key: "slasher",
    name: "The Final Girl",
    note: "someone in the house, and one of you left",
    keywords: ["slasher", "serial killer", "survival horror", "home invasion", "masked killer", "halloween", "gore", "psychopath", "stalker", "torture", "brutality"],
  },
  {
    key: "occult",
    name: "The Harvest Watcher",
    note: "old rites, rural dread and things kept in the ground",
    keywords: ["witch", "cult", "occult", "ritual", "possession", "demon", "exorcism", "curse", "supernatural horror", "school of witchcraft", "folk horror", "paganism"],
  },
  {
    key: "body",
    name: "The Body Snatcher",
    note: "flesh that will not stay put",
    keywords: ["body horror", "transformation", "mutant", "virus", "infection", "experiment", "mutation", "parasite", "disease"],
  },
  {
    key: "void",
    name: "The Voidgazer",
    note: "the long quiet of deep space",
    keywords: ["space", "space travel", "spacecraft", "space opera", "astronaut", "alien planet", "moon", "black hole", "space station", "space marine", "isolation", "transhumanism"],
  },
  {
    key: "machine",
    name: "The Machine Whisperer",
    note: "minds we built, and what they made of us",
    keywords: ["artificial intelligence (a.i.)", "robot", "android", "cyberpunk", "man vs machine", "inventor", "scientist", "cyborg", "simulation", "hacker", "computer"],
  },
  {
    key: "dissident",
    name: "The Dissident",
    note: "boots, cameras and the people who say no",
    keywords: ["dystopia", "rebellion", "totalitarianism", "corruption", "terrorism", "conspiracy", "surveillance", "propaganda", "resistance", "revolution", "insurgence", "oppression"],
  },
  {
    key: "apocalypse",
    name: "The Last Light",
    note: "after it all went wrong",
    keywords: ["post-apocalyptic future", "end of the world", "survival", "zombie", "wasteland", "disaster", "disaster movie", "apocalypse", "outbreak", "nuclear", "famine"],
  },
  {
    key: "revenge",
    name: "The Reckoner",
    note: "a debt somebody intends to collect",
    keywords: ["revenge", "vigilante", "vendetta", "betrayal", "retribution", "bounty hunter", "hitman", "assassin", "contract killer", "justice"],
  },
  {
    key: "comingofage",
    name: "The Late Bloomer",
    note: "the year everything changed",
    keywords: ["coming of age", "high school", "teenager", "school", "first love", "bullying", "teenage girl", "growing up", "adolescence", "graduation", "summer camp", "teacher"],
  },
  {
    key: "grief",
    name: "The Elegist",
    note: "what people carry after a loss",
    keywords: ["loss of loved one", "dying and death", "grief", "loneliness", "mental illness", "alcoholism", "addiction", "depression", "suicide", "mourning", "terminal illness", "alcoholic"],
  },
  {
    key: "investigation",
    name: "The Watcher",
    note: "someone following a thread they should not pull",
    keywords: ["investigation", "whodunit", "detective", "fbi", "central intelligence agency (cia)", "missing person", "police", "private detective", "cold case", "mystery", "clue", "interrogation"],
  },
  {
    key: "identity",
    name: "The Unnamed",
    note: "people who are not sure who they are",
    keywords: ["amnesia", "identity", "doppelganger", "dreams", "surrealism", "magic realism", "psychological thriller", "psychological horror", "psychological drama", "hallucination", "memory", "mind"],
  },
  {
    key: "court",
    name: "The Cross-Examiner",
    note: "arguments made in front of a judge",
    keywords: ["courtroom", "trial", "lawyer", "wrongful conviction", "testimony", "court", "legal drama", "jury", "district attorney"],
  },
  {
    key: "blade",
    name: "The Blade Scholar",
    note: "discipline, a teacher, and a duel at the end",
    keywords: ["martial arts", "kung fu", "samurai", "sword", "hand to hand combat", "training", "fight", "dojo", "wuxia", "ninja", "swordplay", "duel"],
  },
  {
    key: "spy",
    name: "The Handler",
    note: "tradecraft and people who are not who they say",
    keywords: ["spy", "secret agent", "espionage", "undercover", "fictional government agency", "double agent", "defector", "cold war", "secret identity"],
  },
  {
    key: "prison",
    name: "The Lifer",
    note: "walls, sentences and the way out",
    keywords: ["prison", "escape", "imprisonment", "prisoner", "jail", "prison escape", "hostage", "kidnapping", "captivity"],
  },
  {
    key: "town",
    name: "The Townie",
    note: "small places where everybody knows",
    keywords: ["small town", "rural", "farm", "village", "community", "suburb", "countryside", "neighbours"],
  },
  {
    key: "road",
    name: "The Waypoint",
    note: "people who are better off moving",
    keywords: ["road trip", "journey", "travel", "on the run", "adventurer", "desert", "hitchhiking", "quest", "expedition", "wilderness"],
  },
  {
    key: "sport",
    name: "The Underdog",
    note: "training montages and a final round",
    keywords: ["sports", "boxing", "racing", "car race", "competition", "rivalry", "teamwork", "olympics", "football", "baseball", "coach", "championship"],
  },
  {
    key: "stage",
    name: "The Showstopper",
    note: "the number where the room stops",
    keywords: ["musical", "music", "singer", "band", "concert", "dance", "stage", "orchestra", "songwriter", "opera", "performance"],
  },
  {
    key: "deadpan",
    name: "The Deadpan",
    note: "jokes delivered with a straight face",
    keywords: ["dark comedy", "absurd", "parody", "slapstick comedy", "buddy comedy", "farce", "black comedy", "spoof", "irony"],
  },
  {
    key: "satire",
    name: "The Satirist",
    note: "films with a point to make about the rest of us",
    keywords: ["satire", "social commentary", "class conflict", "racism", "politics", "allegory", "capitalism", "inequality", "media", "society"],
  },
  {
    key: "noir",
    name: "The Nightside",
    note: "rain, bad money and worse decisions",
    keywords: ["neo-noir", "film noir", "gangster", "organized crime", "mafia", "crime boss", "drugs", "drug dealer", "shootout", "underworld", "femme fatale", "double cross"],
  },
  {
    key: "period",
    name: "The Costumier",
    note: "old houses and the manners inside them",
    keywords: ["period drama", "historical fiction", "19th century", "castle", "kingdom", "royalty", "princess", "prince", "aristocracy", "18th century", "victorian", "monarchy"],
  },
  {
    key: "truestory",
    name: "The Case File",
    note: "things that actually happened",
    keywords: ["biography", "historical figure", "real events", "docudrama", "true crime", "memoir", "journalism", "scandal"],
  },
  {
    key: "war",
    name: "The Frontliner",
    note: "what a war does to the people sent into it",
    keywords: ["war", "world war ii", "military", "army", "soldier", "battle", "nazi", "combat", "veteran", "world war i", "vietnam war", "trenches"],
  },
  {
    key: "myth",
    name: "The Mythmaker",
    note: "prophecies, swords and the road to the mountain",
    keywords: ["magic", "wizard", "dragon", "elves", "dwarf", "fairy tale", "prophecy", "chosen one", "sword and sorcery", "dark fantasy", "mythology", "spell", "sorcerer"],
  },
  {
    key: "hearth",
    name: "The Inheritance",
    note: "the family you are stuck with",
    keywords: ["family relationships", "parent child relationship", "father son relationship", "mother son relationship", "sibling relationship", "dysfunctional family", "single mother", "father daughter relationship", "adoption", "divorce", "inheritance", "orphan"],
  },
  {
    key: "romance",
    name: "The First Love",
    note: "two people and the distance between them",
    keywords: ["romance", "love", "romcom", "love of one's life", "wedding", "marriage", "infidelity", "love triangle", "long distance relationship", "heartbreak", "courtship"],
  },
  {
    key: "ink",
    name: "The Ink Dreamer",
    note: "worlds drawn rather than filmed",
    keywords: ["anthropomorphism", "talking animal", "animals", "dog", "wolf", "lion", "toy", "puppet", "stop motion", "hand drawn"],
  },
  {
    key: "caped",
    name: "The Caped",
    note: "people with a second name and a costume",
    keywords: ["superhero", "super power", "supervillain", "superhero team", "teen superhero", "super villain", "superhuman", "mutant", "secret lair", "alter ego"],
  },
  {
    key: "creature",
    name: "The Creature Feature",
    note: "something very large coming over the hill",
    keywords: ["dinosaur", "giant monster", "kaiju", "tyrannosaurus rex", "monster", "creature", "shark", "sea monster", "beast", "godzilla"],
  },
  {
    key: "ghost",
    name: "The Threshold",
    note: "houses that will not let go",
    keywords: ["ghost", "haunted house", "spirit", "supernatural", "afterlife", "seance", "poltergeist", "haunting", "skeleton"],
  },
  {
    key: "undead",
    name: "The Nightfeeder",
    note: "the ones who do not stay dead",
    keywords: ["vampire", "werewolf", "undead", "blood", "immortality", "zombie apocalypse", "mummy"],
  },
  {
    key: "sea",
    name: "The Sea Dog",
    note: "salt water and everything on it",
    keywords: ["pirate", "ship", "sea", "island", "exotic island", "ocean", "sailing", "submarine", "shipwreck", "navy"],
  },
  {
    key: "flight",
    name: "The Aviator",
    note: "anything that leaves the ground",
    keywords: ["airplane", "flying", "pilot", "aviation", "air force", "helicopter", "skydiving"],
  },
  {
    key: "speed",
    name: "The Speed Freak",
    note: "engines, and the chase after them",
    keywords: ["cars", "car chase", "motorcycle", "street racing", "getaway", "chase", "car crash", "driver"],
  },
  {
    key: "outsider",
    name: "The Outsider",
    note: "people the room was not built for",
    keywords: ["lgbt", "gay theme", "immigrant", "discrimination", "coming out", "outcast", "minority", "refugee", "exile", "prejudice"],
  },
  {
    key: "faith",
    name: "The Pilgrim",
    note: "belief, and what it asks of people",
    keywords: ["religion", "faith", "priest", "church", "god", "monastery", "pilgrimage", "miracle", "sin", "redemption"],
  },
  {
    key: "alien",
    name: "The First Contact",
    note: "something out there noticing us",
    keywords: ["alien", "alien invasion", "extraterrestrial", "ufo", "first contact", "abduction", "invasion"],
  },
  {
    key: "winterholiday",
    name: "The December Regular",
    note: "films that only come out once a year",
    keywords: ["christmas", "holiday", "santa claus", "new year", "thanksgiving", "snow", "winter"],
  },
];

/**
 * How much of the catalogue falls into each cluster.
 *
 * Measured across every film we hold keywords for, and frozen rather than
 * recomputed: a title should move when somebody's taste moves, not when the
 * catalogue grows. Nothing here passes 17%, where the leading genre tag
 * reached 41%, which is the whole reason the noun moved off genre.
 */
export const CLUSTER_PREVALENCE: Record<string, number> = {
  caped: 0.165, hearth: 0.15, dissident: 0.133, void: 0.115, revenge: 0.109,
  myth: 0.105, machine: 0.102, grief: 0.102, noir: 0.099, road: 0.096,
  slasher: 0.091, identity: 0.091, comingofage: 0.09, investigation: 0.087,
  blade: 0.087, ink: 0.087, war: 0.085, period: 0.082, deadpan: 0.081,
  creature: 0.078, apocalypse: 0.076, romance: 0.075, occult: 0.069,
  spy: 0.067, prison: 0.066, loop: 0.063, body: 0.063, ghost: 0.063,
  alien: 0.061, sport: 0.06, satire: 0.057, stage: 0.052, sea: 0.052,
  winterholiday: 0.051, heist: 0.048, truestory: 0.042, flight: 0.036,
  outsider: 0.034, undead: 0.031, faith: 0.031, speed: 0.03, town: 0.021,
  court: 0.013,
};

/** Every keyword any cluster cares about, for the query that counts them. */
export const CLUSTER_KEYWORDS: string[] = [
  ...new Set(CLUSTERS.flatMap((c) => c.keywords)),
];
