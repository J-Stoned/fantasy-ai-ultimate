-- Drop the problematic unique constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_firstname_lastname_sport_id_key;

-- Clear existing players to start fresh
TRUNCATE TABLE players CASCADE;

-- Add some sample players directly
INSERT INTO players (firstName, lastName, position, team_id, jersey_number, sport_id, status) VALUES
-- Chiefs players
('Patrick', 'Mahomes', ARRAY['QB'], (SELECT id FROM teams WHERE name = 'Kansas City Chiefs'), 15, 'nfl', 'active'),
('Travis', 'Kelce', ARRAY['TE'], (SELECT id FROM teams WHERE name = 'Kansas City Chiefs'), 87, 'nfl', 'active'),
('Chris', 'Jones', ARRAY['DL'], (SELECT id FROM teams WHERE name = 'Kansas City Chiefs'), 95, 'nfl', 'active'),
('Isiah', 'Pacheco', ARRAY['RB'], (SELECT id FROM teams WHERE name = 'Kansas City Chiefs'), 10, 'nfl', 'active'),

-- Bills players  
('Josh', 'Allen', ARRAY['QB'], (SELECT id FROM teams WHERE name = 'Buffalo Bills'), 17, 'nfl', 'active'),
('Stefon', 'Diggs', ARRAY['WR'], (SELECT id FROM teams WHERE name = 'Buffalo Bills'), 14, 'nfl', 'active'),
('James', 'Cook', ARRAY['RB'], (SELECT id FROM teams WHERE name = 'Buffalo Bills'), 4, 'nfl', 'active'),

-- Eagles players
('Jalen', 'Hurts', ARRAY['QB'], (SELECT id FROM teams WHERE name = 'Philadelphia Eagles'), 1, 'nfl', 'active'),
('A.J.', 'Brown', ARRAY['WR'], (SELECT id FROM teams WHERE name = 'Philadelphia Eagles'), 11, 'nfl', 'active'),
('Dallas', 'Goedert', ARRAY['TE'], (SELECT id FROM teams WHERE name = 'Philadelphia Eagles'), 88, 'nfl', 'active'),

-- Cowboys players
('Dak', 'Prescott', ARRAY['QB'], (SELECT id FROM teams WHERE name = 'Dallas Cowboys'), 4, 'nfl', 'active'),
('CeeDee', 'Lamb', ARRAY['WR'], (SELECT id FROM teams WHERE name = 'Dallas Cowboys'), 88, 'nfl', 'active'),
('Micah', 'Parsons', ARRAY['LB'], (SELECT id FROM teams WHERE name = 'Dallas Cowboys'), 11, 'nfl', 'active'),

-- 49ers players
('Brock', 'Purdy', ARRAY['QB'], (SELECT id FROM teams WHERE name = 'San Francisco 49ers'), 13, 'nfl', 'active'),
('Christian', 'McCaffrey', ARRAY['RB'], (SELECT id FROM teams WHERE name = 'San Francisco 49ers'), 23, 'nfl', 'active'),
('George', 'Kittle', ARRAY['TE'], (SELECT id FROM teams WHERE name = 'San Francisco 49ers'), 85, 'nfl', 'active'),
('Nick', 'Bosa', ARRAY['DL'], (SELECT id FROM teams WHERE name = 'San Francisco 49ers'), 97, 'nfl', 'active'),

-- Dolphins players
('Tua', 'Tagovailoa', ARRAY['QB'], (SELECT id FROM teams WHERE name = 'Miami Dolphins'), 1, 'nfl', 'active'),
('Tyreek', 'Hill', ARRAY['WR'], (SELECT id FROM teams WHERE name = 'Miami Dolphins'), 10, 'nfl', 'active'),
('Jaylen', 'Waddle', ARRAY['WR'], (SELECT id FROM teams WHERE name = 'Miami Dolphins'), 17, 'nfl', 'active'),

-- Ravens players
('Lamar', 'Jackson', ARRAY['QB'], (SELECT id FROM teams WHERE name = 'Baltimore Ravens'), 8, 'nfl', 'active'),
('Mark', 'Andrews', ARRAY['TE'], (SELECT id FROM teams WHERE name = 'Baltimore Ravens'), 89, 'nfl', 'active'),
('Roquan', 'Smith', ARRAY['LB'], (SELECT id FROM teams WHERE name = 'Baltimore Ravens'), 0, 'nfl', 'active');

-- Count results
SELECT 'Loaded ' || COUNT(*) || ' star NFL players!' as message FROM players;