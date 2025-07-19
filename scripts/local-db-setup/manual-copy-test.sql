-- Test SQL file to create a simple table
CREATE TABLE IF NOT EXISTS test_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO test_table (name) VALUES 
    ('Test 1'),
    ('Test 2'),
    ('Test 3');

SELECT * FROM test_table;