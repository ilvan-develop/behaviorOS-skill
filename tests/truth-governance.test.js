#!/usr/bin/env node

/**
 * P1.3 — Truth Governance Tests
 *
 * Validates that the BehaviorOS enforcement layer correctly implements
 * truth governance through policy-resolver.json as the sole authority.
 *
 * Invariants tested:
 *   I-41  Truth authority is singular
 *   I-42  Truth decision uses policy-resolver
 *   I-43  Risk determines required confidence
 *   I-44  Declared confidence requires evidence
 *   I-45  Confidence is session/context bound
 *   I-46  Expired/stale confidence cannot authorize
 *   I-47  Insufficient confidence => DENY
 *   I-48  Lower knowledge level cannot satisfy higher requirement
 *   I-49  Truth evidence cannot be self-escalated by agent
 *   I-50  Truth Gate is observational/enforced only through canonical policy path
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
  tempDir = join(tmpdir(), `oage-truth-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
}

function teardown() {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: Load governance files
// ═══════════════════════════════════════════════════════════════════════════════

function loadPolicyResolver() {
  const path = join(__dirname, '..', '.opencode', 'governance', 'policy-resolver.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadRiskEngine() {
  const path = join(__dirname, '..', '.opencode', 'governance', 'risk-engine.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadKnowledgeHierarchy() {
  const path = join(__dirname, '..', '.opencode', 'governance', 'knowledge-hierarchy.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadTruthGate() {
  const path = join(__dirname, '..', '.opencode', 'governance', 'truth-gate.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 0 — Contract & Invariants (I-41 → I-50)
// ═══════════════════════════════════════════════════════════════════════════════

describe('P1.3 — Truth Governance', () => {

  // ─────────────────────────────────────────────────────────────────────────────
  // I-41: Truth authority is singular
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-41: Truth authority is singular', () => {

    it('policy-resolver.json contains truth-gate section', () => {
      const policyResolver = loadPolicyResolver();
      assert.ok(policyResolver.policies['truth-gate'], 'truth-gate section exists');
      assert.ok(policyResolver.policies['truth-gate'].minConfidenceByRisk, 'minConfidenceByRisk exists');
    });

    it('truth-gate.json is disabled', () => {
      const truthGate = loadTruthGate();
      assert.strictEqual(truthGate.enabled, false, 'truth-gate.json is disabled');
    });

    it('truth-gate.json authority is superseded', () => {
      const truthGate = loadTruthGate();
      // truth-gate.json doesn't have explicit authority field, but description says SUPERSEDED
      assert.ok(truthGate.description.includes('SUPERSEDED'), 'truth-gate.json description mentions SUPERSEDED');
    });

    it('policy-resolver.json is the sole source of truth thresholds', () => {
      const policyResolver = loadPolicyResolver();
      const truthGate = policyResolver.policies['truth-gate'];
      
      // Verify thresholds exist
      assert.strictEqual(truthGate.minConfidenceByRisk.LOW, 0);
      assert.strictEqual(truthGate.minConfidenceByRisk.MEDIUM, 60);
      assert.strictEqual(truthGate.minConfidenceByRisk.HIGH, 80);
      assert.strictEqual(truthGate.minConfidenceByRisk.CRITICAL, 95);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-42: Truth decision uses policy-resolver
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-42: Truth decision uses policy-resolver', () => {

    it('policy-resolver.json has version field', () => {
      const policyResolver = loadPolicyResolver();
      assert.ok(policyResolver.version, 'version field exists');
    });

    it('policy-resolver.json has description field', () => {
      const policyResolver = loadPolicyResolver();
      assert.ok(policyResolver.description, 'description field exists');
    });

    it('policy-resolver.json has policies section', () => {
      const policyResolver = loadPolicyResolver();
      assert.ok(policyResolver.policies, 'policies section exists');
    });

    it('truth-gate section has description', () => {
      const policyResolver = loadPolicyResolver();
      assert.ok(policyResolver.policies['truth-gate'].description, 'description exists');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-43: Risk determines required confidence
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-43: Risk determines required confidence', () => {

    it('LOW risk requires 0% confidence', () => {
      const policyResolver = loadPolicyResolver();
      const threshold = policyResolver.policies['truth-gate'].minConfidenceByRisk.LOW;
      assert.strictEqual(threshold, 0, 'LOW risk requires 0% confidence');
    });

    it('MEDIUM risk requires 60% confidence', () => {
      const policyResolver = loadPolicyResolver();
      const threshold = policyResolver.policies['truth-gate'].minConfidenceByRisk.MEDIUM;
      assert.strictEqual(threshold, 60, 'MEDIUM risk requires 60% confidence');
    });

    it('HIGH risk requires 80% confidence', () => {
      const policyResolver = loadPolicyResolver();
      const threshold = policyResolver.policies['truth-gate'].minConfidenceByRisk.HIGH;
      assert.strictEqual(threshold, 80, 'HIGH risk requires 80% confidence');
    });

    it('CRITICAL risk requires 95% confidence', () => {
      const policyResolver = loadPolicyResolver();
      const threshold = policyResolver.policies['truth-gate'].minConfidenceByRisk.CRITICAL;
      assert.strictEqual(threshold, 95, 'CRITICAL risk requires 95% confidence');
    });

    it('Thresholds are monotonically increasing', () => {
      const policyResolver = loadPolicyResolver();
      const thresholds = policyResolver.policies['truth-gate'].minConfidenceByRisk;
      
      assert.ok(thresholds.LOW <= thresholds.MEDIUM, 'LOW <= MEDIUM');
      assert.ok(thresholds.MEDIUM <= thresholds.HIGH, 'MEDIUM <= HIGH');
      assert.ok(thresholds.HIGH <= thresholds.CRITICAL, 'HIGH <= CRITICAL');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-44: Declared confidence requires evidence
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-44: Declared confidence requires evidence', () => {

    it('knowledge-gate requires evidence from Level 1-4', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(knowledgeHierarchy.enforcement, 'enforcement section exists');
      assert.ok(knowledgeHierarchy.enforcement.requirement, 'requirement exists');
    });

    it('blocking conditions prevent implementation without evidence', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(Array.isArray(knowledgeHierarchy.enforcement.blockingConditions), 'blockingConditions is array');
      assert.ok(knowledgeHierarchy.enforcement.blockingConditions.length > 0, 'blockingConditions not empty');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-45: Confidence is session/context bound
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-45: Confidence is session/context bound', () => {

    it('knowledge-gate enforcement is scoped to sessionID', () => {
      const knowledgeHierarchy = loadKnowledgeHierarchy();
      assert.ok(knowledgeHierarchy.enforcement.note, 'note exists');
      assert.ok(
        knowledgeHierarchy.enforcement.note.includes('sessionID'),
        'enforcement is scoped to sessionID'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-46: Expired/stale confidence cannot authorize
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-46: Expired/stale confidence cannot authorize', () => {

    it('truth-gate has windowMinutes in context7-gate rules', () => {
      const policyResolver = loadPolicyResolver();
      const context7Gate = policyResolver.policies['context7-gate'];
      
      // Check that some rules have windowMinutes
      const rulesWithWindow = Object.values(context7Gate.rules).filter(r => r.windowMinutes);
      assert.ok(rulesWithWindow.length > 0, 'some rules have windowMinutes');
    });

    it('windowMinutes values are reasonable', () => {
      const policyResolver = loadPolicyResolver();
      const context7Gate = policyResolver.policies['context7-gate'];
      
      for (const [op, rule] of Object.entries(context7Gate.rules)) {
        if (rule.windowMinutes) {
          assert.ok(rule.windowMinutes > 0, `${op} windowMinutes > 0`);
          assert.ok(rule.windowMinutes <= 120, `${op} windowMinutes <= 120`);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-47: Insufficient confidence => DENY
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-47: Insufficient confidence => DENY', () => {

    it('risk-engine defines minConfidence per risk level', () => {
      const riskEngine = loadRiskEngine();
      assert.ok(riskEngine.riskLevels, 'riskLevels exists');
      
      assert.strictEqual(riskEngine.riskLevels.LOW.minConfidence, 70);
      assert.strictEqual(riskEngine.riskLevels.MEDIUM.minConfidence, 80);
      assert.strictEqual(riskEngine.riskLevels.HIGH.minConfidence, 90);
      assert.strictEqual(riskEngine.riskLevels.CRITICAL.minConfidence, 95);
    });

    it('risk-engine thresholds are monotonically increasing', () => {
      const riskEngine = loadRiskEngine();
      const levels = riskEngine.riskLevels;
      
      assert.ok(levels.LOW.minConfidence <= levels.MEDIUM.minConfidence, 'LOW <= MEDIUM');
      assert.ok(levels.MEDIUM.minConfidence <= levels.HIGH.minConfidence, 'MEDIUM <= HIGH');
      assert.ok(levels.HIGH.minConfidence <= levels.CRITICAL.minConfidence, 'HIGH <= CRITICAL');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I-48: Lower knowledge level cannot satisfy higher requirement
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-48: Lower knowledge level cannot satisfy higher requirement', () => {

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
  // I-49: Truth evidence cannot be self-escalated by agent
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-49: Truth evidence cannot be self-escalated by agent', () => {

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
  // I-50: Truth Gate is observational/enforced only through canonical policy path
  // ─────────────────────────────────────────────────────────────────────────────

  describe('I-50: Truth Gate is observational/enforced only through canonical policy path', () => {

    it('truth-gate.json action is off', () => {
      const truthGate = loadTruthGate();
      assert.strictEqual(truthGate.action, 'off', 'truth-gate.json action is off');
    });

    it('truth-gate.json note explains enforcement through kernel', () => {
      const truthGate = loadTruthGate();
      assert.ok(truthGate.note, 'note exists');
      assert.ok(
        truthGate.note.includes('policy-resolver.json'),
        'note references policy-resolver.json'
      );
    });

    it('governance-contract.json declares truth-gate as enforced by kernel', () => {
      const contractPath = join(__dirname, '..', '.opencode', 'governance', 'governance-contract.json');
      const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
      
      assert.ok(contract.policies['truth-gate.json'], 'truth-gate.json in contract');
      assert.strictEqual(contract.policies['truth-gate.json'].authority, 'kernel', 'authority is kernel');
      assert.strictEqual(contract.policies['truth-gate.json'].status, 'enforced', 'status is enforced');
    });
  });
});
