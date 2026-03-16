import { getDatabase } from '../../database/connection';
import path from 'path';

export interface ClassificationRule {
  id: number;
  category_id: number;
  rule_type: 'extension' | 'path_contains' | 'parent_folder' | 'filename_pattern';
  rule_value: string;
  priority: number;
  is_active: number;
}

export interface RuleMatch {
  categoryId: number;
  ruleId: number;
  ruleType: string;
  priority: number;
  confidence: 1.0;
}

let rulesCache: ClassificationRule[] | null = null;

function getActiveRules(): ClassificationRule[] {
  if (!rulesCache) {
    const db = getDatabase();
    rulesCache = db.prepare(
      'SELECT * FROM classification_rules WHERE is_active = 1 ORDER BY priority ASC'
    ).all() as ClassificationRule[];
  }
  return rulesCache;
}

export function invalidateRulesCache(): void {
  rulesCache = null;
}

/**
 * Classify a file using the rule engine.
 * Rules are checked in priority order (lower number = checked first).
 * Returns the first match, or null if no rules match.
 */
export function classifyByRules(filePath: string): RuleMatch | null {
  const rules = getActiveRules();
  const ext = path.extname(filePath).toLowerCase();
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parentFolder = path.basename(path.dirname(filePath));
  const filename = path.basename(filePath, ext);

  for (const rule of rules) {
    let matched = false;

    switch (rule.rule_type) {
      case 'extension':
        matched = ext === rule.rule_value.toLowerCase();
        break;

      case 'path_contains':
        // Case-insensitive path substring match
        matched = normalizedPath.toLowerCase().includes(rule.rule_value.toLowerCase());
        break;

      case 'parent_folder':
        matched = parentFolder.toLowerCase() === rule.rule_value.toLowerCase();
        break;

      case 'filename_pattern': {
        // Simple wildcard pattern: * matches any chars
        const pattern = rule.rule_value
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape regex chars except *
          .replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        matched = regex.test(filename);
        break;
      }
    }

    if (matched) {
      return {
        categoryId: rule.category_id,
        ruleId: rule.id,
        ruleType: rule.rule_type,
        priority: rule.priority,
        confidence: 1.0,
      };
    }
  }

  return null;
}

/**
 * Classify multiple files in bulk. Returns a map of filePath → RuleMatch.
 * Files without a rule match are omitted from the result.
 */
export function classifyBatchByRules(filePaths: string[]): Map<string, RuleMatch> {
  const results = new Map<string, RuleMatch>();
  for (const fp of filePaths) {
    const match = classifyByRules(fp);
    if (match) {
      results.set(fp, match);
    }
  }
  return results;
}
