import fs from 'fs';
import path from 'path';

const PROTOCOL_STEPS = [
  { id: 'UNDERSTAND', required: true, enforcement: 'block' },
  { id: 'DISCOVER', required: true, enforcement: 'warn' },
  { id: 'IDENTIFY', required: true, enforcement: 'warn' },
  { id: 'LOAD', required: true, enforcement: 'require' },
  { id: 'GROUND', required: true, enforcement: 'require' },
  { id: 'VERIFY', required: true, enforcement: 'warn' },
  { id: 'PLAN', required: true, enforcement: 'warn' },
  { id: 'EXECUTE', required: true, enforcement: 'off' },
  { id: 'VALIDATE', required: true, enforcement: 'require' },
  { id: 'AUDIT', required: true, enforcement: 'warn' },
  { id: 'LEARN', required: true, enforcement: 'off' }
];

const KNOWLEDGE_HIERARCHY = [
  { level: 1, name: 'Repo', confidence: 100, priority: 'highest' },
  { level: 2, name: 'Architecture', confidence: 95, priority: 'high' },
  { level: 3, name: 'Versions', confidence: 100, priority: 'high' },
  { level: 4, name: 'Official Docs', confidence: 90, priority: 'high' },
  { level: 5, name: 'Skills', confidence: 85, priority: 'medium' },
  { level: 6, name: 'Patterns', confidence: 80, priority: 'medium' },
  { level: 7, name: 'Agent Knowledge', confidence: 50, priority: 'low' },
  { level: 8, name: 'Assumptions', confidence: 20, priority: 'lowest' }
];

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getProtocolSteps(dir) {
  const protocolPath = path.join(dir, '.opencode', 'governance', 'execution-protocol.json');
  const protocol = loadJson(protocolPath);
  if (protocol && protocol.steps) return protocol.steps;
  return PROTOCOL_STEPS;
}

function getKnowledgeHierarchy(dir) {
  const hierarchyPath = path.join(dir, '.opencode', 'governance', 'knowledge-hierarchy.json');
  const hierarchy = loadJson(hierarchyPath);
  if (hierarchy && hierarchy.hierarchy) return hierarchy.hierarchy;
  return KNOWLEDGE_HIERARCHY;
}

function getCurrentStep(session) {
  if (!session) return PROTOCOL_STEPS[0];
  const steps = session.steps || [];
  for (const step of PROTOCOL_STEPS) {
    if (!steps.find(s => s.id === step.id)) return step;
  }
  return PROTOCOL_STEPS[PROTOCOL_STEPS.length - 1];
}

function validateStepCompletion(dir, stepId, evidence) {
  const steps = getProtocolSteps(dir);
  const step = steps.find(s => s.id === stepId);
  if (!step) return { valid: false, reason: `Unknown step: ${stepId}` };

  if (!step.required) return { valid: true, reason: 'Step not required' };

  const evidenceCount = (evidence || []).length;
  if (evidenceCount === 0) {
    return {
      valid: false,
      reason: `Step ${stepId} requires at least 1 grounding evidence`,
      required: step.requiredContext || [],
      enforcement: step.enforcement
    };
  }

  return { valid: true, reason: `Step ${stepId} has ${evidenceCount} evidence(s)` };
}

function getMinimumEvidenceForRisk(dir, riskLevel) {
  const hierarchy = getKnowledgeHierarchy(dir);
  const riskMap = {
    'LOW': 1,
    'MEDIUM': 3,
    'HIGH': 5,
    'CRITICAL': 7
  };
  const minLevel = riskMap[riskLevel] || 3;
  return hierarchy.filter(h => h.level <= minLevel).map(h => h.name);
}

function validateEvidenceQuality(dir, evidence, riskLevel) {
  const hierarchy = getKnowledgeHierarchy(dir);
  const minLevel = getMinimumEvidenceForRisk(dir, riskLevel);

  const validSources = minLevel.map(name => {
    const h = hierarchy.find(h => h.name === name);
    return h ? h.name : null;
  }).filter(Boolean);

  const hasValidEvidence = evidence.some(e => validSources.includes(e.source));

  if (!hasValidEvidence) {
    return {
      valid: false,
      reason: `Insufficient evidence quality for ${riskLevel} risk. Required sources: ${validSources.join(', ')}`,
      validSources,
      providedSources: evidence.map(e => e.source)
    };
  }

  return { valid: true, reason: 'Evidence quality sufficient' };
}

function detectPhase(dir) {
  const smPath = path.join(dir, '.opencode', 'governance', 'state-machine.json');
  const sm = loadJson(smPath);
  if (!sm) return null;

  let currentPhaseId, allPhases, phaseDef;

  if (sm.states && Array.isArray(sm.states)) {
    currentPhaseId = sm.currentState || sm.currentPhase || 'F0';
    allPhases = sm.states;
    phaseDef = allPhases.find(s => s.id === currentPhaseId);
  } else if (sm.phases && typeof sm.phases === 'object') {
    currentPhaseId = sm.currentPhase || sm.current?.phase || 'F0';
    allPhases = Object.entries(sm.phases).map(([id, def]) => ({ id, ...def }));
    phaseDef = allPhases.find(p => p.id === currentPhaseId);
  } else {
    return null;
  }

  if (!phaseDef) return null;

  const index = allPhases.findIndex(p => p.id === currentPhaseId);
  return {
    id: currentPhaseId,
    position: index === 0 ? 'first' : index === allPhases.length - 1 ? 'last' : 'middle',
    isCritical: phaseDef.isCritical || phaseDef.critical || false,
    totalPhases: allPhases.length,
    index
  };
}

/**
 * Knowledge Gate check (GROUND step): does at least one recent grounding_evidence
 * event map to a hierarchy level good enough for `riskLevel`?
 *
 * `events` is the caller-supplied list of `grounding_evidence` audit records (already
 * filtered by sessionID/window by the caller — this function is pure w.r.t. I/O beyond
 * reading governance JSON, so it stays testable without touching the audit log).
 */
function checkGroundingEvidence(dir, riskLevel, events) {
  const config = loadJson(path.join(dir, '.opencode', 'governance', 'knowledge-hierarchy.json'));
  const hierarchy = (config && config.hierarchy) || KNOWLEDGE_HIERARCHY;
  const sourceMap = (config && config.evidenceSourceMap) || {};
  const minLevel = (config && config.enforcement && config.enforcement.minLevelByRisk && config.enforcement.minLevelByRisk[riskLevel])
    ?? { LOW: 8, MEDIUM: 6, HIGH: 4, CRITICAL: 4 }[riskLevel]
    ?? 6;

  if (minLevel >= 8) return { valid: true, reason: `Knowledge gate off for ${riskLevel} risk`, minLevel };

  const list = events || [];
  const levelByName = Object.fromEntries(hierarchy.map(h => [h.name, h.level]));

  const satisfying = list.find((ev) => {
    const hierarchyName = sourceMap[ev.source];
    if (!hierarchyName) return false;
    const level = levelByName[hierarchyName];
    return level !== undefined && level <= minLevel;
  });

  if (!satisfying) {
    return {
      valid: false,
      minLevel,
      reason: `No grounding evidence at hierarchy level <= ${minLevel} for ${riskLevel} risk`,
      providedSources: list.map(e => e.source),
    };
  }

  return { valid: true, reason: `Satisfied by evidence from '${satisfying.source}'`, minLevel };
}

export {
  getProtocolSteps,
  getKnowledgeHierarchy,
  getCurrentStep,
  validateStepCompletion,
  getMinimumEvidenceForRisk,
  validateEvidenceQuality,
  checkGroundingEvidence,
  detectPhase,
  PROTOCOL_STEPS,
  KNOWLEDGE_HIERARCHY,
};
