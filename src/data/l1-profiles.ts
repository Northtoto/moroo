// L1 Native Language Profiles
// Maps a student's native language to pedagogical insights for German learning.
// Injected into every correction system prompt for L1-adapted feedback.

export interface L1Profile {
  language: string;
  flag: string;
  challenges: string[];
  leverage_points: string[];
  common_errors: string[];
  cultural_notes: string;
  system_prompt_note: string;
}

export const L1_PROFILES: Record<string, L1Profile> = {
  Arabic: {
    language: 'Arabic',
    flag: '\u{1F1F8}\u{1F1E6}',
    challenges: [
      'German grammatical cases (German has 4; Arabic has 3 that work differently)',
      'German V2 word order conflicts with Arabic VSO sentence structure',
      'German grammatical gender (3 genders vs Arabic 2)',
      'No definite/indefinite article system equivalent in Arabic',
      'German compound words (no equivalent in Arabic)',
    ],
    leverage_points: [
      'Arabic has a rich case system -- leverage this to explain German cases',
      'Both languages have emphatic/formal registers',
      'Arabic speakers are comfortable with morphological complexity',
      'German loan words from Arabic: Algebra, Alkohol, Sofa, Kaffee',
    ],
    common_errors: [
      'Using wrong article gender (der/die/das)',
      'Placing verb at sentence end in main clauses',
      'Accusative/Dative confusion',
      'Omitting articles entirely',
      'Subject-verb agreement with plural nouns',
    ],
    cultural_notes: 'Arabic is spoken across North Africa and the Middle East -- large German-learning communities for work/study migration.',
    system_prompt_note: `Student speaks Arabic (native). German cases are familiar conceptually since Arabic has cases too, but they work very differently -- use this as a bridge. German V2 word order (verb always second) directly conflicts with Arabic VSO habits. When correcting word order errors, explicitly explain the V2 rule. For gender errors, explain that German has no reliable gender pattern -- memorization with the article is essential.`,
  },

  Darija: {
    language: 'Darija (Moroccan Arabic)',
    flag: '\u{1F1F2}\u{1F1E6}',
    challenges: [
      'Same as Arabic plus code-switching habits from French/Spanish',
      "Darija lacks formal written grammar rules -- German's precision feels rigid",
      'German articles are particularly challenging (no direct equivalent)',
    ],
    leverage_points: [
      'Darija speakers often know French -- massive vocabulary overlap with German',
      'Comfortable with multilingualism and language mixing',
      'Many German words shared via French cognates: Restaurant, Hotel, Tourist',
    ],
    common_errors: [
      'Article confusion influenced by French gender (not German gender)',
      'Using French word order instead of German V2',
      'Pronunciation of German umlauts (unfamiliar sounds)',
    ],
    cultural_notes: 'Darija (Moroccan Arabic) is a widely spoken Arabic dialect. Many Darija speakers also know French and Spanish.',
    system_prompt_note: `Student speaks Darija. They likely also know French and possibly Spanish. Leverage French-German cognates (Restaurant, Hotel, Tourismus). When correcting, reference French grammar when helpful: "In German, unlike French, the verb must always be in second position." German articles do not match French gender, so warn against transferring French gender assumptions.`,
  },

  French: {
    language: 'French',
    flag: '\u{1F1EB}\u{1F1F7}',
    challenges: [
      'German case system (French lost cases centuries ago)',
      'German word order in subordinate clauses (verb-final)',
      'German compound words (French uses separate words)',
      'German grammatical gender often differs from French',
      'Modal particles (ja, doch, mal, eigentlich) have no French equivalent',
    ],
    leverage_points: [
      'Extensive shared vocabulary: Komfort, Balkon, Restaurant, Musik',
      'Similar verb conjugation complexity',
      'Both have grammatical gender (though assignments often differ)',
      'Shared Latin roots for academic vocabulary',
    ],
    common_errors: [
      'Assuming French gender equals German gender',
      'Verb-final subordinate clauses (French word order transferred)',
      'Adjective declension (French adjectives agree differently)',
      'Separable verbs (no French equivalent)',
    ],
    cultural_notes: 'French is one of the most common L1s for German learners in Europe.',
    system_prompt_note: `Student speaks French. Leverage the massive shared French-German vocabulary -- when introducing new words, note French cognates. Warn explicitly that gender assignments often differ from French (das Maedchen is neuter, not feminine). The German subordinate clause verb-final rule (weil ich das mache, not weil ich mache das) is the most common persistent error -- explain it with French contrast: "weil" = "parce que" but the verb goes to the END in German. Separable verbs (anrufen, aufmachen) confuse French speakers.`,
  },

  English: {
    language: 'English',
    flag: '\u{1F1EC}\u{1F1E7}',
    challenges: [
      'German case system (English lost cases)',
      'Grammatical gender (English is gender-neutral)',
      'German V2 word order in complex sentences',
      'Verb-final subordinate clauses',
      "Adjective declension (English adjectives don't change)",
      'Two-way prepositions (Akkusativ vs Dativ)',
    ],
    leverage_points: [
      'German and English share Germanic roots -- huge cognate vocabulary',
      'Shared: Haus/house, Wasser/water, Mutter/mother, Bruder/brother',
      'English compound words mirror German logic',
    ],
    common_errors: [
      'der/die/das: treating nouns as gender-neutral',
      '"Ich bin kalt" vs "Mir ist kalt"',
      'Two-way prepositions: in + Akkusativ (movement) vs in + Dativ (location)',
      'False friends: bekommen (to receive), Gift (poison)',
    ],
    cultural_notes: 'English speakers are the largest group of German learners globally.',
    system_prompt_note: `Student speaks English. Capitalize on the enormous Germanic vocabulary overlap -- always highlight cognates (Wasser/water, Haus/house). The biggest hurdles are: (1) grammatical gender -- no reliable rule, must memorize; (2) case system -- introduce as "the article changes shape to show the noun's job"; (3) verb-second rule -- contrast with English flexible word order. False friends (Gift=poison, bekommen=receive) should always be flagged.`,
  },

  Spanish: {
    language: 'Spanish',
    flag: '\u{1F1EA}\u{1F1F8}',
    challenges: [
      'German case system (Spanish has no cases)',
      'German word order (Spanish is more flexible)',
      'Three genders in German (Spanish has two)',
      'German verb-final subordinate clauses',
    ],
    leverage_points: [
      'Both have grammatical gender',
      'Both have formal/informal address (Sie/du like usted/tu)',
      'Similar verb complexity and conjugation tables',
      'Romance-Germanic shared vocabulary through Latin',
    ],
    common_errors: [
      "Gender: Spanish endings don't predict German gender",
      'Negation position differs from Spanish',
    ],
    cultural_notes: 'Large Spanish-speaking communities learn German for EU work migration.',
    system_prompt_note: `Student speaks Spanish. Both languages have gendered nouns -- use this as a bridge but warn that Spanish gender does not predict German gender. The formal/informal distinction (Sie/du) mirrors usted/tu perfectly. Explain the V2 rule by contrast: Spanish allows flexible word order, German requires the verb always in 2nd position. German cases are the main hurdle -- explain with preposition groups (mit always Dativ, durch always Akkusativ).`,
  },

  Turkish: {
    language: 'Turkish',
    flag: '\u{1F1F9}\u{1F1F7}',
    challenges: [
      'German SVO word order (Turkish is SOV)',
      'German articles (Turkish has none)',
      'German grammatical gender (Turkish is genderless)',
    ],
    leverage_points: [
      'Turkish has a rich 6-case suffix system -- bridge to German cases',
      'Turkish agglutination logic helps understand German compound words',
    ],
    common_errors: [
      'Placing verb at end in main clauses (Turkish habit)',
      'Omitting articles entirely',
      'Gender confusion (Turkish is genderless)',
    ],
    cultural_notes: 'Turkey has the largest diaspora in Germany.',
    system_prompt_note: `Student speaks Turkish. The single biggest challenge is word order: Turkish is SOV (verb at end ALWAYS), German is V2 (verb in position 2 in main clauses, but verb-final in subordinate clauses). Leverage Turkish 6-case system: Turkish locative maps to German Dativ, Turkish accusative to German Akkusativ. Turkish has no articles or gender -- this must be memorized. German compound words will feel logical to Turkish speakers familiar with agglutination.`,
  },

  Chinese: {
    language: 'Chinese (Mandarin)',
    flag: '\u{1F1E8}\u{1F1F3}',
    challenges: [
      'German grammatical cases (Chinese has no cases)',
      'German articles and gender (Chinese has neither)',
      'German verb conjugation (Chinese verbs do not conjugate)',
      'German plural formation (Chinese uses measure words)',
    ],
    leverage_points: [
      'Chinese learners excel at pattern memorization -- leverage for article/case tables',
      'Chinese compound word logic mirrors German compound words',
      'High study motivation',
    ],
    common_errors: [
      'Missing articles entirely',
      'No verb conjugation (treating verbs as invariable)',
      'Plural formation errors',
    ],
    cultural_notes: 'Large Chinese student population in German universities.',
    system_prompt_note: `Student speaks Mandarin Chinese. The biggest conceptual hurdle is that German verbs conjugate (ich gehe, du gehst, er geht) -- Chinese verbs never change form. Build clear conjugation tables. German articles (der/die/das) have no Chinese equivalent -- treat them as inseparable parts of the noun. German compound words (Kindergarten, Schadenfreude) feel natural to Chinese speakers used to combining characters.`,
  },

  Japanese: {
    language: 'Japanese',
    flag: '\u{1F1EF}\u{1F1F5}',
    challenges: [
      'German word order (Japanese is SOV)',
      'German articles (Japanese has none)',
      'German grammatical gender (Japanese has none)',
    ],
    leverage_points: [
      'Japanese has a sophisticated case-particle system -- bridge to German cases',
      'Japanese politeness register maps to German Sie/du',
      'Excellent study discipline',
    ],
    common_errors: [
      'Verb at end of main clause',
      'No articles',
      'Mixing formal and informal register',
    ],
    cultural_notes: 'Japan has deep cultural interest in German (philosophy, music, medicine).',
    system_prompt_note: `Student speaks Japanese. The Japanese particle system is the best bridge to German cases: wa/ga map to Nominativ, o to Akkusativ, ni to Dativ. Word order: Japanese SOV maps to German subordinate clauses (verb-final) -- explain that German main clauses are V2 (different!) but subordinate clauses are verb-final like Japanese. German Sie/du is similar to Japanese keigo levels.`,
  },

  Russian: {
    language: 'Russian',
    flag: '\u{1F1F7}\u{1F1FA}',
    challenges: [
      'German word order (Russian has flexible order due to rich case system)',
      'German articles (Russian has none)',
    ],
    leverage_points: [
      'Russian has 6 cases -- the best L1 preparation for German cases',
      'Russian grammatical gender (3 genders) aligns partially with German',
    ],
    common_errors: [
      'Omitting articles',
      'Case confusion with prepositions',
      'Overusing the genitive',
    ],
    cultural_notes: 'Large Russian/CIS communities learn German for EU migration.',
    system_prompt_note: `Student speaks Russian. Both are inflectional with complex case systems. Russian has 6 cases; German has 4. Map: Russian nominative to German Nominativ, accusative to Akkusativ, dative to Dativ. Key difference: German REQUIRES articles (der/die/das) which carry case information, while Russian uses word endings. German fixed V2 word order will feel restrictive compared to Russian flexible order.`,
  },

  Polish: {
    language: 'Polish',
    flag: '\u{1F1F5}\u{1F1F1}',
    challenges: [
      'German article system (Polish has none)',
      'German fixed word order (Polish is flexible)',
    ],
    leverage_points: [
      'Polish has 7 cases -- excellent foundation for German cases',
      'Long history of German-Polish contact -- shared vocabulary',
    ],
    common_errors: [
      'Omitting articles',
      'False cognates',
    ],
    cultural_notes: "Poland is Germany's largest neighbor -- massive learning community.",
    system_prompt_note: `Student speaks Polish. Both languages are inflectional with grammatical gender. Use Polish cases as a bridge: Polish mianownik maps to Nominativ, biernik to Akkusativ, celownik to Dativ. The main new concept is German ARTICLES -- Polish has none, so der/die/das/den/dem/des must be learned from scratch. German word order is stricter than Polish -- explain V2 rule clearly.`,
  },

  Italian: {
    language: 'Italian',
    flag: '\u{1F1EE}\u{1F1F9}',
    challenges: [
      'German cases (Italian has none)',
      'German word order (Italian allows more flexibility)',
      'German grammatical gender differs from Italian',
    ],
    leverage_points: [
      'Both have grammatical gender',
      'Extensive shared Latin vocabulary',
      'Both have formal/informal address (Lei/tu similar to Sie/du)',
    ],
    common_errors: [
      'Gender transfer errors',
      'Missing case endings',
      'Word order in subordinate clauses',
    ],
    cultural_notes: 'Large Italian community in Germany (gastarbeiter history).',
    system_prompt_note: `Student speaks Italian. Use the Italian article system as a bridge to German articles -- both mark gender and number. Warn that Italian gender does not predict German gender. Italian has no cases -- introduce German cases as "the article changes form to show the noun's role." Italian verb conjugation complexity (6 forms) helps with German conjugation.`,
  },

  Portuguese: {
    language: 'Portuguese',
    flag: '\u{1F1F5}\u{1F1F9}',
    challenges: [
      'German case system',
      'German word order',
      'Three genders in German (Portuguese has two)',
    ],
    leverage_points: [
      'Both have articles that mark gender',
      'Shared Latin vocabulary',
      'Both have formal/informal address',
    ],
    common_errors: [
      'Gender transfer from Portuguese',
      'Missing case markers',
      'Subordinate clause word order',
    ],
    cultural_notes: 'Large Brazilian and Portuguese communities in Germany.',
    system_prompt_note: `Student speaks Portuguese. Leverage shared Latin vocabulary -- highlight cognates. Both languages mark gender with articles, but warn that Portuguese gender does not predict German gender. Introduce German cases as the article changing shape. The Portuguese subjunctive complexity makes German Konjunktiv II easier to grasp.`,
  },

  Hindi: {
    language: 'Hindi',
    flag: '\u{1F1EE}\u{1F1F3}',
    challenges: [
      'German articles (Hindi has none)',
      'German grammatical gender (Hindi has 2, German has 3)',
      'German word order (Hindi is SOV)',
    ],
    leverage_points: [
      'Hindi has a postposition system that maps loosely to German cases',
      'Hindi verb-final order helps with German subordinate clauses',
      'Indo-European shared roots: Mutter/mata, drei/teen, Name/naam',
    ],
    common_errors: [
      'Omitting articles',
      'Wrong gender',
      'Verb placement in main clauses',
    ],
    cultural_notes: 'Many Indian students learn German for engineering and science programs (DAAD).',
    system_prompt_note: `Student speaks Hindi. Hindi is SOV -- German subordinate clauses (verb-final) will feel natural, but main clause V2 order must be explicitly taught. Hindi postpositions (ko, ne, mein) map loosely to German cases. Hindi has no articles -- treat German der/die/das as vocabulary memorized with each noun. Indo-European cognates exist (Mutter/mata, drei/teen) -- highlight these for confidence.`,
  },

  Korean: {
    language: 'Korean',
    flag: '\u{1F1F0}\u{1F1F7}',
    challenges: [
      'German V2 word order (Korean is strictly SOV)',
      'German articles (Korean has none)',
      'German grammatical gender (Korean has none)',
    ],
    leverage_points: [
      'Korean has elaborate honorific levels -- maps to German Sie/du',
      'Korean sentence particles work like German cases',
      'High study motivation and discipline',
    ],
    common_errors: [
      'Verb placement in main clauses',
      'Missing articles',
      'No verb conjugation',
    ],
    cultural_notes: 'South Korean interest in German engineering and academic culture.',
    system_prompt_note: `Student speaks Korean. Map Korean sentence particles to German cases: i/ga maps to Nominativ, eul/reul to Akkusativ, ege/hante to Dativ. Korean honorific levels map well to German du/Sie distinction. Main difference: German V2 word order vs Korean SOV (verb always last). German verb conjugation must be built from scratch -- use clear tables.`,
  },

  Persian: {
    language: 'Persian (Farsi)',
    flag: '\u{1F1EE}\u{1F1F7}',
    challenges: [
      'German grammatical gender (Persian is gender-neutral)',
      'German articles (Persian has none)',
      'German V2 word order (Persian is SOV)',
    ],
    leverage_points: [
      'Persian is SOV -- German subordinate clauses feel natural',
      'Indo-European cognates: Bruder/baradar, Mutter/madar, drei/se',
    ],
    common_errors: [
      'Missing articles and gender',
      'Verb placement errors',
    ],
    cultural_notes: 'Large Iranian diaspora in Germany.',
    system_prompt_note: `Student speaks Persian (Farsi). Persian is gender-neutral with no articles -- der/die/das and case endings must be learned from scratch. However, Persian is Indo-European: highlight cognates (Mutter/madar, Bruder/baradar, drei/se). Persian is SOV -- German subordinate clauses (verb-final) will feel natural, but main clause V2 needs explicit teaching.`,
  },

  Vietnamese: {
    language: 'Vietnamese',
    flag: '\u{1F1FB}\u{1F1F3}',
    challenges: [
      'German grammatical gender and articles (Vietnamese has neither)',
      'German verb conjugation (Vietnamese verbs are invariable)',
      'German cases and plural formation',
    ],
    leverage_points: [
      'Vietnamese tonal discipline helps with German pronunciation precision',
      'Vietnamese learners excel at memorization',
    ],
    common_errors: [
      'Missing articles and conjugation',
      'Plural confusion',
    ],
    cultural_notes: 'Vietnam has strong historical ties with Germany (both East and West).',
    system_prompt_note: `Student speaks Vietnamese. Vietnamese is an isolating language with no inflection -- German morphology is a steep learning curve. Verb conjugation, article declension, and case endings must all be built from zero. Treat each German noun as a package: gender + plural form + article must be memorized together.`,
  },

  Swahili: {
    language: 'Swahili',
    flag: '\u{1F1F0}\u{1F1EA}',
    challenges: [
      'German grammatical gender (Swahili has noun classes, not gender)',
      'German articles',
      'German case system',
    ],
    leverage_points: [
      'Swahili noun class system provides a conceptual bridge to German gender',
      'Swahili verb agreement complexity helps with German conjugation',
    ],
    common_errors: [
      'Article and gender errors',
      'Case confusion',
    ],
    cultural_notes: 'Growing German-learning community in Kenya, Tanzania, Uganda.',
    system_prompt_note: `Student speaks Swahili. Swahili has a noun class system (similar in concept to German gender) -- just as Swahili nouns belong to classes that determine agreement, German nouns have gender that determines article and adjective forms. Swahili verb agreement prefixes help with the idea that German verbs change based on subject. German cases are new -- introduce them with preposition triggers.`,
  },

  Dutch: {
    language: 'Dutch',
    flag: '\u{1F1F3}\u{1F1F1}',
    challenges: [
      'German case system (Dutch largely lost cases)',
      'German three-gender system (Dutch has two)',
      'False friends between Dutch and German',
    ],
    leverage_points: [
      'Dutch and German are extremely closely related -- 70-80% vocabulary overlap',
      'Dutch speakers understand German text almost immediately',
      'Both have separable verbs and compound words',
    ],
    common_errors: [
      "False friends: Dutch 'worden' vs German 'werden'",
      'Case endings (Dutch dropped most of them)',
      'Wrong gender (Dutch de/het does not map perfectly to German der/die/das)',
    ],
    cultural_notes: 'Dutch speakers learn German fastest of any language group.',
    system_prompt_note: `Student speaks Dutch. Massive vocabulary overlap -- exploit cognates constantly. Main differences: (1) German has 3 genders, Dutch has 2; Dutch de does not always map to German der/die; (2) German has 4 full cases with article declension, Dutch has largely lost cases; (3) False friends exist (worden vs werden). Dutch separable verbs and compound words work identically to German -- use this strength.`,
  },
};

// Supported language options for the UI dropdown
export const L1_LANGUAGE_OPTIONS = Object.keys(L1_PROFILES).map(key => ({
  value: key,
  label: L1_PROFILES[key].language,
  flag: L1_PROFILES[key].flag,
}));

// Get the system prompt note for a given native language
export function getL1PromptNote(nativeLanguage: string): string {
  return L1_PROFILES[nativeLanguage]?.system_prompt_note ?? '';
}

// Get common errors for a given native language
export function getL1CommonErrors(nativeLanguage: string): string[] {
  return L1_PROFILES[nativeLanguage]?.common_errors ?? [];
}
