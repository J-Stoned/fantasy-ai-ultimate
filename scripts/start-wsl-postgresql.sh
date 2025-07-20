#!/bin/bash
# Start PostgreSQL in WSL

echo "🚀 Starting PostgreSQL in WSL..."
echo "You'll need to enter your WSL password"

# Start PostgreSQL service
sudo service postgresql start

# Check status
if sudo service postgresql status | grep -q "online"; then
    echo "✅ PostgreSQL started successfully!"
    
    # Test connection
    echo "🧪 Testing connection..."
    sudo -u postgres psql -c "SELECT version();" 2>/dev/null && echo "✅ Database is accessible"
    
    # Check our database
    sudo -u postgres psql -c "\l" | grep fantasy_ai_local && echo "✅ fantasy_ai_local database exists"
else
    echo "❌ PostgreSQL failed to start"
    echo "Try: sudo service postgresql restart"
fi