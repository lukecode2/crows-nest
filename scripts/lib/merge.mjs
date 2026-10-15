export function mergeFeed(prev, incoming, nowIso) {
  const prior = new Map(prev.map(job => [job.id, job]));
  const merged = new Map(prior);
  for (const job of incoming) merged.set(job.id, { ...job, firstSeenAt: prior.get(job.id)?.firstSeenAt || job.firstSeenAt || nowIso });
  const cutoff = Date.parse(nowIso) - 30 * 86400000;
  return [...merged.values()].filter(job => Date.parse(job.firstSeenAt) >= cutoff)
    .sort((a, b) => b.score - a.score || Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt)).slice(0, 600);
}
