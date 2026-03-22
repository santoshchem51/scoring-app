#!/usr/bin/env bash
# Tests for pii-scrubber.sh
set +e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRUBBER="$SCRIPT_DIR/pii-scrubber.sh"
PASS=0
FAIL=0

assert_contains() {
  local label="$1" input="$2" expected="$3"
  local output
  output=$(echo "$input" | bash "$SCRUBBER" 2>/dev/null)
  if echo "$output" | grep -q "$expected"; then
    echo "  PASS: $label"
    ((PASS++))
  else
    echo "  FAIL: $label"
    echo "    Expected to contain: $expected"
    echo "    Got: $output"
    ((FAIL++))
  fi
}

assert_not_contains() {
  local label="$1" input="$2" unexpected="$3"
  local output
  output=$(echo "$input" | bash "$SCRUBBER" 2>/dev/null)
  if echo "$output" | grep -q "$unexpected"; then
    echo "  FAIL: $label"
    echo "    Should NOT contain: $unexpected"
    echo "    Got: $output"
    ((FAIL++))
  else
    echo "  PASS: $label"
    ((PASS++))
  fi
}

echo "PII Scrubber Tests"
echo "=================="

echo ""
echo "1. User context stripping"
assert_not_contains "strips user object" \
  '{"user":{"id":"abc","ip_address":"1.2.3.4","email":"test@example.com"},"message":"test"}' \
  '"user"'

echo ""
echo "2. Extra/context/request stripping"
assert_not_contains "strips extra" \
  '{"extra":{"uid":"secret123"},"message":"test"}' \
  '"extra"'
assert_not_contains "strips contexts" \
  '{"contexts":{"browser":{"name":"Chrome"}},"message":"test"}' \
  '"contexts"'
assert_not_contains "strips request" \
  '{"request":{"url":"https://app.com","headers":{"Cookie":"session=abc"}},"message":"test"}' \
  '"request"'

echo ""
echo "3. Email scrubbing"
assert_not_contains "scrubs email from message" \
  '{"message":"Error for user@example.com"}' \
  'user@example.com'
assert_contains "replaces email with placeholder" \
  '{"message":"Error for user@example.com"}' \
  '{email}'

echo ""
echo "4. UID/path scrubbing"
assert_not_contains "scrubs users/uid path" \
  '{"message":"No doc at users/abc123def456"}' \
  'users/abc123def456'
assert_contains "replaces with users/{uid}" \
  '{"message":"No doc at users/abc123def456"}' \
  'users/{uid}'

echo ""
echo "5. Firestore path scrubbing"
assert_not_contains "scrubs /documents/ paths" \
  '{"message":"Permission denied for /documents/games/abc123/players/def456"}' \
  '/documents/games/abc123'
assert_contains "replaces with /documents/{path}" \
  '{"message":"Permission denied for /documents/games/abc123/players/def456"}' \
  '/documents/{path}'

echo ""
echo "6. Stack frame variable stripping"
assert_not_contains "strips vars from frames" \
  '{"entries":[{"type":"exception","data":{"values":[{"value":"test","stacktrace":{"frames":[{"filename":"app.js","lineNo":10,"function":"main","vars":{"secret":"password123"}}]}}]}}]}' \
  '"vars"'
assert_contains "keeps filename" \
  '{"entries":[{"type":"exception","data":{"values":[{"value":"test","stacktrace":{"frames":[{"filename":"app.js","lineNo":10,"function":"main","vars":{"secret":"password123"}}]}}]}}]}' \
  '"filename"'

echo ""
echo "7. Breadcrumb data stripping"
assert_not_contains "strips breadcrumb data payload" \
  '{"entries":[{"type":"breadcrumbs","data":{"values":[{"category":"fetch","timestamp":"2026-03-22","message":"GET /api","data":{"url":"https://secret.com","headers":{"Authorization":"Bearer token"}}}]}}]}' \
  'Authorization'
assert_contains "keeps breadcrumb category" \
  '{"entries":[{"type":"breadcrumbs","data":{"values":[{"category":"fetch","timestamp":"2026-03-22","message":"GET /api","data":{"url":"secret"}}]}}]}' \
  '"category"'

echo ""
echo "8. Non-PII preservation"
assert_contains "keeps error type" \
  '{"message":"TypeError: Cannot read property of null"}' \
  'TypeError'

echo ""
echo "9. JWT scrubbing"
assert_not_contains "scrubs JWT-like tokens" \
  '{"message":"Token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0"}' \
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9'

echo ""
echo "=================="
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
