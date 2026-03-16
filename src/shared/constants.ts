export const APP_NAME = 'DeskPilot';
export const APP_VERSION = '0.1.0';

export const DEFAULT_SEARCH_HOTKEY = 'CommandOrControl+Space';

export const CATEGORY_SLUGS = {
  CLIENTS: 'clients',
  PROJECTS: 'projects',
  MEDICINE: 'medicine',
  DESIGN: 'design',
  LEARNING: 'learning',
  DOCUMENTS: 'documents',
  MEDIA: 'media',
  TOOLS: 'tools',
  ARCHIVE: 'archive',
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  clients: '#3B82F6',
  projects: '#8B5CF6',
  medicine: '#EF4444',
  design: '#F59E0B',
  learning: '#10B981',
  documents: '#6B7280',
  media: '#EC4899',
  tools: '#14B8A6',
  archive: '#9CA3AF',
};
