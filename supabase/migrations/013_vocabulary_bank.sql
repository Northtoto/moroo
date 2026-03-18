-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 013: System Vocabulary Bank
-- ═══════════════════════════════════════════════════════════════════════════
-- A curated, system-wide German vocabulary reference table.
-- Unlike vocabulary_cards (per-user), this is shared across all students.
--
-- Used by:
--   - AI tutor: suggest relevant vocabulary during corrections
--   - Flashcard system: seed a new user's deck with level-appropriate words
--   - Courses page: display vocabulary lists per CEFR level
--   - League/leaderboard: vocabulary mastery challenges
--
-- Structure: german_word, english_translation, cefr_level, category, example_sentence

CREATE TABLE IF NOT EXISTS public.vocabulary_bank (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  german_word         TEXT        NOT NULL UNIQUE,
  english_translation TEXT        NOT NULL,
  cefr_level          TEXT        NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  word_type           TEXT        NOT NULL CHECK (word_type IN (
                                    'noun','verb','adjective','adverb',
                                    'preposition','conjunction','pronoun',
                                    'numeral','phrase','interjection'
                                  )),
  category            TEXT        NOT NULL DEFAULT 'general',
  article             TEXT        CHECK (article IN ('der','die','das', NULL)),
  plural_form         TEXT,
  example_sentence    TEXT,
  example_translation TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public read — anyone can query the vocabulary bank
ALTER TABLE public.vocabulary_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vocabulary_bank_public_read"
  ON public.vocabulary_bank
  FOR SELECT
  USING (true);

-- Only service role can insert/update/delete
-- (no INSERT policy = only service_role key can write)

CREATE INDEX IF NOT EXISTS idx_vocab_bank_cefr     ON public.vocabulary_bank(cefr_level);
CREATE INDEX IF NOT EXISTS idx_vocab_bank_category ON public.vocabulary_bank(category);
CREATE INDEX IF NOT EXISTS idx_vocab_bank_type     ON public.vocabulary_bank(word_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA — Essential German Vocabulary A1 → B2
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.vocabulary_bank
  (german_word, english_translation, cefr_level, word_type, category, article, plural_form, example_sentence, example_translation)
VALUES

-- ─── A1: Greetings & Basics ──────────────────────────────────────────────────
('Hallo',          'Hello',               'A1', 'interjection', 'greetings',  NULL,  NULL,          'Hallo, wie geht es dir?',                   'Hello, how are you?'),
('Guten Morgen',   'Good morning',        'A1', 'phrase',       'greetings',  NULL,  NULL,          'Guten Morgen! Hast du gut geschlafen?',      'Good morning! Did you sleep well?'),
('Guten Tag',      'Good day / Hello',    'A1', 'phrase',       'greetings',  NULL,  NULL,          'Guten Tag, Herr Müller.',                   'Good day, Mr. Müller.'),
('Guten Abend',    'Good evening',        'A1', 'phrase',       'greetings',  NULL,  NULL,          'Guten Abend! Wie war Ihr Tag?',              'Good evening! How was your day?'),
('Auf Wiedersehen','Goodbye',             'A1', 'phrase',       'greetings',  NULL,  NULL,          'Auf Wiedersehen und bis morgen!',            'Goodbye and see you tomorrow!'),
('Tschüss',        'Bye (informal)',      'A1', 'interjection', 'greetings',  NULL,  NULL,          'Tschüss, bis später!',                      'Bye, see you later!'),
('Bitte',          'Please / You''re welcome', 'A1', 'adverb',  'basics',     NULL,  NULL,          'Kannst du mir bitte helfen?',               'Can you please help me?'),
('Danke',          'Thank you',           'A1', 'interjection', 'basics',     NULL,  NULL,          'Danke sehr für Ihre Hilfe!',                'Thank you very much for your help!'),
('Entschuldigung', 'Excuse me / Sorry',   'A1', 'interjection', 'basics',     NULL,  NULL,          'Entschuldigung, wo ist der Bahnhof?',       'Excuse me, where is the train station?'),
('Ja',             'Yes',                 'A1', 'adverb',       'basics',     NULL,  NULL,          'Ja, das stimmt.',                           'Yes, that is correct.'),
('Nein',           'No',                  'A1', 'adverb',       'basics',     NULL,  NULL,          'Nein, ich verstehe das nicht.',             'No, I do not understand that.'),

-- ─── A1: Personal Pronouns & To Be ──────────────────────────────────────────
('ich',            'I',                   'A1', 'pronoun',      'grammar',    NULL,  NULL,          'Ich bin Student.',                          'I am a student.'),
('du',             'you (informal)',       'A1', 'pronoun',      'grammar',    NULL,  NULL,          'Du sprichst sehr gut Deutsch.',             'You speak German very well.'),
('er',             'he',                  'A1', 'pronoun',      'grammar',    NULL,  NULL,          'Er kommt aus Berlin.',                      'He comes from Berlin.'),
('sie',            'she / they',          'A1', 'pronoun',      'grammar',    NULL,  NULL,          'Sie lernt jeden Tag Deutsch.',               'She learns German every day.'),
('wir',            'we',                  'A1', 'pronoun',      'grammar',    NULL,  NULL,          'Wir gehen heute ins Kino.',                 'We are going to the cinema today.'),
('sein',           'to be',               'A1', 'verb',         'core-verbs', NULL,  NULL,          'Ich bin müde, aber glücklich.',             'I am tired but happy.'),
('haben',          'to have',             'A1', 'verb',         'core-verbs', NULL,  NULL,          'Ich habe einen Hund und eine Katze.',       'I have a dog and a cat.'),
('machen',         'to do / to make',     'A1', 'verb',         'core-verbs', NULL,  NULL,          'Was machst du am Wochenende?',              'What are you doing at the weekend?'),
('gehen',          'to go',               'A1', 'verb',         'core-verbs', NULL,  NULL,          'Ich gehe jeden Tag zu Fuß zur Arbeit.',     'I walk to work every day.'),
('kommen',         'to come',             'A1', 'verb',         'core-verbs', NULL,  NULL,          'Woher kommst du?',                          'Where do you come from?'),
('wohnen',         'to live / to reside', 'A1', 'verb',         'core-verbs', NULL,  NULL,          'Ich wohne in München.',                     'I live in Munich.'),

-- ─── A1: Numbers ─────────────────────────────────────────────────────────────
('eins',           'one',                 'A1', 'numeral',      'numbers',    NULL,  NULL,          'Ich habe nur eine Schwester.',              'I have only one sister.'),
('zwei',           'two',                 'A1', 'numeral',      'numbers',    NULL,  NULL,          'Ich trinke zwei Tassen Kaffee am Tag.',     'I drink two cups of coffee a day.'),
('drei',           'three',               'A1', 'numeral',      'numbers',    NULL,  NULL,          'Wir haben drei Kinder.',                    'We have three children.'),
('zehn',           'ten',                 'A1', 'numeral',      'numbers',    NULL,  NULL,          'Das kostet zehn Euro.',                     'That costs ten euros.'),
('hundert',        'one hundred',         'A1', 'numeral',      'numbers',    NULL,  NULL,          'Es gibt hundert Studenten in der Klasse.',  'There are one hundred students in the class.'),

-- ─── A1: Days of the Week ────────────────────────────────────────────────────
('Montag',         'Monday',              'A1', 'noun',         'time',       'der', 'Montage',     'Am Montag beginnt die Arbeitswoche.',       'On Monday the working week begins.'),
('Dienstag',       'Tuesday',             'A1', 'noun',         'time',       'der', 'Dienstage',   'Dienstags gehe ich ins Fitnessstudio.',     'On Tuesdays I go to the gym.'),
('Mittwoch',       'Wednesday',           'A1', 'noun',         'time',       'der', 'Mittwoche',   'Mittwoch ist mein freier Tag.',             'Wednesday is my day off.'),
('Donnerstag',     'Thursday',            'A1', 'noun',         'time',       'der', 'Donnerstage', 'Am Donnerstag haben wir ein Meeting.',      'On Thursday we have a meeting.'),
('Freitag',        'Friday',              'A1', 'noun',         'time',       'der', 'Freitage',    'Freitags gehe ich früher nach Hause.',      'On Fridays I go home earlier.'),
('Samstag',        'Saturday',            'A1', 'noun',         'time',       'der', 'Samstage',    'Am Samstag schlafe ich lang.',              'On Saturday I sleep in.'),
('Sonntag',        'Sunday',              'A1', 'noun',         'time',       'der', 'Sonntage',    'Sonntags besuche ich meine Familie.',       'On Sundays I visit my family.'),

-- ─── A1: Family ──────────────────────────────────────────────────────────────
('die Mutter',     'mother',              'A1', 'noun',         'family',     'die', 'Mütter',      'Meine Mutter kocht sehr gut.',              'My mother cooks very well.'),
('der Vater',      'father',              'A1', 'noun',         'family',     'der', 'Väter',       'Mein Vater arbeitet als Arzt.',             'My father works as a doctor.'),
('die Schwester',  'sister',              'A1', 'noun',         'family',     'die', 'Schwestern',  'Meine Schwester ist jünger als ich.',       'My sister is younger than me.'),
('der Bruder',     'brother',             'A1', 'noun',         'family',     'der', 'Brüder',      'Mein Bruder wohnt in Hamburg.',             'My brother lives in Hamburg.'),
('das Kind',       'child',               'A1', 'noun',         'family',     'das', 'Kinder',      'Das Kind spielt im Garten.',                'The child is playing in the garden.'),

-- ─── A1: Colors ──────────────────────────────────────────────────────────────
('rot',            'red',                 'A1', 'adjective',    'colors',     NULL,  NULL,          'Das rote Auto gehört meinem Vater.',        'The red car belongs to my father.'),
('blau',           'blue',                'A1', 'adjective',    'colors',     NULL,  NULL,          'Der Himmel ist heute sehr blau.',           'The sky is very blue today.'),
('grün',           'green',               'A1', 'adjective',    'colors',     NULL,  NULL,          'Ich mag grüne Äpfel.',                      'I like green apples.'),
('gelb',           'yellow',              'A1', 'adjective',    'colors',     NULL,  NULL,          'Die Sonne ist gelb und warm.',              'The sun is yellow and warm.'),
('schwarz',        'black',               'A1', 'adjective',    'colors',     NULL,  NULL,          'Ich trage gerne schwarze Kleidung.',        'I like wearing black clothing.'),
('weiß',           'white',               'A1', 'adjective',    'colors',     NULL,  NULL,          'Der Schnee ist weiß und kalt.',             'The snow is white and cold.'),

-- ─── A2: Food & Drink ────────────────────────────────────────────────────────
('das Frühstück',  'breakfast',           'A2', 'noun',         'food',       'das', 'Frühstücke',  'Ich esse zum Frühstück Brot mit Butter.',   'I eat bread with butter for breakfast.'),
('das Mittagessen','lunch',               'A2', 'noun',         'food',       'das', 'Mittagessen', 'Das Mittagessen wird in der Kantine serviert.','Lunch is served in the canteen.'),
('das Abendessen', 'dinner',              'A2', 'noun',         'food',       'das', 'Abendessen',  'Zum Abendessen machen wir Pasta.',           'We make pasta for dinner.'),
('das Wasser',     'water',               'A2', 'noun',         'food',       'das', 'Wässer',      'Kannst du mir ein Glas Wasser bringen?',    'Can you bring me a glass of water?'),
('der Kaffee',     'coffee',              'A2', 'noun',         'food',       'der', 'Kaffees',     'Ich trinke morgens immer Kaffee.',           'I always drink coffee in the morning.'),
('das Brot',       'bread',               'A2', 'noun',         'food',       'das', 'Brote',       'Deutsches Brot ist sehr lecker.',           'German bread is very tasty.'),
('die Milch',      'milk',                'A2', 'noun',         'food',       'die', NULL,          'Ich trinke Milch zum Frühstück.',           'I drink milk for breakfast.'),
('das Fleisch',    'meat',                'A2', 'noun',         'food',       'das', NULL,          'Er isst kein Fleisch — er ist Vegetarier.', 'He does not eat meat — he is a vegetarian.'),
('das Gemüse',     'vegetables',          'A2', 'noun',         'food',       'das', NULL,          'Iss mehr Gemüse, es ist gesund!',           'Eat more vegetables, it is healthy!'),
('der Apfel',      'apple',               'A2', 'noun',         'food',       'der', 'Äpfel',       'Ein Apfel am Tag hält den Arzt fern.',      'An apple a day keeps the doctor away.'),

-- ─── A2: Weather ─────────────────────────────────────────────────────────────
('das Wetter',     'weather',             'A2', 'noun',         'weather',    'das', 'Wetter',      'Wie ist das Wetter heute?',                 'What is the weather like today?'),
('die Sonne',      'sun',                 'A2', 'noun',         'weather',    'die', 'Sonnen',      'Die Sonne scheint, es ist schön warm.',     'The sun is shining, it is pleasantly warm.'),
('der Regen',      'rain',                'A2', 'noun',         'weather',    'der', 'Regen',       'Vergiss nicht deinen Regenschirm!',         'Do not forget your umbrella!'),
('der Schnee',     'snow',                'A2', 'noun',         'weather',    'der', NULL,          'Im Winter gibt es viel Schnee in Bayern.',  'In winter there is a lot of snow in Bavaria.'),
('kalt',           'cold',                'A2', 'adjective',    'weather',    NULL,  NULL,          'Es ist sehr kalt heute — zieh eine Jacke an!', 'It is very cold today — put on a jacket!'),
('warm',           'warm',                'A2', 'adjective',    'weather',    NULL,  NULL,          'Im Sommer ist es hier sehr warm.',          'In summer it is very warm here.'),
('heiß',           'hot',                 'A2', 'adjective',    'weather',    NULL,  NULL,          'In der Sahara ist es unerträglich heiß.',   'In the Sahara it is unbearably hot.'),

-- ─── A2: Places & Directions ─────────────────────────────────────────────────
('der Bahnhof',    'train station',       'A2', 'noun',         'places',     'der', 'Bahnhöfe',    'Der Bahnhof ist fünf Minuten zu Fuß entfernt.','The train station is five minutes on foot.'),
('die Schule',     'school',              'A2', 'noun',         'places',     'die', 'Schulen',     'Die Kinder gehen um 8 Uhr in die Schule.',  'The children go to school at 8 o''clock.'),
('das Krankenhaus','hospital',            'A2', 'noun',         'places',     'das', 'Krankenhäuser','Das nächste Krankenhaus ist in der Stadtmitte.','The nearest hospital is in the city centre.'),
('die Apotheke',   'pharmacy',            'A2', 'noun',         'places',     'die', 'Apotheken',   'Ich brauche Medikamente — wo ist die Apotheke?','I need medicine — where is the pharmacy?'),
('links',          'left',                'A2', 'adverb',       'directions', NULL,  NULL,          'Biegen Sie an der Ampel links ab.',         'Turn left at the traffic lights.'),
('rechts',         'right',               'A2', 'adverb',       'directions', NULL,  NULL,          'Das Hotel ist rechts neben dem Museum.',    'The hotel is to the right of the museum.'),
('geradeaus',      'straight ahead',      'A2', 'adverb',       'directions', NULL,  NULL,          'Gehen Sie geradeaus bis zur Kreuzung.',     'Go straight ahead to the intersection.'),

-- ─── B1: Common Verbs ────────────────────────────────────────────────────────
('verstehen',      'to understand',       'B1', 'verb',         'core-verbs', NULL,  NULL,          'Ich verstehe die Frage leider nicht.',      'Unfortunately I do not understand the question.'),
('erklären',       'to explain',          'B1', 'verb',         'core-verbs', NULL,  NULL,          'Kannst du mir das bitte erklären?',         'Can you please explain that to me?'),
('vergessen',      'to forget',           'B1', 'verb',         'core-verbs', NULL,  NULL,          'Ich habe meinen Schlüssel vergessen!',      'I have forgotten my key!'),
('erinnern',       'to remember',         'B1', 'verb',         'core-verbs', NULL,  NULL,          'Ich kann mich nicht daran erinnern.',       'I cannot remember that.'),
('entscheiden',    'to decide',           'B1', 'verb',         'core-verbs', NULL,  NULL,          'Wir müssen uns bis Freitag entscheiden.',   'We have to decide by Friday.'),
('versuchen',      'to try',              'B1', 'verb',         'core-verbs', NULL,  NULL,          'Ich versuche, jeden Tag Deutsch zu üben.',  'I try to practise German every day.'),
('brauchen',       'to need',             'B1', 'verb',         'core-verbs', NULL,  NULL,          'Ich brauche mehr Zeit für diese Aufgabe.',  'I need more time for this task.'),
('denken',         'to think',            'B1', 'verb',         'core-verbs', NULL,  NULL,          'Ich denke, das ist eine gute Idee.',        'I think that is a good idea.'),
('glauben',        'to believe',          'B1', 'verb',         'core-verbs', NULL,  NULL,          'Ich glaube nicht, dass das stimmt.',        'I do not believe that is correct.'),
('bedeuten',       'to mean',             'B1', 'verb',         'core-verbs', NULL,  NULL,          'Was bedeutet dieses Wort auf Deutsch?',     'What does this word mean in German?'),

-- ─── B1: Key Adjectives ───────────────────────────────────────────────────────
('wichtig',        'important',           'B1', 'adjective',    'describing', NULL,  NULL,          'Es ist sehr wichtig, regelmäßig zu üben.', 'It is very important to practise regularly.'),
('schwierig',      'difficult',           'B1', 'adjective',    'describing', NULL,  NULL,          'Deutsch ist schwierig, aber machbar.',      'German is difficult but manageable.'),
('einfach',        'simple / easy',       'B1', 'adjective',    'describing', NULL,  NULL,          'Diese Übung ist relativ einfach.',          'This exercise is relatively easy.'),
('möglich',        'possible',            'B1', 'adjective',    'describing', NULL,  NULL,          'Ist es möglich, das früher zu erledigen?', 'Is it possible to get that done earlier?'),
('ähnlich',        'similar',             'B1', 'adjective',    'describing', NULL,  NULL,          'Deutsch und Niederländisch sind sich ähnlich.','German and Dutch are similar to each other.'),
('unterschiedlich','different / varied',  'B1', 'adjective',    'describing', NULL,  NULL,          'Die zwei Dialekte sind sehr unterschiedlich.','The two dialects are very different.'),

-- ─── B1: Conjunctions & Connectors ───────────────────────────────────────────
('obwohl',         'although / even though','B1','conjunction',  'grammar',   NULL,  NULL,          'Obwohl es regnet, gehe ich spazieren.',     'Although it is raining, I am going for a walk.'),
('weil',           'because',             'B1', 'conjunction',  'grammar',    NULL,  NULL,          'Ich lerne Deutsch, weil ich in Berlin arbeite.','I am learning German because I work in Berlin.'),
('damit',          'so that',             'B1', 'conjunction',  'grammar',    NULL,  NULL,          'Ich übe täglich, damit ich besser werde.', 'I practise daily so that I get better.'),
('deshalb',        'therefore / that''s why','B1','adverb',      'grammar',   NULL,  NULL,          'Er war krank, deshalb kam er nicht.',       'He was ill, that is why he did not come.'),
('trotzdem',       'nevertheless / still', 'B1','adverb',       'grammar',    NULL,  NULL,          'Es war schwer, trotzdem habe ich es geschafft.','It was hard, nevertheless I managed it.'),
('außerdem',       'besides / moreover',  'B1', 'adverb',       'grammar',    NULL,  NULL,          'Außerdem muss ich noch die Hausaufgaben machen.','Besides, I still have to do the homework.'),

-- ─── B2: Advanced Vocabulary ─────────────────────────────────────────────────
('die Herausforderung','challenge',        'B2', 'noun',        'advanced',   'die', 'Herausforderungen','Das war eine echte Herausforderung für mich.','That was a real challenge for me.'),
('die Gelegenheit','opportunity',          'B2', 'noun',        'advanced',   'die', 'Gelegenheiten','Diese Gelegenheit darf ich nicht verpassen.','I must not miss this opportunity.'),
('die Erfahrung',  'experience',           'B2', 'noun',        'advanced',   'die', 'Erfahrungen', 'Ich habe viel Erfahrung in diesem Bereich.', 'I have a lot of experience in this area.'),
('der Zusammenhang','context / connection','B2', 'noun',        'advanced',   'der', 'Zusammenhänge','Im Zusammenhang mit dem Klimawandel ist das wichtig.','In the context of climate change, that is important.'),
('berücksichtigen','to take into account', 'B2', 'verb',        'advanced',   NULL,  NULL,          'Wir müssen alle Faktoren berücksichtigen.',  'We must take all factors into account.'),
('voraussetzen',   'to presuppose',        'B2', 'verb',        'advanced',   NULL,  NULL,          'Das setzt ein gewisses Grundwissen voraus.', 'That presupposes a certain basic knowledge.'),
('nachhaltig',     'sustainable',          'B2', 'adjective',   'advanced',   NULL,  NULL,          'Wir brauchen nachhaltige Lösungen.',         'We need sustainable solutions.'),
('ausführlich',    'detailed / thorough',  'B2', 'adjective',   'advanced',   NULL,  NULL,          'Bitte gib mir eine ausführliche Erklärung.', 'Please give me a detailed explanation.'),
('inzwischen',     'meanwhile / by now',   'B2', 'adverb',      'advanced',   NULL,  NULL,          'Inzwischen spreche ich fließend Deutsch.',   'By now I speak German fluently.'),
('einerseits',     'on the one hand',      'B2', 'adverb',      'advanced',   NULL,  NULL,          'Einerseits ist es teuer, andererseits sehr nützlich.','On the one hand it is expensive, on the other very useful.')

ON CONFLICT (german_word) DO NOTHING;
