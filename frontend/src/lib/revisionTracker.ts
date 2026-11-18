import { RevisionState } from '@/data/quick-references/types';
export type { RevisionState };

const STORAGE_KEY = 'skillvault_quickref_revision_state_v1';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export const DEFAULT_REVISION_STATE: RevisionState = {
  revisedTopicIds: [],
  bookmarkedTopicIds: [],
  lastRevisedTimestamps: {}
};

export function loadRevisionState(): RevisionState {
  if (typeof window === 'undefined') return DEFAULT_REVISION_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REVISION_STATE;
    const parsed = JSON.parse(raw);
    return {
      revisedTopicIds: Array.isArray(parsed.revisedTopicIds) ? parsed.revisedTopicIds : [],
      bookmarkedTopicIds: Array.isArray(parsed.bookmarkedTopicIds) ? parsed.bookmarkedTopicIds : [],
      lastRevisedTimestamps: parsed.lastRevisedTimestamps && typeof parsed.lastRevisedTimestamps === 'object' 
        ? parsed.lastRevisedTimestamps 
        : {}
    };
  } catch (e) {
    console.error('Failed to load quick references revision state', e);
    return DEFAULT_REVISION_STATE;
  }
}

export function saveRevisionState(state: RevisionState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save quick references revision state', e);
  }
}

export function isRevisedToday(timestamp?: number): boolean {
  if (!timestamp) return false;
  const target = new Date(timestamp);
  const now = new Date();
  return (
    target.getDate() === now.getDate() &&
    target.getMonth() === now.getMonth() &&
    target.getFullYear() === now.getFullYear()
  );
}

export function needsRevision(timestamp?: number): boolean {
  if (!timestamp) return true; // Never revised
  return Date.now() - timestamp > THREE_DAYS_MS; // > 3 days old
}

export function formatLastRevised(timestamp?: number): {
  text: string;
  status: 'today' | 'recent' | 'overdue' | 'never';
} {
  if (!timestamp) {
    return { text: 'Never revised', status: 'never' };
  }
  const diffMs = Date.now() - timestamp;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (isRevisedToday(timestamp)) {
    return { text: 'Revised today', status: 'today' };
  }
  if (diffHours < 24) {
    return { text: 'Revised yesterday', status: 'recent' };
  }
  if (diffDays <= 3) {
    return { text: `Revised ${diffDays}d ago`, status: 'recent' };
  }
  return { text: `Needs revision (${diffDays}d ago)`, status: 'overdue' };
}
