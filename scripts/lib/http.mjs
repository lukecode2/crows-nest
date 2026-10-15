export const USER_AGENT = 'CrowsNestJobBot/1.0 (personal job search; github.com/lukecode2/crows-nest)';
async function request(url, options, json) {
  const { headers = {}, timeoutMs = 15000, retries = 1, method = 'GET', body, signal } = options;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error(`HTTP timeout after ${timeoutMs}ms`)), timeoutMs);
    try {
      const requestHeaders = new Headers({ 'User-Agent': USER_AGENT, Accept: json ? 'application/json' : 'text/html,text/plain;q=0.9' });
      new Headers(headers).forEach((v, k) => requestHeaders.set(k, v));
      const response = await fetch(url, { headers: requestHeaders, method, body, signal: controller.signal });
      if (!response.ok) { const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160); const error = new Error(`HTTP ${response.status} from ${new URL(url).hostname}${detail ? `: ${detail}` : ''}`); error.status = response.status; throw error; }
      return json ? await response.json() : await response.text();
    } catch (error) {
      if (signal?.aborted || attempt >= retries) throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
}
export function getJson(url, options = {}) { return request(url, options, true); }
export function getText(url, options = {}) { return request(url, options, false); }
