import { getStore } from '@netlify/blobs';
import { createGameHandler } from '../../server/game';

// Netlify supplies Blobs credentials in the function context automatically.
// This is intentionally the only file in the functions source directory.
export default async function game(request: Request): Promise<Response> {
  const store = getStore({ name: 'mind-ladder-rooms', consistency: 'strong' });
  return createGameHandler(store)(request);
}
