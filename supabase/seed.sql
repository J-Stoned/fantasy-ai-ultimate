-- Seed data for initial setup

-- Insert sports
INSERT INTO sports (id, name, sport_type, description) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Football', 'football', 'American Football'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Basketball', 'basketball', 'Basketball'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Baseball', 'baseball', 'Baseball'),
  ('550e8400-e29b-41d4-a716-446655440004', 'Hockey', 'hockey', 'Ice Hockey'),
  ('550e8400-e29b-41d4-a716-446655440005', 'Soccer', 'soccer', 'Association Football');

-- Insert leagues
INSERT INTO leagues (id, sport_id, name, abbreviation, level, country) VALUES 
  -- Professional Football
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'National Football League', 'NFL', 'professional', 'USA'),
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'NCAA Division I Football', 'NCAA D1', 'college', 'USA'),
  
  -- Professional Basketball
  ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'National Basketball Association', 'NBA', 'professional', 'USA'),
  ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'NCAA Division I Basketball', 'NCAA D1', 'college', 'USA'),
  
  -- Professional Baseball
  ('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'Major League Baseball', 'MLB', 'professional', 'USA'),
  
  -- Professional Hockey
  ('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440004', 'National Hockey League', 'NHL', 'professional', 'USA/Canada'),
  
  -- Soccer
  ('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440005', 'Premier League', 'EPL', 'professional', 'England'),
  ('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005', 'Major League Soccer', 'MLS', 'professional', 'USA/Canada');

-- Insert some example teams
INSERT INTO teams_master (id, league_id, name, city, abbreviation) VALUES
  -- NFL Teams
  ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Patriots', 'New England', 'NE'),
  ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'Cowboys', 'Dallas', 'DAL'),
  
  -- NBA Teams  
  ('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', 'Lakers', 'Los Angeles', 'LAL'),
  ('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440003', 'Celtics', 'Boston', 'BOS');