#!/bin/bash

BASE_URL="http://localhost:5000/api"
SUPERADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZmJiZjE1ZjUwMzIwNWQxNDAwY2ViZSIsImlhdCI6MTc2MTMyODk3OSwiZXhwIjoxNzYxOTMzNzc5fQ.PGxmr4rWRv1HBhrYLsdqO4ZVT099KIBj4pVvbVUkcAc

"

echo "🚀 Starting full API test..."

# =============================
# 1️⃣ Register participant
# =============================
echo "🧍 Registering normal participant..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"123456"}' \
  | jq .

# =============================
# 2️⃣ Register admin (request approval)
# =============================
echo "🧑‍💼 Registering admin (pending approval)..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Admin","email":"admin@example.com","password":"123456","role":"admin"}' \
  | jq .

# =============================
# 3️⃣ Superadmin views all requests
# =============================
echo "👁️ Viewing admin requests..."
curl -s -X GET "$BASE_URL/admin-requests" \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  | jq .

# ⚠️ NOTE: Copy an ID from the above output (e.g. ADMIN_REQUEST_ID)
ADMIN_REQUEST_ID="PASTE_REQUEST_ID_HERE"

# =============================
# 4️⃣ Superadmin approves the admin
# =============================
echo "✅ Approving admin request..."
curl -s -X PUT "$BASE_URL/admin-requests/$ADMIN_REQUEST_ID/approve" \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reviewNotes":"Welcome to the team!"}' \
  | jq .

# =============================
# 5️⃣ Login as approved admin
# =============================
echo "🔑 Logging in as approved admin..."
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"123456"}' | jq -r '.token')

echo "Admin token: $ADMIN_TOKEN"

# =============================
# 6️⃣ Participant attendance scan
# =============================
echo "📸 Admin scanning participant QR..."
curl -s -X POST "$BASE_URL/attendance/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"participantId":"68fbc134f503205d1400cecd","notes":"On time arrival"}' \
  | jq .

# =============================
# 7️⃣ Superadmin checks stats
# =============================
echo "📊 Checking request stats..."
curl -s -X GET "$BASE_URL/admin-requests/stats" \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  | jq .

echo "✅ All tests complete!"
