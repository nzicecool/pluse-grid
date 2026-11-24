import { LeaderboardEntry } from '../types/game';

const STORAGE_KEY = 'pulse_grid_3d_leaderboard_v1';
const MAX_ENTRIES = 12;

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is LeaderboardEntry =>
          item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.score === 'number' &&
          typeof item.wave === 'number',
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveLeaderboardEntry(
  entry: Omit<LeaderboardEntry, 'id' | 'dateIso'>,
): LeaderboardEntry[] {
  const cleanName = entry.name.trim().slice(0, 14) || 'ATHLETE';
  const next: LeaderboardEntry = {
    ...entry,
    name: cleanName.toUpperCase(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dateIso: new Date().toISOString(),
  };

  const current = loadLeaderboard();
  const updated = [...current, next]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.avgReactionMs - b.avgReactionMs;
    })
    .slice(0, MAX_ENTRIES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors cleanly
  }

  return updated;
}

export function getPersonalBest(): number {
  const list = loadLeaderboard();
  return list.length > 0 ? list[0].score : 0;
}

export function clearLeaderboard(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
