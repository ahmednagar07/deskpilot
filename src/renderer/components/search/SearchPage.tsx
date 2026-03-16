import React, { useState, useRef, useEffect, useCallback } from 'react';

interface SearchResult {
  id: number;
  filename: string;
  current_path: string;
  extension: string | null;
  size_bytes: number;
  category_name: string | null;
  category_slug: string | null;
  category_color: string | null;
  category_icon: string | null;
  rank: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  clients: '💼', projects: '💻', medicine: '🏥', design: '🎨',
  learning: '📚', documents: '📄', media: '🖼️', tools: '🔧', archive: '📦',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus input on mount + cleanup debounce timer
  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await window.api.invoke('search:query', q) as SearchResult[];
      setResults(res);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    // Debounce 150ms
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => doSearch(val), 150);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Search</h1>
        <p className="text-muted text-sm mt-1">Find any tracked file instantly by name, path, category, or extension.</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint/50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef} type="text" value={query} onChange={handleChange}
          placeholder="Type to search files..."
          className="w-full pl-12 pr-4 py-3.5 bg-card border border-edge rounded-xl text-foreground placeholder:text-faint/40 text-sm transition-all"
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="v-card overflow-hidden">
          <div className="px-5 py-2.5 border-b border-edge/50">
            <span className="section-label">{results.length} results</span>
          </div>
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            {results.map((result) => (
              <div key={result.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-hover/50 transition-colors border-b border-edge/30 last:border-b-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${result.category_color || '#4E4B6B'}15` }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={result.category_color || '#4E4B6B'} strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground truncate">{result.filename}</span>
                    {result.category_name && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{ backgroundColor: `${result.category_color || '#6B7280'}12`, color: result.category_color || '#6B7280' }}>
                        {result.category_name}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-faint/60 truncate block mt-0.5 font-mono">{result.current_path}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-faint font-mono">{formatBytes(result.size_bytes)}</span>
                  {result.extension && <span className="text-[10px] text-faint/50 block font-mono">{result.extension}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty states */}
      {query && results.length === 0 && !isSearching && (
        <div className="flex flex-col items-center py-20">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-faint/25 mb-4">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <p className="text-muted text-lg">No files found for "<span className="text-accent/70">{query}</span>"</p>
          <p className="text-faint/60 mt-2 text-sm">Try scanning files in the Scanner tab first</p>
        </div>
      )}

      {!query && (
        <div className="flex flex-col items-center py-20">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-accent/25 mb-4">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <p className="text-muted text-lg">Start typing to search your files</p>
          <p className="text-faint/60 mt-2 text-sm">Searches by filename, path, category, and extension</p>
        </div>
      )}
    </div>
  );
}
