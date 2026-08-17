import fs from 'fs';
import path from 'path';

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// Deliberately NOT cached. The OpenCode plugin host loads this module ONCE and keeps it
// resident for the whole session (module-level state persists across every tool call), so a
// `let _config = null; if (_config) return _config;` cache — as this used to be — freezes
// risk-engine.json AND state-machine.json at whatever they were on the first read, for the
// rest of the session. state-machine.json is the concrete failure mode: /agent_loop advancing
// the phase (F0 -> F2, say) rewrites currentState on disk, but a long-running session would
// keep computing risk against the stale cached F0 forever, silently never escalating to
// CRITICAL for a phase that IS critical. Re-reading a small JSON file per tool call is cheap;
// serving stale governance state for an entire session is not an acceptable trade for it.
function getConfig(dir) {
  const configPath = path.join(dir, '.opencode', 'governance', 'risk-engine.json');
  return loadJson(configPath);
}

function getStateMachine(dir) {
  const smPath = path.join(dir, '.opencode', 'governance', 'state-machine.json');
  return loadJson(smPath);
}

function detectPhaseProperties(dir) {
  const sm = getStateMachine(dir);
  if (!sm) return null;

  // Support both formats: { phases: { F0: {...} } } and { states: [{ id: "F0", ... }] }
  let currentPhaseId, allPhases, phaseDef;

  if (sm.states && Array.isArray(sm.states)) {
    // states array format (templates)
    currentPhaseId = sm.currentState || sm.currentPhase || 'F0';
    allPhases = sm.states;
    phaseDef = allPhases.find(s => s.id === currentPhaseId);
  } else if (sm.phases && typeof sm.phases === 'object') {
    // phases object format
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
    requiresApproval: phaseDef.requiresApproval || false
  };
}

function matchPattern(pattern, text) {
  if (pattern === '**/*') return true;
  if (pattern.startsWith('**/')) {
    const suffix = pattern.slice(3);
    if (suffix.includes('*')) {
      const regex = new RegExp('^' + suffix.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
      return regex.test(text) || text.includes(suffix.replace(/\*/g, ''));
    }
    return text.includes(suffix);
  }
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
    return regex.test(text);
  }
  return text.includes(pattern);
}

function getRiskFromPattern(rules, key, text) {
  if (!rules || !text) return null;
  for (const [pattern, level] of Object.entries(rules)) {
    if (matchPattern(pattern, text)) return level;
  }
  return null;
}

function getFileRiskLevel(config, filePath) {
  if (!config || !config.fileRisk || !filePath) return null;
  const normalizedPath = filePath.replace(/\\/g, '/');
  return getRiskFromPattern(config.fileRisk, 'fileRisk', normalizedPath);
}

function getOperationRiskLevel(config, operation) {
  if (!config || !config.operationRisk) return null;
  return config.operationRisk[operation] || null;
}

function getDomainRiskLevel(config, domain) {
  if (!config || !config.domainRisk) return null;
  return config.domainRisk[domain] || null;
}

function calculateRisk(dir, filePath, operation, domain) {
  const config = getConfig(dir);
  if (!config) return { risk: 'MEDIUM', reason: 'No risk-engine.json found', evidence: [] };

  const phaseProps = detectPhaseProperties(dir);
  const fileRisk = getFileRiskLevel(config, filePath);
  const opRisk = getOperationRiskLevel(config, operation);
  const domainRisk = getDomainRiskLevel(config, domain);

  const riskPriority = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

  const allRisks = [fileRisk, opRisk, domainRisk].filter(Boolean);
  let baseRisk = 'MEDIUM';

  if (allRisks.length > 0) {
    baseRisk = allRisks.reduce((max, r) =>
      riskPriority[r] > riskPriority[max] ? r : max, allRisks[0]);
  }

  // Escalate one level when the phase is critical, per behavior-contract.json's own
  // documented (previously unwired) riskEscalation rules: LOW stays LOW, MEDIUM->HIGH,
  // HIGH->CRITICAL, CRITICAL stays CRITICAL. The old logic here only ever escalated up TO
  // HIGH and stopped — a HIGH-risk file (e.g. a plain *.service.ts, HIGH by file pattern
  // alone) edited during a critical phase like "Payments" never reached CRITICAL, so it
  // never got the stricter truth-gate/context7 window CRITICAL requires, contradicting the
  // escalation table already declared in behavior-contract.json.
  if (phaseProps && phaseProps.isCritical) {
    const behaviorContract = loadJson(path.join(dir, '.opencode', 'governance', 'behavior-contract.json'));
    const escalationRules = behaviorContract?.riskEscalation?.rules || { MEDIUM: 'HIGH', HIGH: 'CRITICAL', CRITICAL: 'CRITICAL' };
    baseRisk = escalationRules[baseRisk] || baseRisk;
  }

  const minConfidence = config.riskLevels?.[baseRisk]?.minConfidence || 80;

  return {
    risk: baseRisk,
    minConfidence,
    phase: phaseProps,
    fileRisk,
    opRisk,
    domainRisk,
    evidence: [
      phaseProps && `phase:${phaseProps.id}(${phaseProps.position}${phaseProps.isCritical ? ',critical' : ''})`,
      fileRisk && `file:${fileRisk}`,
      opRisk && `op:${opRisk}`,
      domainRisk && `domain:${domainRisk}`
    ].filter(Boolean)
  };
}

export { calculateRisk, detectPhaseProperties, getConfig, getStateMachine };
