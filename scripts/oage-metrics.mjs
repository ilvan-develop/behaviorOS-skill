#!/usr/bin/env node

/**
 * behaviorOS - Observability / Agent Quality metrics (OAGE §55-57)
 *
 * Aggregates .opencode/audit/audit.jsonl and .opencode/audit/skill-selections.log into the
 * metrics OAGE calls for: tool_denial_rate, policy_violation_rate, skill_usage,
 * context7_usage, loop_detection_rate, average_retries.
 *
 * Usage: node scripts/oage-metrics.mjs [--json]
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function main() {
  const asJson = process.argv.includes('--json');
  const projectRoot = process.cwd();
  const auditDir = join(projectRoot, '.opencode', 'audit');

  const events = readJsonl(join(auditDir, 'audit.jsonl'));
  // skill-selections.log is only ever written by the manual scripts/skill-tracker.ps1 path.
  // The automatic path (oage-audit.js, which INSTRUCTIONS.md §17 tells agents to rely on
  // instead of calling that script) logs skill_load events into audit.jsonl only — so relying
  // on skill-selections.log alone made this report blind to real, automatic skill usage.
  // Merge both sources.
  const legacySkillEvents = readJsonl(join(auditDir, 'skill-selections.log'));
  const autoSkillEvents = events.filter((e) => e.event === 'skill_load');
  const skillEvents = [...legacySkillEvents, ...autoSkillEvents];

  const total = events.length;
  const byEvent = {};
  for (const e of events) {
    byEvent[e.event] = (byEvent[e.event] || 0) + 1;
  }

  const blocked = byEvent.blocked || 0;
  const antiPatternFlagged = byEvent.anti_pattern_flagged || 0;
  const loopDetected = byEvent.loop_detected || 0;
  const toolExecuted = byEvent.tool_executed || 0;
  const toolCalls = events.filter((e) => e.tool).length;

  const skillUsage = {};
  for (const e of skillEvents) {
    if (e.skill && e.skill !== 'all') skillUsage[e.skill] = (skillUsage[e.skill] || 0) + 1;
  }
  // Real context7 usage is its own audit.jsonl event (context7_queried), not a pseudo-skill
  // named "context7"/"context7-mcp" in skill-selections.log — that only ever matched if
  // someone manually logged a skill load under that literal name.
  const context7Loads = byEvent.context7_queried || 0;

  const metrics = {
    totalAuditEvents: total,
    totalToolCalls: toolCalls,
    toolDenialRate: toolCalls ? +(blocked / toolCalls).toFixed(4) : 0,
    policyViolationRate: toolCalls ? +((blocked + antiPatternFlagged) / toolCalls).toFixed(4) : 0,
    loopDetectionRate: toolCalls ? +(loopDetected / toolCalls).toFixed(4) : 0,
    skillUsage,
    context7UsageCount: context7Loads,
    context7UsageRate: toolCalls ? +(context7Loads / toolCalls).toFixed(4) : 0,
    eventBreakdown: byEvent,
  };

  if (asJson) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  console.log('');
  console.log('=== OAGE Observability Report ===');
  console.log('');
  console.log(`Total audit events:     ${metrics.totalAuditEvents}`);
  console.log(`Total tool calls:       ${metrics.totalToolCalls}`);
  console.log(`Tool denial rate:       ${(metrics.toolDenialRate * 100).toFixed(1)}%`);
  console.log(`Policy violation rate:  ${(metrics.policyViolationRate * 100).toFixed(1)}%`);
  console.log(`Loop detection rate:    ${(metrics.loopDetectionRate * 100).toFixed(1)}%`);
  console.log(`Context7 usage:         ${metrics.context7UsageCount} queries (${(metrics.context7UsageRate * 100).toFixed(1)}% of tool calls)`);
  console.log('');
  console.log('Skill usage:');
  const skillEntries = Object.entries(skillUsage).sort((a, b) => b[1] - a[1]);
  if (skillEntries.length === 0) {
    console.log('  (nenhum registo em audit.jsonl nem skill-selections.log)');
  } else {
    for (const [skill, count] of skillEntries) {
      console.log(`  ${skill}: ${count}`);
    }
  }
  console.log('');
  console.log('Event breakdown:');
  for (const [event, count] of Object.entries(byEvent)) {
    console.log(`  ${event}: ${count}`);
  }
  console.log('');
}

main();
