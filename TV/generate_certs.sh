#!/bin/bash

# This script generates a self-signed SSL certificate and private key
# for use with the Raspberry Pi Touch Server.
# These certificates are suitable for local development and testing.
# For production environments, you should obtain certificates from a trusted Certificate Authority (CA).

# Define paths for certificates
CERT_DIR="./certs"
CERT_FILE="$CERT_DIR/cert.pem"
KEY_FILE="$CERT_DIR/key.pem"

# Create the certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Generate a new private key (2048-bit RSA)
echo "Generating private key: $KEY_FILE"
openssl genrsa -out "$KEY_FILE" 2048

# Generate a self-signed certificate using the private key
# -x509: output a self-signed certificate instead of a certificate request
# -nodes: don't encrypt the private key
# -days 365: certificate is valid for 365 days
# -new: generate a new certificate request
# -key: specify the private key to use
# -out: specify the output file for the certificate
# -subj: set the subject/distinguished name (CN=Common Name, which is your hostname)
echo "Generating self-signed certificate: $CERT_FILE"
openssl req -x509 -nodes -days 365 -new -key "$KEY_FILE" -out "$CERT_FILE" -subj "/CN=raspberrypi"

echo "Certificates generated successfully!"
echo "Private Key: $KEY_FILE"
echo "Certificate: $CERT_FILE"
echo ""
echo "NOTE: These are self-signed certificates and will cause browser warnings."
echo "They are suitable for testing and local network use, but not for public-facing production."
