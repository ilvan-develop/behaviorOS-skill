#!/usr/bin/env node

/**
 * P1.4 — Architecture Governance Tests
 *
 * Validates that the BehaviorOS enforcement layer correctly implements
 * architecture governance through anti-patterns.json as the sole authority.
 *
 * Invariants tested:
 *   I-51  Architecture authority is singular
 *   I-52  Architecture enforcement uses anti-patterns
 *   I-53  Knowledge level determines architecture authority
 *   I-54  Architecture changes require evidence
 *   I-55  Architecture evidence is session/context bound
 *   I-56  Expired/stale architecture evidence cannot authorize
 *   I-57  Insufficient architecture evidence => DENY
 *   I-58  Lower knowledge level cannot satisfy higher requirement
 *   I-59  Architecture evidence cannot be self-escalated by agent
 *   I-60  Architecture Gate is enforced only through canonical policy path
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  mkdirSync, rmSync, writeFileSync, readFileSync, existsSync,
} from 'fs';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let tempDir;

function setup() {
  tempDir = join(tmpdir(), `oage-arch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
}

function teardown() {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: Load governance files
// ═══════════════════════════════════════════════════════════════════════════════

function loadAntiPatterns() {
  const path = join(__dirname, '..', '.opencode', 'governance', 'anti-patterns.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadKnowledgeHierarchy() {
  const path = join(__dirname, '..', '.opencode', 'governance', 'knowledge-hierarchy.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadGovernanceContract() {
  const path = join(__dirname, '..', '.opencode', 'governance', 'governance-contract.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function checkSkillExists(skillName) {
  const skillPath = join(__dirname, '..', '.opencode', 'skills', skillName, 'SKILL.md');
  return existsSync(skillPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 0 — Contract & Invariants (I-51 → I-60)
// ═══════════════════════════════════════════════════════════════════════════════

describe('P1.4 — Architecture Governance', () => {

  // ─────────────────────────────────────────────────────────────────────────────
  // I-51: Architecture authority is singular
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-51: Architecture authority is singular', () => {

    it('anti-patterns.json contains architecture category', () => {
      const antiPatterns = loadAntiPatterns();
      assert.ok(antiPatterns.categories.architecture, 'architecture category exists');
      assert.ok(Array.isArray(antiPatterns.categories.architecture), 'architecture category is array');
    });

    it('anti-patterns.json is enabled', () => {
      const antiPatterns = loadAntiPatterns();
      assert.strictEqual(antiPatterns.enabled, true, 'anti-patterns.json is enabled');
    });

    it('architecture category has required anti-patterns', () => {
      const antiPatterns = loadAntiPatterns();
      const archAntiPatterns = antiPatterns.categories.architecture;
      
      const ids = archAntiPatterns.map(ap => ap.id);
      assert.ok(ids.includes('arch-code-without-understanding'), 'arch-code-without-understanding exists');
      assert.ok(ids.includes('arch-premature-abstraction'), 'arch-premature-abstraction exists');
      assert.ok(ids.includes('arch-duplicate-component'), 'arch-duplicate-component exists');
      assert.ok(ids.includes('arch-out-of-scope-edit'), 'arch-out-of-scope-edit exists');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-52: Architecture enforcement uses anti-patterns
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-52: Architecture enforcement uses anti-patterns', () => {

    it('anti-patterns.json has version field', () => {
      const antiPatterns = loadAntiPatterns();
      assert.ok(antiPatterns.version, 'version field exists');
    });

    it('anti-patterns.json has description field', () => {
      const antiPatterns = loadAntiPatterns();
      assert.ok(antiPatterns.description, 'description field exists');
    });

    it('anti-patterns.json has categories section', () => {
      const antiPatterns = loadAntiPatterns();
      assert.ok(antiPatterns.categories, 'categories section exists');
    });

    it('architecture category has description', () => {
      const antiPatterns = loadAntiPatterns();
      assert.ok(antiPatterns.categories.architecture.length > 0, 'architecture category not empty');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-53: Knowledge level determines architecture authority
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-53: Knowledge level determines architecture authority', () => {

    it('knowledge-hierarchy has Level 2 (Architecture)', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(Array.isArray(knowledgeHierarchy.hierarchy), 'hierarchy is array');
      
      const level2 = knowledgeHierarchy.hierarchy.find(l => l.level === 2);
      assert.ok(level2, 'Level 2 exists');
      assert.strictEqual(level2.name, 'Architecture', 'Level 2 is Architecture');
    });

    it('Level 2 has confidence 95', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      const level2 = knowledgeHierarchy.hierarchy.find(l => l.level === 2);
      assert.strictEqual(level2.confidence, 95, 'Level 2 confidence is 95');
    });

    it('Level 2 has priority high', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      const level2 = knowledgeHierarchy.hierarchy.find(l => l.level === 2);
      assert.strictEqual(level2.priority, 'high', 'Level 2 priority is high');
    });

    it('evidenceSourceMap maps architecture to Level 2', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(knowledgeHierarchy.evidenceSourceMap, 'evidenceSourceMap exists');
      assert.strictEqual(knowledgeHierarchy.evidenceSourceMap.architecture, 'Architecture', 'architecture maps to Architecture');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-54: Architecture changes require evidence
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-54: Architecture changes require evidence', () => {

    it('knowledge-hierarchy has enforcement section', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(knowledgeHierarchy.enforcement, 'enforcement section exists');
    });

    it('enforcement requires evidence from Level 1-4', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(knowledgeHierarchy.enforcement.requirement, 'requirement exists');
      assert.ok(
        knowledgeHierarchy.enforcement.requirement.includes('Level 1-4'),
        'requirement mentions Level 1-4'
      );
    });

    it('blocking conditions prevent implementation without evidence', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(Array.isArray(knowledgeHierarchy.enforcement.blockingConditions), 'blockingConditions is array');
      assert.ok(knowledgeHierarchy.enforcement.blockingConditions.length > 0, 'blockingConditions not empty');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-55: Architecture evidence is session/context bound
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-55: Architecture evidence is session/context bound', () => {

    it('knowledge-hierarchy enforcement is scoped to sessionID', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(knowledgeHierarchy.enforcement.note, 'note exists');
      assert.ok(
        knowledgeHierarchy.enforcement.note.includes('sessionID'),
        'enforcement is scoped to sessionID'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-56: Expired/stale architecture evidence cannot authorize
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-56: Expired/stale architecture evidence cannot authorize', () => {

    it('knowledge-hierarchy has maxAssumptions limit', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.strictEqual(knowledgeHierarchy.enforcement.maxAssumptions, 0, 'maxAssumptions is 0');
    });

    it('blocking conditions prevent using stale evidence', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(
        knowledgeHierarchy.enforcement.blockingConditions.some(c => c.includes('Level 7-8')),
        'blocking condition for Level 7-8 exists'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-57: Insufficient architecture evidence => DENY
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-57: Insufficient architecture evidence => DENY', () => {

    it('knowledge-hierarchy has minimumEvidence requirement', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(Array.isArray(knowledgeHierarchy.enforcement.minimumEvidence), 'minimumEvidence is array');
      assert.ok(knowledgeHierarchy.enforcement.minimumEvidence.length > 0, 'minimumEvidence not empty');
    });

    it('minimumEvidence includes repo_state', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(
        knowledgeHierarchy.enforcement.minimumEvidence.includes('repo_state'),
        'minimumEvidence includes repo_state'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-58: Lower knowledge level cannot satisfy higher requirement
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-58: Lower knowledge level cannot satisfy higher requirement', () => {

    it('knowledge-hierarchy has levels 1-8', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(Array.isArray(knowledgeHierarchy.hierarchy), 'hierarchy is array');
      assert.strictEqual(knowledgeHierarchy.hierarchy.length, 8, '8 levels');
    });

    it('levels are ordered from highest to lowest priority', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      const levels = knowledgeHierarchy.hierarchy;
      
      for (let i = 0; i < levels.length - 1; i++) {
        assert.ok(levels[i].level < levels[i + 1].level, `level ${levels[i].level} < level ${levels[i + 1].level}`);
      }
    });

    it('minLevelByRisk requires higher levels for higher risk', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      const minLevels = knowledgeHierarchy.enforcement.minLevelByRisk;
      
      // Lower level number = higher priority
      assert.ok(minLevels.LOW >= minLevels.MEDIUM, 'LOW requires lower priority than MEDIUM');
      assert.ok(minLevels.MEDIUM >= minLevels.HIGH, 'MEDIUM requires lower priority than HIGH');
      assert.ok(minLevels.HIGH >= minLevels.CRITICAL, 'HIGH requires lower priority than CRITICAL');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-59: Architecture evidence cannot be self-escalated by agent
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-59: Architecture evidence cannot be self-escalated by agent', () => {

    it('knowledge-hierarchy has antiPatterns against self-escalation', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      
      // Check Level 7 (Agent Knowledge) has anti-patterns
      const level7 = knowledgeHierarchy.hierarchy.find(l => l.level === 7);
      assert.ok(level7.antiPatterns, 'level 7 has antiPatterns');
      assert.ok(
        level7.antiPatterns.some(p => p.includes('Never treat training knowledge as authoritative')),
        'level 7 anti-pattern against treating training as authoritative'
      );
    });

    it('knowledge-hierarchy has antiPatterns against assumptions', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      
      // Check Level 8 (Assumptions) has anti-patterns
      const level8 = knowledgeHierarchy.hierarchy.find(l => l.level === 8);
      assert.ok(level8.antiPatterns, 'level 8 has antiPatterns');
      assert.ok(
        level8.antiPatterns.some(p => p.includes('NEVER implement based on assumptions alone')),
        'level 8 anti-pattern against implementing from assumptions'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-60: Architecture Gate is enforced only through canonical policy path
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-60: Architecture Gate is enforced only through canonical policy path', () => {

    it('governance-contract.json declares anti-patterns as enforced', () => {
      const contract = loadGovernanceContract();
      assert.ok(contract.policies['anti-patterns.json'], 'anti-patterns.json in contract');
      assert.strictEqual(contract.policies['anti-patterns.json'].authority, 'kernel', 'authority is kernel');
      assert.strictEqual(contract.policies['anti-patterns.json'].status, 'enforced', 'status is enforced');
    });

    it('monorepo-architecture-guardian skill exists', () => {
      assert.ok(checkSkillExists('monorepo-architecture-guardian'), 'monorepo-architecture-guardian skill exists');
    });

    it('monorepo-architecture-guardian skill has SKILL.md', () => {
      const skillPath = join(__dirname, '..', '.opencode', 'skills', 'monorepo-architecture-guardian', 'SKILL.md');
      assert.ok(existsSync(skillPath), 'SKILL.md exists');
    });
  });
});
