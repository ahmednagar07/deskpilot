import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mock the database dependency — rule-engine calls getDatabase() for cached rules
vi.mock('../src/main/database/connection', () => ({
  getDatabase: vi.fn(),
}));

import {
  classifyByRules,
  classifyBatchByRules,
  invalidateRulesCache,
  type ClassificationRule,
} from '../src/main/modules/file-classifier/rule-engine';
import { getDatabase } from '../src/main/database/connection';

// Helper: create mock rules
function mockRules(rules: Partial<ClassificationRule>[]) {
  const fullRules: ClassificationRule[] = rules.map((r, i) => ({
    id: i + 1,
    category_id: r.category_id ?? 1,
    rule_type: r.rule_type ?? 'extension',
    rule_value: r.rule_value ?? '.txt',
    priority: r.priority ?? (i + 1) * 10,
    is_active: r.is_active ?? 1,
  }));
  // Sort by priority ASC (matching the real DB query: ORDER BY priority ASC)
  fullRules.sort((a, b) => a.priority - b.priority);

  const mockDb = {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue(fullRules),
    }),
  };
  vi.mocked(getDatabase).mockReturnValue(mockDb as any);
  invalidateRulesCache(); // force reload
}

describe('classifyByRules', () => {
  beforeEach(() => {
    invalidateRulesCache();
  });

  describe('extension matching', () => {
    it('matches exact file extension', () => {
      mockRules([{ rule_type: 'extension', rule_value: '.pdf', category_id: 5 }]);
      const result = classifyByRules('C:/docs/report.pdf');
      expect(result).not.toBeNull();
      expect(result!.categoryId).toBe(5);
      expect(result!.ruleType).toBe('extension');
      expect(result!.confidence).toBe(1.0);
    });

    it('matches extension case-insensitively', () => {
      mockRules([{ rule_type: 'extension', rule_value: '.PDF', category_id: 3 }]);
      const result = classifyByRules('C:/docs/report.pdf');
      expect(result).not.toBeNull();
      expect(result!.categoryId).toBe(3);
    });

    it('returns null for non-matching extension', () => {
      mockRules([{ rule_type: 'extension', rule_value: '.xlsx', category_id: 1 }]);
      const result = classifyByRules('C:/docs/report.pdf');
      expect(result).toBeNull();
    });

    it('matches dotless extension format', () => {
      // Rule stores ".docx", file has extension ".docx"
      mockRules([{ rule_type: 'extension', rule_value: '.docx', category_id: 2 }]);
      const result = classifyByRules('C:/work/letter.docx');
      expect(result).not.toBeNull();
    });
  });

  describe('path_contains matching', () => {
    it('matches substring in file path', () => {
      mockRules([{ rule_type: 'path_contains', rule_value: 'clients', category_id: 10 }]);
      const result = classifyByRules('C:/work/clients/acme/proposal.pdf');
      expect(result).not.toBeNull();
      expect(result!.categoryId).toBe(10);
    });

    it('matches case-insensitively', () => {
      mockRules([{ rule_type: 'path_contains', rule_value: 'CLIENTS', category_id: 10 }]);
      const result = classifyByRules('C:/work/clients/acme/proposal.pdf');
      expect(result).not.toBeNull();
    });

    it('normalizes backslashes for matching', () => {
      mockRules([{ rule_type: 'path_contains', rule_value: 'work/clients', category_id: 10 }]);
      const result = classifyByRules('C:\\work\\clients\\file.txt');
      expect(result).not.toBeNull();
    });

    it('returns null for non-matching path', () => {
      mockRules([{ rule_type: 'path_contains', rule_value: 'secret-folder', category_id: 1 }]);
      const result = classifyByRules('C:/normal/path/file.txt');
      expect(result).toBeNull();
    });
  });

  describe('parent_folder matching', () => {
    it('matches the immediate parent folder name', () => {
      mockRules([{ rule_type: 'parent_folder', rule_value: 'invoices', category_id: 7 }]);
      const result = classifyByRules('C:/accounting/invoices/inv-001.pdf');
      expect(result).not.toBeNull();
      expect(result!.categoryId).toBe(7);
    });

    it('matches case-insensitively', () => {
      mockRules([{ rule_type: 'parent_folder', rule_value: 'Invoices', category_id: 7 }]);
      const result = classifyByRules('C:/accounting/invoices/inv-001.pdf');
      expect(result).not.toBeNull();
    });

    it('does not match grandparent folders', () => {
      mockRules([{ rule_type: 'parent_folder', rule_value: 'accounting', category_id: 7 }]);
      const result = classifyByRules('C:/accounting/invoices/inv-001.pdf');
      expect(result).toBeNull();
    });
  });

  describe('filename_pattern matching', () => {
    it('matches wildcard at end: invoice_*', () => {
      mockRules([{ rule_type: 'filename_pattern', rule_value: 'invoice_*', category_id: 4 }]);
      const result = classifyByRules('C:/docs/invoice_2024.pdf');
      expect(result).not.toBeNull();
      expect(result!.categoryId).toBe(4);
    });

    it('matches wildcard at start: *_report', () => {
      mockRules([{ rule_type: 'filename_pattern', rule_value: '*_report', category_id: 6 }]);
      const result = classifyByRules('C:/docs/quarterly_report.xlsx');
      expect(result).not.toBeNull();
    });

    it('matches case-insensitively', () => {
      mockRules([{ rule_type: 'filename_pattern', rule_value: 'INVOICE_*', category_id: 4 }]);
      const result = classifyByRules('C:/docs/invoice_2024.pdf');
      expect(result).not.toBeNull();
    });

    it('escapes regex special characters in pattern', () => {
      // Pattern with dots and brackets should be escaped
      mockRules([{ rule_type: 'filename_pattern', rule_value: 'test.file[1]', category_id: 1 }]);
      const result = classifyByRules('C:/docs/test.file[1].txt');
      expect(result).not.toBeNull();
    });

    it('returns null for non-matching pattern', () => {
      mockRules([{ rule_type: 'filename_pattern', rule_value: 'receipt_*', category_id: 1 }]);
      const result = classifyByRules('C:/docs/invoice_2024.pdf');
      expect(result).toBeNull();
    });
  });

  describe('priority ordering', () => {
    it('returns the first matching rule by priority', () => {
      mockRules([
        { rule_type: 'extension', rule_value: '.pdf', category_id: 1, priority: 20 },
        { rule_type: 'path_contains', rule_value: 'clients', category_id: 2, priority: 10 },
      ]);
      // Both rules match, but path_contains has lower priority (10 < 20) → checked first
      const result = classifyByRules('C:/clients/report.pdf');
      expect(result!.categoryId).toBe(2);
    });

    it('skips non-matching higher-priority rules', () => {
      mockRules([
        { rule_type: 'path_contains', rule_value: 'archive', category_id: 9, priority: 1 },
        { rule_type: 'extension', rule_value: '.pdf', category_id: 5, priority: 50 },
      ]);
      const result = classifyByRules('C:/work/report.pdf');
      // "archive" doesn't match, falls to extension rule
      expect(result!.categoryId).toBe(5);
    });
  });
});

describe('classifyBatchByRules', () => {
  beforeEach(() => {
    invalidateRulesCache();
  });

  it('classifies multiple files and returns only matches', () => {
    mockRules([
      { rule_type: 'extension', rule_value: '.pdf', category_id: 1 },
      { rule_type: 'extension', rule_value: '.jpg', category_id: 2 },
    ]);

    const results = classifyBatchByRules([
      'C:/file1.pdf',
      'C:/file2.txt', // no match
      'C:/file3.jpg',
    ]);

    expect(results.size).toBe(2);
    expect(results.has('C:/file1.pdf')).toBe(true);
    expect(results.has('C:/file2.txt')).toBe(false);
    expect(results.has('C:/file3.jpg')).toBe(true);
    expect(results.get('C:/file1.pdf')!.categoryId).toBe(1);
    expect(results.get('C:/file3.jpg')!.categoryId).toBe(2);
  });

  it('returns empty map when no files match', () => {
    mockRules([{ rule_type: 'extension', rule_value: '.xyz', category_id: 1 }]);
    const results = classifyBatchByRules(['C:/file.pdf', 'C:/file.txt']);
    expect(results.size).toBe(0);
  });

  it('handles empty input array', () => {
    mockRules([]);
    const results = classifyBatchByRules([]);
    expect(results.size).toBe(0);
  });
});

describe('invalidateRulesCache', () => {
  it('forces rules to be reloaded from database on next call', () => {
    // Load rules once
    mockRules([{ rule_type: 'extension', rule_value: '.pdf', category_id: 1 }]);
    classifyByRules('C:/test.pdf');

    // Change the mock to return different rules
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([
          { id: 99, category_id: 99, rule_type: 'extension', rule_value: '.pdf', priority: 1, is_active: 1 },
        ]),
      }),
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);

    // Without invalidation, old cache would be used
    invalidateRulesCache();

    const result = classifyByRules('C:/test.pdf');
    expect(result!.categoryId).toBe(99);
  });
});
