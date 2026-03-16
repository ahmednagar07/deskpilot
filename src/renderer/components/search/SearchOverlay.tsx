import React, { useState, useEffect, useRef, useCallback } from 'react';

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFileIcon(extension: string | null): string {
  if (!extension) return '\u{1F4C4}';
  const ext = extension.toLowerCase().replace('.', '');
  const iconMap: Record<string, string> = {
    pdf: '\u{1F4D5}', doc: '\u{1F4DD}', docx: '\u{1F4DD}', txt: '\u{1F4C3}',
    xls: '\u{1F4CA}', xlsx: '\u{1F4CA}', csv: '\u{1F4CA}',
    ppt: '\u{1F4CA}', pptx: '\u{1F4CA}',
    jpg: '\u{1F5BC}', jpeg: '\u{1F5BC}', png: '\u{1F5BC}', gif: '\u{1F5BC}', svg: '\u{1F5BC}', webp: '\u{1F5BC}',
    mp4: '\u{1F3AC}', avi: '\u{1F3AC}', mkv: '\u{1F3AC}', mov: '\u{1F3AC}',
    mp3: '\u{1F3B5}', wav: '\u{1F3B5}', flac: '\u{1F3B5}', ogg: '\u{1F3B5}',
    zip: '\u{1F4E6}', rar: '\u{1F4E6}', '7z': '\u{1F4E6}', tar: '\u{1F4E6}', gz: '\u{1F4E6}',
    js: '\u{1F4DC}', ts: '\u{1F4DC}', tsx: '\u{1F4DC}', jsx: '\u{1F4DC}',
    py: '\u{1F40D}', rs: '\u{2699}', go: '\u{2699}',
    html: '\u{1F310}', css: '\u{1F3A8}', json: '\u{1F4CB}',
    exe: '\u{2699}', msi: '\u{2699}', dmg: '\u{2699}',
    iso: '\u{1F4BF}',
  };
  return iconMap[ext] || '\u{1F4C4}';
}

function extractDirectory(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep > 0 ? filePath.substring(0, lastSep) : filePath;
}

export default function SearchOverlay() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Autofocus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Resize window based on result count
  const resizeWindow = useCallback((count: number) => {
    try {
      window.api.invoke('search:resize', count);
    } catch {
      // Ignore if not in Electron
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      resizeWindow(0);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await window.api.invoke('search:query', query) as SearchResult[];
        const limited = res.slice(0, 8);
        setResults(limited);
        setSelectedIndex(0);
        resizeWindow(limited.length);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
        resizeWindow(0);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, resizeWindow]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.children[selectedIndex] as HTMLElement | undefined;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const closeOverlay = useCallback(() => {
    try {
      window.api.invoke('window:close');
    } catch {
      // Ignore
    }
  }, []);

  const openFile = useCallback((filePath: string) => {
    window.api.invoke('shell:open-file', filePath);
    closeOverlay();
  }, [closeOverlay]);

  const openFolder = useCallback((filePath: string) => {
    window.api.invoke('shell:open-folder', filePath);
    closeOverlay();
  }, [closeOverlay]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          if (e.ctrlKey) {
            openFolder(results[selectedIndex].current_path);
          } else {
            openFile(results[selectedIndex].current_path);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeOverlay();
        break;
    }
  }, [results, selectedIndex, openFile, openFolder, closeOverlay]);

  return (
    <div
      className="w-full select-none"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      onKeyDown={handleKeyDown}
    >
      {/* Search input container */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10, 10, 20, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(124, 92, 252, 0.2)',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6), 0 0 80px rgba(124, 92, 252, 0.08)',
        }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-5 py-4">
          {/* Search icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7C5CFC"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 opacity-70"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            autoFocus
            className="flex-1 bg-transparent outline-none text-lg"
            style={{
              color: '#E8E6F0',
              fontFamily: "'Sora', sans-serif",
              fontWeight: 500,
              caretColor: '#7C5CFC',
            }}
          />

          {/* Loading spinner or shortcut hint */}
          {isLoading ? (
            <div
              className="w-5 h-5 rounded-full border-2 animate-spin shrink-0"
              style={{
                borderColor: 'rgba(124, 92, 252, 0.2)',
                borderTopColor: '#7C5CFC',
              }}
            />
          ) : (
            <span
              className="text-xs shrink-0 px-1.5 py-0.5 rounded"
              style={{
                color: '#4E4B6B',
                fontFamily: "'JetBrains Mono', monospace",
                background: 'rgba(78, 75, 107, 0.15)',
              }}
            >
              ESC
            </span>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <>
            <div
              className="mx-4"
              style={{ height: '1px', background: 'rgba(30, 30, 58, 0.8)' }}
            />
            <div ref={resultsRef} className="py-2 max-h-[384px] overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={result.id}
                  className="flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors duration-75"
                  style={{
                    background: index === selectedIndex
                      ? 'rgba(124, 92, 252, 0.12)'
                      : 'transparent',
                  }}
                  onClick={() => openFile(result.current_path)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openFolder(result.current_path);
                  }}
                >
                  {/* File icon */}
                  <span className="text-lg shrink-0 w-7 text-center">
                    {getFileIcon(result.extension)}
                  </span>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold truncate"
                        style={{ color: '#E8E6F0', fontSize: '14px' }}
                      >
                        {result.filename}
                      </span>
                      {result.category_name && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium uppercase tracking-wider"
                          style={{
                            color: result.category_color || '#4E4B6B',
                            background: `${result.category_color || '#4E4B6B'}18`,
                            border: `1px solid ${result.category_color || '#4E4B6B'}30`,
                          }}
                        >
                          {result.category_name}
                        </span>
                      )}
                    </div>
                    <div
                      className="truncate mt-0.5"
                      style={{
                        color: '#4E4B6B',
                        fontSize: '12px',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {extractDirectory(result.current_path)}
                    </div>
                  </div>

                  {/* File size */}
                  <span
                    className="text-xs shrink-0"
                    style={{
                      color: '#4E4B6B',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {formatFileSize(result.size_bytes)}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer hints */}
            <div
              className="px-5 py-2 flex items-center gap-4"
              style={{
                borderTop: '1px solid rgba(30, 30, 58, 0.8)',
              }}
            >
              <span className="flex items-center gap-1.5" style={{ color: '#4E4B6B', fontSize: '11px' }}>
                <kbd
                  className="px-1 py-0.5 rounded text-[10px]"
                  style={{
                    background: 'rgba(78, 75, 107, 0.15)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  &uarr;&darr;
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5" style={{ color: '#4E4B6B', fontSize: '11px' }}>
                <kbd
                  className="px-1 py-0.5 rounded text-[10px]"
                  style={{
                    background: 'rgba(78, 75, 107, 0.15)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Enter
                </kbd>
                open
              </span>
              <span className="flex items-center gap-1.5" style={{ color: '#4E4B6B', fontSize: '11px' }}>
                <kbd
                  className="px-1 py-0.5 rounded text-[10px]"
                  style={{
                    background: 'rgba(78, 75, 107, 0.15)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Ctrl+Enter
                </kbd>
                open folder
              </span>
            </div>
          </>
        )}

        {/* Empty state when query exists but no results */}
        {query.trim() && results.length === 0 && !isLoading && (
          <>
            <div
              className="mx-4"
              style={{ height: '1px', background: 'rgba(30, 30, 58, 0.8)' }}
            />
            <div className="px-5 py-6 text-center">
              <span style={{ color: '#4E4B6B', fontSize: '13px' }}>
                No files found for "{query}"
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
