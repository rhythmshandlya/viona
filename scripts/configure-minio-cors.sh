#!/bin/bash
# Configure MinIO CORS for presigned URL access from the browser.
# Run once per environment (local dev, staging, production).
#
# Prerequisites: mc (MinIO client) installed and alias configured
# Usage: MINIO_ALIAS=local BUCKET_NAME=viona bash scripts/configure-minio-cors.sh

set -euo pipefail

MINIO_ALIAS="${MINIO_ALIAS:-local}"
BUCKET="${BUCKET_NAME:-viona}"

cat > /tmp/minio-cors.json << 'CORS_EOF'
{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:4000", "https://*.up.railway.app"],
    "AllowedMethods": ["GET", "HEAD", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges", "ETag", "Content-Type"],
    "MaxAgeSeconds": 86400
  }]
}
CORS_EOF

echo "Applying CORS configuration to ${MINIO_ALIAS}/${BUCKET}..."
mc anonymous set-json /tmp/minio-cors.json "${MINIO_ALIAS}/${BUCKET}"
rm -f /tmp/minio-cors.json
echo "CORS configured successfully for ${MINIO_ALIAS}/${BUCKET}"
echo ""
echo "To verify, curl a presigned URL with an Origin header:"
echo "  curl -I -H 'Origin: http://localhost:3000' '<presigned-url>'"
echo "  # Should include: Access-Control-Allow-Origin: http://localhost:3000"
