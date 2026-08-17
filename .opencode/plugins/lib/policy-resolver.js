import fs from 'fs';
import path from 'path';

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// Not cached — see the identical note in risk-engine.js's getConfig. This module lives for
// the whole plugin/session lifetime, so caching policy-resolver.json would freeze enforcement
// policy at whatever it was on the first tool call.
function getConfig(dir) {
  const configPath = path.join(dir, '.opencode', 'governance', 'policy-resolver.json');
  return loadJson(configPath);
}

function resolveContext7Policy(config, operation) {
  if (!config || !config.policies || !config.policies['context7-gate']) return { action: 'off' };
  const rules = config.policies['context7-gate'].rules;
  return rules[operation] || { action: 'off' };
}

function resolveTruthPolicy(config, risk) {
  if (!config || !config.policies || !config.policies['truth-gate']) return { action: 'off' };
  const minConf = config.policies['truth-gate'].minConfidenceByRisk?.[risk] || 80;
  return { action: minConf > 0 ? 'require' : 'off', minConfidence: minConf };
}

function resolveSkillPolicy(config, operation) {
  if (!config || !config.policies || !config.policies['skill-gate']) return { action: 'off', required: [] };
  const rules = config.policies['skill-gate'].rules;
  const policy = rules[operation];
  if (!policy) return { action: 'off', required: [] };
  // policy-resolver.json labels every rule "one-of" (load at least one of `required`).
  // Default matches that — do NOT default to a value meaning "require all", or a rule
  // documented as one-of silently gets enforced as all-of.
  return { action: 'require', required: policy.required || [], mode: policy.mode || 'one-of' };
}

function resolveQualityPolicy(config) {
  if (!config || !config.policies || !config.policies['quality-gate']) return null;
  return config.policies['quality-gate'];
}

function resolveKnowledgePolicy(config, risk) {
  if (!config || !config.policies || !config.policies['knowledge-gate']) return { action: 'off' };
  const minLevel = config.policies['knowledge-gate'].minLevelByRisk?.[risk];
  if (minLevel === undefined) return { action: 'off' };
  return { action: minLevel < 8 ? 'require' : 'off', minLevel };
}

/**
 * Is `required` satisfied by `loaded`, given `mode`?
 *   - 'one-of' (default): at least one required skill must be loaded.
 *   - 'all': every required skill must be loaded.
 */
function isSkillRequirementSatisfied(required, loaded, mode) {
  if (!required || required.length === 0) return true;
  const loadedLower = (loaded || []).map(l => l.toLowerCase());
  const isLoaded = (r) => loadedLower.some(l => l.includes(r.toLowerCase()));
  return mode === 'all' ? required.every(isLoaded) : required.some(isLoaded);
}

function resolveAll(dir, operation, risk, skillsLoaded) {
  const config = getConfig(dir);
  if (!config) return { actions: {}, errors: [] };

  const context7 = resolveContext7Policy(config, operation);
  const truth = resolveTruthPolicy(config, risk);
  const skill = resolveSkillPolicy(config, operation);
  const quality = resolveQualityPolicy(config);
  const knowledge = resolveKnowledgePolicy(config, risk);

  const errors = [];

  if (context7.action === 'require') {
    errors.push({
      gate: 'context7',
      message: `Context7 query required for ${operation} (window: ${context7.windowMinutes || 15}min)`
    });
  }

  if (truth.action === 'require') {
    errors.push({
      gate: 'truth',
      message: `Truth gate requires min confidence ${truth.minConfidence}% for ${risk} risk`
    });
  }

  if (skill.action === 'require' && !isSkillRequirementSatisfied(skill.required, skillsLoaded, skill.mode)) {
    errors.push({
      gate: 'skill',
      message: `Missing required skills (${skill.mode}): ${(skill.required || []).join(', ')}`
    });
  }

  return {
    actions: { context7, truth, skill, quality, knowledge },
    errors,
    shouldBlock: errors.some(e => e.gate === 'context7' || e.gate === 'truth' || e.gate === 'skill')
  };
}

export { resolveAll, resolveContext7Policy, resolveTruthPolicy, resolveSkillPolicy, resolveQualityPolicy, resolveKnowledgePolicy, isSkillRequirementSatisfied };
