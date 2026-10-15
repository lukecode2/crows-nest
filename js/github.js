import { REPO } from './config.js';
const root = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}`;
export function b64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}
export function b64DecodeUtf8(b64) {
  return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), char => char.charCodeAt(0)));
}
async function request(url, token, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (!res.ok) {
      const error = new Error(`GitHub request failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return res;
  } finally { clearTimeout(timeout); }
}
const fileUrl = path => `${root}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${REPO.branch}`;
export async function getFile(path, token) {
  try {
    const res = await request(fileUrl(path), token);
    const data = await res.json();
    return { json: JSON.parse(b64DecodeUtf8(data.content)), sha: data.sha };
  } catch (error) { if (error.status === 404) return null; throw error; }
}
export async function putFile(path, json, sha, token, message) {
  const res = await request(fileUrl(path), token, { method: 'PUT', body: JSON.stringify({ message, branch: REPO.branch, content: b64EncodeUtf8(JSON.stringify(json, null, 2) + '\n'), ...(sha ? { sha } : {}) }) });
  return (await res.json()).content.sha;
}
export async function dispatchFeed(token) {
  await request(`${root}/actions/workflows/${REPO.workflow}/dispatches`, token, { method: 'POST', body: JSON.stringify({ ref: REPO.branch }) });
}
