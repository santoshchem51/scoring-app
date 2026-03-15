// functions/src/index.ts — entry point for Cloud Functions
// initializeApp MUST be called here (not in individual function files)
// to avoid crashes on second function import.
import { getApps, initializeApp } from 'firebase-admin/app';

if (getApps().length === 0) initializeApp();

// Cloud Functions entry point
export { processMatchCompletion } from './callable/processMatchCompletion';
