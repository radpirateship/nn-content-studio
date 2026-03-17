import { rmSync } from 'fs';
try {
  rmSync('/vercel/share/v0-project/.next', { recursive: true, force: true });
  console.log('Cleared .next cache');
} catch (e) {
  console.log('No .next cache to clear');
}
