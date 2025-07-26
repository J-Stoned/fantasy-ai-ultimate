#!/bin/bash

# Generate SSL certificates for PostgreSQL production setup
# This creates self-signed certificates for secure database connections

echo "🔐 Generating SSL certificates for PostgreSQL..."

# Generate CA private key
openssl genrsa -out ca-key.pem 4096

# Generate CA certificate
openssl req -new -x509 -key ca-key.pem -out ca.crt -days 365 -subj "/CN=Fantasy-AI-CA"

# Generate server private key
openssl genrsa -out server-key.pem 4096

# Generate server certificate signing request
openssl req -new -key server-key.pem -out server.csr -subj "/CN=fantasy-postgres"

# Generate server certificate signed by CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca-key.pem -CAcreateserial -out server.crt -days 365

# Generate client private key
openssl genrsa -out client-key.pem 4096

# Generate client certificate signing request
openssl req -new -key client-key.pem -out client.csr -subj "/CN=fantasy_user"

# Generate client certificate signed by CA
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca-key.pem -CAcreateserial -out client.crt -days 365

# Set proper permissions for PostgreSQL
chmod 600 server-key.pem client-key.pem ca-key.pem
chmod 644 server.crt client.crt ca.crt

# Create symbolic links with expected names
ln -sf server.crt server.crt
ln -sf server-key.pem server.key
ln -sf ca.crt ca.crt

echo "✅ SSL certificates generated successfully!"
echo "   - CA Certificate: ca.crt"
echo "   - Server Certificate: server.crt"
echo "   - Server Key: server.key"
echo "   - Client Certificate: client.crt"
echo "   - Client Key: client-key.pem"

echo ""
echo "🚀 Ready for production PostgreSQL deployment with SSL!"