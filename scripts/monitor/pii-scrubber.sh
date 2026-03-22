#!/usr/bin/env bash
# Scrubs PII from Sentry event JSON for safe inclusion in GitHub issues.
# Usage: cat event.json | bash pii-scrubber.sh
#
# SECURITY: This script is a PII firewall between Sentry data and GitHub issues.
# When in doubt, strip it. Under-reporting is safer than leaking PII.

TMPFILE=$(mktemp)
cat > "$TMPFILE"

node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));

// Strip sensitive top-level fields
delete event.user;
delete event.extra;
delete event.contexts;
delete event.sdk;
delete event.request;

// Scrub message field
if (event.message) {
  event.message = scrubText(event.message);
}

// Process entries
if (event.entries) {
  for (const entry of event.entries) {
    if (entry.type === 'breadcrumbs' && entry.data?.values) {
      entry.data.values = entry.data.values.map(b => ({
        category: b.category,
        timestamp: b.timestamp,
        message: b.message ? scrubText(b.message) : undefined,
        level: b.level,
      }));
    }
    if (entry.type === 'exception' && entry.data?.values) {
      for (const ex of entry.data.values) {
        if (ex.value) ex.value = scrubText(ex.value);
        if (ex.stacktrace?.frames) {
          ex.stacktrace.frames = ex.stacktrace.frames.map(f => ({
            filename: f.filename,
            absPath: f.absPath,
            lineNo: f.lineNo,
            colNo: f.colNo,
            function: f.function,
            inApp: f.inApp,
          }));
        }
      }
    }
  }
}

function scrubText(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '{email}')
    .replace(/eyJ[a-zA-Z0-9_-]+\.?[a-zA-Z0-9_-]*/g, '{jwt}')
    .replace(/\/documents\/[^\s\"]+/g, '/documents/{path}')
    .replace(/users\/[a-zA-Z0-9]+/g, 'users/{uid}')
    .replace(/\b[a-zA-Z0-9]{28}\b/g, '{uid}')
    .substring(0, 500);
}

console.log(JSON.stringify(event, null, 2));
" "$TMPFILE"

rm -f "$TMPFILE"
