@echo off
echo =====================================================
echo     WINDOWS NATIVE DATA COPY
echo =====================================================
echo.
echo This will copy your Supabase data using Windows commands
echo.
pause

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

echo.
echo Installing required packages if needed...
call npm install pg @supabase/supabase-js chalk dotenv

echo.
echo Creating Windows-compatible copy script...

echo const { createClient } = require('@supabase/supabase-js'); > temp-copy.js
echo const { Client } = require('pg'); >> temp-copy.js
echo require('dotenv').config({ path: '.env.local' }); >> temp-copy.js
echo. >> temp-copy.js
echo const supabase = createClient( >> temp-copy.js
echo   process.env.NEXT_PUBLIC_SUPABASE_URL, >> temp-copy.js
echo   process.env.SUPABASE_SERVICE_ROLE_KEY >> temp-copy.js
echo ); >> temp-copy.js
echo. >> temp-copy.js
echo const pgClient = new Client({ >> temp-copy.js
echo   host: 'localhost', >> temp-copy.js
echo   port: 5432, >> temp-copy.js
echo   database: 'fantasy_ai_local', >> temp-copy.js
echo   user: 'postgres', >> temp-copy.js
echo   password: 'postgres' >> temp-copy.js
echo }); >> temp-copy.js
echo. >> temp-copy.js
echo async function copyData() { >> temp-copy.js
echo   try { >> temp-copy.js
echo     await pgClient.connect(); >> temp-copy.js
echo     console.log('Connected to PostgreSQL!'); >> temp-copy.js
echo. >> temp-copy.js
echo     const tables = ['sports', 'teams', 'players', 'games']; >> temp-copy.js
echo     for (const table of tables) { >> temp-copy.js
echo       console.log(`Copying ${table}...`); >> temp-copy.js
echo       const { data } = await supabase.from(table).select('*').limit(100); >> temp-copy.js
echo       console.log(`Got ${data?.length || 0} rows from ${table}`); >> temp-copy.js
echo     } >> temp-copy.js
echo. >> temp-copy.js
echo     console.log('Test complete!'); >> temp-copy.js
echo   } catch (err) { >> temp-copy.js
echo     console.error('Error:', err.message); >> temp-copy.js
echo   } finally { >> temp-copy.js
echo     await pgClient.end(); >> temp-copy.js
echo   } >> temp-copy.js
echo } >> temp-copy.js
echo. >> temp-copy.js
echo copyData(); >> temp-copy.js

echo.
echo Running test copy...
node temp-copy.js

del temp-copy.js

echo.
pause