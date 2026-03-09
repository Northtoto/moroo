-- Seed courses
INSERT INTO courses (id, title, description, level, is_published) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'German Basics: A1', 'Start your German journey! Learn greetings, introductions, numbers, and basic sentence structures.', 'A1', true),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Everyday German: A2', 'Build on the basics with everyday vocabulary, shopping, directions, and simple conversations.', 'A2', true),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Grammar Foundations: B1', 'Master German grammar including cases, tenses, and subordinate clauses for confident communication.', 'B1', true),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Conversational German: B2', 'Develop fluency in discussions, debates, and professional conversations with complex grammar.', 'B2', true),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'Advanced Expression: C1', 'Refine your German with idiomatic expressions, nuanced vocabulary, and academic writing.', 'C1', true);

-- Seed lessons for A1 course
INSERT INTO lessons (course_id, title, content, order_index) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Greetings & Introductions', '{"summary": "Learn Hallo, Guten Tag, and how to introduce yourself.", "vocabulary": ["Hallo", "Guten Tag", "Guten Morgen", "Tschüss", "Auf Wiedersehen", "Ich heiße...", "Wie heißen Sie?"], "examples": ["Hallo, ich heiße Anna.", "Guten Tag! Wie heißen Sie?", "Ich komme aus Deutschland."]}', 1),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Numbers & Counting', '{"summary": "Count from 1 to 100 and use numbers in everyday situations.", "vocabulary": ["eins", "zwei", "drei", "vier", "fünf", "zehn", "zwanzig", "hundert"], "examples": ["Ich bin 25 Jahre alt.", "Das kostet zehn Euro.", "Meine Telefonnummer ist..."]}', 2),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'The Alphabet & Pronunciation', '{"summary": "Master German pronunciation including umlauts (ä, ö, ü) and ß.", "vocabulary": ["das Alphabet", "der Umlaut", "das Eszett", "buchstabieren"], "examples": ["Wie schreibt man das?", "Können Sie das buchstabieren?"]}', 3),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Basic Sentence Structure', '{"summary": "Learn subject-verb-object order and simple questions.", "vocabulary": ["ich", "du", "er/sie/es", "sein", "haben", "machen"], "examples": ["Ich bin Student.", "Hast du Zeit?", "Er macht Hausaufgaben."]}', 4),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Days, Months & Weather', '{"summary": "Talk about days of the week, months, and weather.", "vocabulary": ["Montag", "Dienstag", "Januar", "die Sonne", "der Regen", "kalt", "warm"], "examples": ["Heute ist Montag.", "Im Januar ist es kalt.", "Wie ist das Wetter?"]}', 5);

-- Seed lessons for A2 course
INSERT INTO lessons (course_id, title, content, order_index) VALUES
  ('a1b2c3d4-0002-4000-8000-000000000002', 'At the Supermarket', '{"summary": "Shopping vocabulary and polite requests.", "vocabulary": ["der Supermarkt", "die Kasse", "der Preis", "bezahlen", "die Tüte", "billig", "teuer"], "examples": ["Was kostet das?", "Ich hätte gerne zwei Brötchen.", "Kann ich mit Karte bezahlen?"]}', 1),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Asking for Directions', '{"summary": "Navigate cities with direction vocabulary.", "vocabulary": ["links", "rechts", "geradeaus", "die Kreuzung", "die Ampel", "die Straße"], "examples": ["Wo ist der Bahnhof?", "Gehen Sie geradeaus und dann links.", "Es ist neben der Apotheke."]}', 2),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Daily Routine', '{"summary": "Describe your daily activities using reflexive verbs.", "vocabulary": ["aufstehen", "sich waschen", "frühstücken", "arbeiten", "sich anziehen"], "examples": ["Ich stehe um 7 Uhr auf.", "Er wäscht sich die Hände.", "Wir frühstücken zusammen."]}', 3),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Past Tense (Perfekt)', '{"summary": "Talk about what you did using Perfekt tense.", "vocabulary": ["haben", "sein", "gemacht", "gegessen", "gegangen", "gesehen"], "examples": ["Ich habe einen Film gesehen.", "Sie ist nach Berlin gefahren.", "Wir haben Pizza gegessen."]}', 4);

-- Seed lessons for B1 course
INSERT INTO lessons (course_id, title, content, order_index) VALUES
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Accusative & Dative Cases', '{"summary": "Master when to use Akkusativ vs. Dativ with prepositions and verbs.", "vocabulary": ["den/einen", "dem/einem", "für", "mit", "zu", "nach"], "examples": ["Ich gebe dem Mann das Buch.", "Sie wartet auf den Bus.", "Er geht mit seiner Freundin spazieren."]}', 1),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Subordinate Clauses', '{"summary": "Connect ideas with weil, dass, wenn, obwohl.", "vocabulary": ["weil", "dass", "wenn", "obwohl", "damit", "bevor"], "examples": ["Ich lerne Deutsch, weil ich in Berlin arbeite.", "Er sagt, dass er morgen kommt.", "Wenn es regnet, bleibe ich zu Hause."]}', 2),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Konjunktiv II', '{"summary": "Express wishes, hypotheticals, and polite requests.", "vocabulary": ["würde", "hätte", "wäre", "könnte", "sollte"], "examples": ["Ich würde gern nach Japan reisen.", "Wenn ich reich wäre, würde ich ein Haus kaufen.", "Könnten Sie mir bitte helfen?"]}', 3);
