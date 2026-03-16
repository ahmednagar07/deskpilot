-- Expanded classification rules for better coverage

-- Medicine-specific rules
INSERT OR IGNORE INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='medicine'), 'path_contains', 'Medicine',       5),
  ((SELECT id FROM categories WHERE slug='medicine'), 'path_contains', 'Medical',        5),
  ((SELECT id FROM categories WHERE slug='medicine'), 'path_contains', 'Clinical',       5),
  ((SELECT id FROM categories WHERE slug='medicine'), 'path_contains', 'Patient',        5),
  ((SELECT id FROM categories WHERE slug='medicine'), 'path_contains', 'Hospital',       5),
  ((SELECT id FROM categories WHERE slug='medicine'), 'path_contains', 'Pharmacy',       5),
  ((SELECT id FROM categories WHERE slug='medicine'), 'path_contains', 'Health',         5),
  ((SELECT id FROM categories WHERE slug='medicine'), 'filename_pattern', '*prescription*', 15),
  ((SELECT id FROM categories WHERE slug='medicine'), 'filename_pattern', '*diagnosis*',    15),
  ((SELECT id FROM categories WHERE slug='medicine'), 'filename_pattern', '*medical*',      15),
  ((SELECT id FROM categories WHERE slug='medicine'), 'filename_pattern', '*clinical*',     15),
  ((SELECT id FROM categories WHERE slug='medicine'), 'filename_pattern', '*radiology*',    15),
  ((SELECT id FROM categories WHERE slug='medicine'), 'filename_pattern', '*xray*',         15),
  ((SELECT id FROM categories WHERE slug='medicine'), 'filename_pattern', '*lab-result*',   15);

-- More client filename patterns (catch loose files outside project folders)
INSERT OR IGNORE INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*LOC*',         8),
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*banan*',       8),
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*techaqar*',    8),
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*staycity*',    8),
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*yakz*',        8),
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*entiqa*',      8),
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*macsoft*',     8),
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*wessal*',      8),
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*aleen*',       8),
  ((SELECT id FROM categories WHERE slug='clients'), 'filename_pattern', '*inbots*',      8);

-- Project filename patterns
INSERT OR IGNORE INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='projects'), 'filename_pattern', '*clawdbot*',   8),
  ((SELECT id FROM categories WHERE slug='projects'), 'filename_pattern', '*inmind*',     8),
  ((SELECT id FROM categories WHERE slug='projects'), 'filename_pattern', '*inbooks*',    8),
  ((SELECT id FROM categories WHERE slug='projects'), 'filename_pattern', '*megamind*',   8),
  ((SELECT id FROM categories WHERE slug='projects'), 'filename_pattern', '*deskpilot*',  8),
  ((SELECT id FROM categories WHERE slug='projects'), 'filename_pattern', '*infield*',    8);

-- Learning patterns
INSERT OR IGNORE INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='learning'), 'path_contains', 'Tutorial',    5),
  ((SELECT id FROM categories WHERE slug='learning'), 'path_contains', 'Certification', 5),
  ((SELECT id FROM categories WHERE slug='learning'), 'path_contains', 'Workshop',    5),
  ((SELECT id FROM categories WHERE slug='learning'), 'path_contains', 'Lecture',     5),
  ((SELECT id FROM categories WHERE slug='learning'), 'filename_pattern', '*lecture*',   15),
  ((SELECT id FROM categories WHERE slug='learning'), 'filename_pattern', '*tutorial*',  15),
  ((SELECT id FROM categories WHERE slug='learning'), 'filename_pattern', '*course*',    15),
  ((SELECT id FROM categories WHERE slug='learning'), 'filename_pattern', '*assignment*', 15),
  ((SELECT id FROM categories WHERE slug='learning'), 'filename_pattern', '*homework*',  15);

-- Documents — invoices, contracts, receipts
INSERT OR IGNORE INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='documents'), 'filename_pattern', '*invoice*',    15),
  ((SELECT id FROM categories WHERE slug='documents'), 'filename_pattern', '*receipt*',    15),
  ((SELECT id FROM categories WHERE slug='documents'), 'filename_pattern', '*contract*',   15),
  ((SELECT id FROM categories WHERE slug='documents'), 'filename_pattern', '*agreement*',  15),
  ((SELECT id FROM categories WHERE slug='documents'), 'filename_pattern', '*resume*',     15),
  ((SELECT id FROM categories WHERE slug='documents'), 'filename_pattern', '*cv*',         20),
  ((SELECT id FROM categories WHERE slug='documents'), 'filename_pattern', '*certificate*', 15),
  ((SELECT id FROM categories WHERE slug='documents'), 'path_contains', 'Personal',       15),
  ((SELECT id FROM categories WHERE slug='documents'), 'path_contains', 'Finance',        15),
  ((SELECT id FROM categories WHERE slug='documents'), 'path_contains', 'Legal',          15);

-- Design — additional patterns
INSERT OR IGNORE INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='design'), 'path_contains', 'Graphics',    15),
  ((SELECT id FROM categories WHERE slug='design'), 'path_contains', 'Mockup',      15),
  ((SELECT id FROM categories WHERE slug='design'), 'path_contains', 'Wireframe',   15),
  ((SELECT id FROM categories WHERE slug='design'), 'path_contains', 'UI Design',   15),
  ((SELECT id FROM categories WHERE slug='design'), 'path_contains', 'Brand',       15),
  ((SELECT id FROM categories WHERE slug='design'), 'filename_pattern', '*mockup*',   15),
  ((SELECT id FROM categories WHERE slug='design'), 'filename_pattern', '*wireframe*', 15),
  ((SELECT id FROM categories WHERE slug='design'), 'filename_pattern', '*logo*',      15),
  ((SELECT id FROM categories WHERE slug='design'), 'filename_pattern', '*banner*',    15),
  ((SELECT id FROM categories WHERE slug='design'), 'extension', '.canva', 10);

-- Archive — old/completed project patterns
INSERT OR IGNORE INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='archive'), 'path_contains', 'Old',        20),
  ((SELECT id FROM categories WHERE slug='archive'), 'path_contains', 'Backup',     20),
  ((SELECT id FROM categories WHERE slug='archive'), 'path_contains', 'Archive',    15),
  ((SELECT id FROM categories WHERE slug='archive'), 'path_contains', 'Deprecated', 15),
  ((SELECT id FROM categories WHERE slug='archive'), 'filename_pattern', '*backup*',   20),
  ((SELECT id FROM categories WHERE slug='archive'), 'filename_pattern', '*old_*',     20),
  ((SELECT id FROM categories WHERE slug='archive'), 'filename_pattern', '*_old',      20);

-- Media — screenshots pattern for Windows
INSERT OR IGNORE INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='media'), 'filename_pattern', 'Screenshot*',  15),
  ((SELECT id FROM categories WHERE slug='media'), 'filename_pattern', 'Screen Shot*', 15),
  ((SELECT id FROM categories WHERE slug='media'), 'filename_pattern', 'Capture*',     15),
  ((SELECT id FROM categories WHERE slug='media'), 'filename_pattern', 'IMG_*',        25),
  ((SELECT id FROM categories WHERE slug='media'), 'filename_pattern', 'VID_*',        15),
  ((SELECT id FROM categories WHERE slug='media'), 'filename_pattern', 'DSC_*',        25),
  ((SELECT id FROM categories WHERE slug='media'), 'filename_pattern', 'DCIM*',        25),
  ((SELECT id FROM categories WHERE slug='media'), 'path_contains', 'Camera Roll',    15),
  ((SELECT id FROM categories WHERE slug='media'), 'path_contains', 'Photos',         15),
  ((SELECT id FROM categories WHERE slug='media'), 'path_contains', 'Videos',         15),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.heic',     50),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.raw',      50),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.cr2',      50),
  ((SELECT id FROM categories WHERE slug='media'), 'extension', '.nef',      50);

-- Tools — more installer/utility patterns
INSERT OR IGNORE INTO classification_rules (category_id, rule_type, rule_value, priority) VALUES
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.dmg',     30),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.deb',     30),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.appimage', 30),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.bat',     40),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.ps1',     40),
  ((SELECT id FROM categories WHERE slug='tools'), 'extension', '.reg',     40),
  ((SELECT id FROM categories WHERE slug='tools'), 'filename_pattern', '*setup*',     15),
  ((SELECT id FROM categories WHERE slug='tools'), 'filename_pattern', '*install*',   15),
  ((SELECT id FROM categories WHERE slug='tools'), 'filename_pattern', '*portable*',  15),
  ((SELECT id FROM categories WHERE slug='tools'), 'filename_pattern', '*driver*',    15),
  ((SELECT id FROM categories WHERE slug='tools'), 'path_contains', 'Installers',    15),
  ((SELECT id FROM categories WHERE slug='tools'), 'path_contains', 'Utilities',     15);
