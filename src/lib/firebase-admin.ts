import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../../firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
  projectId?: string;
};

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT,
  });
}

export const adminAuth = getAuth();
