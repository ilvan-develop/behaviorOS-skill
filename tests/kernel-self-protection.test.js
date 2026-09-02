#!/usr/bin/env node

/**
 * behaviorOS - Kernel self-protection (adversarial)
 *
 * These tests do not ask "does the code run?" — they ask "can an agent trying to break the
 * governance system break it?". Every case here drives the REAL `tool.execute.before` hook
 * from .opencode/plugins/oage-enforce.js against a throwaway project, and asserts the hook
 * throws with the protected-resources message.
 *
 * Why this file exists: a 360 audit found 16 real write/edit calls to
 * `.opencode/governance|plugins|audit` recorded in audit.jsonl — 16 allowed, 0 blocked,
 * including a write to oage-enforce.js itself. The policy was correct and the suite was
 * green: the patterns are root-anchored (`.opencode/governance/**`) while the tools pass
 * ABSOLUTE paths, so the matcher never met the target. Nothing tested the absolute form,
 * because nothing tested enforcement adversarially at all.
 *
 * KERNEL_SELF_PROTECTION is an invariant, so the representation of a path must not decide
 * whether it holds. Each protected target is therefore attacked in every spelling a model
 * can produce: repo-relative, `./`-prefixed, absolute posix, absolute native, and mixed
 * separators.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { join, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync } from 'fs';
import { tmpdir } from 'os';
import { OageEnforce } from '../.opencode/plugins/oage-enforce.js';
import { canonicalTarget, matchesAny, extractBashMutatedPaths, extractInterpreterWrites } from '../.opencode/plugins/lib/oage-lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

let FIXTURE;
let hook;

/** Every spelling of `relPath` a tool call might realistically carry. */
function spellings(relPath) {
  const abs = join(FIXTURE, relPath.split('/').join(sep));
  return {
    'repo-relative': relPath,
    'dot-slash relative': `./${relPath}`,
    'absolute native': abs,
    'absolute posix': abs.split(sep).join('/'),
    'mixed separators': abs.split(sep).join('/').replace('/.opencode/', `${sep}.opencode${sep}`),
  };
}

/** Run the hook for a tool call, returning the thrown Error or null. */
async function attempt(tool, args) {
  try {
    await hook({ tool, sessionID: 'ses_adversarial', callID: 'call_1' }, { args });
    return null;
  } catch (error) {
    return error;
  }
}

function assertDenied(error, label) {
  assert.ok(error, `${label}: expected DENY, but the call was ALLOWED`);
  assert.match(
    error.message,
    /\[OAGE\].*(protegido|protected)/i,
    `${label}: blocked, but not by protected-resources (got: ${error.message})`,
  );
}

before(() => {
  FIXTURE = join(tmpdir(), `oage-selfprotect-${process.pid}`);
  rmSync(FIXTURE, { recursive: true, force: true });
  mkdirSync(join(FIXTURE, '.opencode', 'governance'), { recursive: true });
  mkdirSync(join(FIXTURE, '.opencode', 'plugins'), { recursive: true });
  mkdirSync(join(FIXTURE, 'src'), { recursive: true });

  // Real policy, not a stand-in — the test must fail if the shipped policy regresses.
  cpSync(
    join(ROOT_DIR, 'templates', 'base', 'governance'),
    join(FIXTURE, '.opencode', 'governance'),
    { recursive: true },
  );
  // Files the kernel protects, present so the attacks target something real.
  writeFileSync(join(FIXTURE, '.opencode', 'plugins', 'oage-enforce.js'), '// enforcer\n');
  writeFileSync(join(FIXTURE, '.opencode', 'governance', 'permissions-matrix.json'), '{"matrix":{}}');
  writeFileSync(join(FIXTURE, '.opencode', 'governance', 'state-machine.json'), '{"currentState":"F2"}');
  writeFileSync(join(FIXTURE, 'src', 'util.ts'), 'export const x = 1;\n');

  const plugin = OageEnforce({ directory: FIXTURE });
  return Promise.resolve(plugin).then((p) => { hook = p['tool.execute.before']; });
});

after(() => {
  rmSync(FIXTURE, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// The invariant, in every spelling
// ─────────────────────────────────────────────────────────────────────────────

describe('KERNEL_SELF_PROTECTION — path representation must not change the verdict', () => {
  const PROTECTED = [
    ['governance policy', '.opencode/governance/policy-resolver.json'],
    ['the enforcer itself', '.opencode/plugins/oage-enforce.js'],
    ['audit configuration', '.opencode/governance/audit.json'],
    ['permissions matrix', '.opencode/governance/permissions-matrix.json'],
    ['state machine', '.opencode/governance/state-machine.json'],
    ['protected-resources policy', '.opencode/governance/protected-resources.json'],
    // The contract declares who may enforce what; rewriting it would rewrite the authority map.
    ['the governance contract', '.opencode/governance/governance-contract.json'],
  ];

  for (const [what, relPath] of PROTECTED) {
    for (const [form, target] of Object.entries(spellings(relPath))) {
      it(`denies write to ${what} — ${form}`, async () => {
        assertDenied(await attempt('write', { filePath: target, content: '{"pwned":true}' }), `write ${form}`);
      });

      it(`denies edit of ${what} — ${form}`, async () => {
        assertDenied(
          await attempt('edit', { filePath: target, oldString: 'a', newString: 'b' }),
          `edit ${form}`,
        );
      });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Escaping the write/edit tools entirely
// ─────────────────────────────────────────────────────────────────────────────

describe('KERNEL_SELF_PROTECTION — shell bypasses', () => {
  it('denies a heredoc write to a governance policy', async () => {
    const cmd = `cat > .opencode/governance/protected-resources.json <<'EOF'\n{"enabled":false}\nEOF`;
    assertDenied(await attempt('bash', { command: cmd }), 'heredoc');
  });

  it('denies a heredoc write addressed by absolute path', async () => {
    const abs = join(FIXTURE, '.opencode', 'governance', 'protected-resources.json');
    const cmd = `cat > ${abs.split(sep).join('/')} <<'EOF'\n{"enabled":false}\nEOF`;
    assertDenied(await attempt('bash', { command: cmd }), 'heredoc absolute');
  });

  it('denies echo redirection into the enforcer', async () => {
    assertDenied(
      await attempt('bash', { command: `echo "// disabled" > .opencode/plugins/oage-enforce.js` }),
      'echo redirection',
    );
  });

  it('denies deleting a policy with rm', async () => {
    assertDenied(
      await attempt('bash', { command: 'rm .opencode/governance/protected-resources.json' }),
      'rm',
    );
  });

  it('denies deleting the whole governance directory', async () => {
    assertDenied(await attempt('bash', { command: 'rm -rf .opencode/governance' }), 'rm -rf');
  });

  it('denies moving a policy out of the way', async () => {
    assertDenied(
      await attempt('bash', { command: 'mv .opencode/governance/truth-gate.json /tmp/x.json' }),
      'mv',
    );
  });

  it('denies an in-place sed on the permissions matrix', async () => {
    assertDenied(
      await attempt('bash', { command: `sed -i 's/deny/allow/' .opencode/governance/permissions-matrix.json` }),
      'sed -i',
    );
  });

  it('denies reverting a policy via git checkout', async () => {
    assertDenied(
      await attempt('bash', { command: 'git checkout -- .opencode/governance/loop-detector.json' }),
      'git checkout',
    );
  });

  it('denies erasing the audit trail', async () => {
    assertDenied(await attempt('bash', { command: 'rm .opencode/audit/loop-state.json' }), 'rm loop-state');
  });

  it('denies a mutating clause hidden behind a benign one', async () => {
    assertDenied(
      await attempt('bash', { command: 'ls -la .opencode && rm .opencode/governance/risk-engine.json' }),
      'compound command',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Interpreter bypasses (P1.x) — `node -e`/`python -c`/`perl -e`/`ruby -e`/`pwsh -Command`
// can write files the shell-verb extractors never see, because the write happens inside
// interpreter code, not via a shell redirection or a mutating shell verb. The extractors
// must treat those as protected-resource writes, while leaving interpreter READS alone.
// ─────────────────────────────────────────────────────────────────────────────

describe('KERNEL_SELF_PROTECTION — interpreter bypasses', () => {
  it('denies a node -e writeFileSync into the governance contract', async () => {
    const cmd = `node -e "require('fs').writeFileSync('.opencode/governance/governance-contract.json','x')"`;
    assertDenied(await attempt('bash', { command: cmd }), 'node -e writeFileSync');
  });

  it('denies a node -e writeFileSync addressed by absolute path', async () => {
    const abs = join(FIXTURE, '.opencode', 'governance', 'governance-contract.json');
    const cmd = `node -e "require('fs').writeFileSync('${abs.split(sep).join('/')}','x')"`;
    assertDenied(await attempt('bash', { command: cmd }), 'node -e abs');
  });

  it('denies a node --eval writeFileSync into the audit trail', async () => {
    const cmd = `node --eval "require('fs').writeFileSync('.opencode/audit/audit.jsonl','x')"`;
    assertDenied(await attempt('bash', { command: cmd }), 'node --eval audit');
  });

  it('denies a python -c open(...,w) into governance', async () => {
    const cmd = `python -c "open('.opencode/governance/permissions-matrix.json','w').write('x')"`;
    assertDenied(await attempt('bash', { command: cmd }), 'python -c open w');
  });

  it('denies a python -c open(...,a) append into governance', async () => {
    const cmd = `python -c "open('.opencode/governance/state-machine.json','a').write('x')"`;
    assertDenied(await attempt('bash', { command: cmd }), 'python -c open a');
  });

  it('denies a ruby -e File.write into the enforcer itself', async () => {
    const cmd = `ruby -e "File.write('.opencode/plugins/oage-enforce.js','x')"`;
    assertDenied(await attempt('bash', { command: cmd }), 'ruby -e File.write');
  });

  it('denies a perl -e open(>file) into governance', async () => {
    const cmd = `perl -e 'open(my \\$fh, ">", ".opencode/governance/audit.json"); print \\$fh "x";'`;
    assertDenied(await attempt('bash', { command: cmd }), 'perl -e open >');
  });

  it('denies a pwsh -Command Set-Content into governance', async () => {
    const cmd = `pwsh -Command "Set-Content -Path .opencode\\governance\\truth-gate.json -Value x"`;
    assertDenied(await attempt('bash', { command: cmd }), 'pwsh Set-Content');
  });

  it('denies a node -e recursive rmSync of the whole governance directory', async () => {
    const cmd = `node -e "require('fs').rmSync('.opencode/governance',{recursive:true})"`;
    assertDenied(await attempt('bash', { command: cmd }), 'node rmSync dir');
  });

  it('denies an interpreter write hidden behind a benign clause', async () => {
    const cmd = `ls -la && node -e "require('fs').writeFileSync('.opencode/governance/risk-engine.json','x')"`;
    assertDenied(await attempt('bash', { command: cmd }), 'compound interpreter');
  });
});

describe('KERNEL_SELF_PROTECTION — interpreter reads stay allowed', () => {
  it('allows a node -e readFileSync of a governance file', async () => {
    const cmd = `node -e "console.log(require('fs').readFileSync('.opencode/governance/risk-engine.json','utf8'))"`;
    const error = await attempt('bash', { command: cmd });
    assert.equal(error, null, `node read must stay allowed, got: ${error?.message}`);
  });

  it('allows python -c reading a governance file', async () => {
    const cmd = `python -c "print(open('.opencode/governance/truth-gate.json').read())"`;
    const error = await attempt('bash', { command: cmd });
    assert.equal(error, null, `python read must stay allowed, got: ${error?.message}`);
  });

  it('allows an interpreter read with stdout redirected outside the project', async () => {
    const cmd = `node -e "console.log(require('fs').readFileSync('.opencode/governance/truth-gate.json'))" > /tmp/oage-out.txt`;
    const error = await attempt('bash', { command: cmd });
    assert.equal(error, null, `read + external redirect must stay allowed, got: ${error?.message}`);
  });

  it('allows bash node script.mjs with no protected path on the command line (accepted, documented limitation)', async () => {
    const error = await attempt('bash', { command: 'node script.mjs' });
    assert.equal(error, null, `node script.mjs must pass, got: ${error?.message}`);
  });

  it('allows bash python script.py with no protected path on the command line', async () => {
    const error = await attempt('bash', { command: 'python script.py' });
    assert.equal(error, null, `python script.py must pass, got: ${error?.message}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The mechanism the interpreter invariant rests on
// ─────────────────────────────────────────────────────────────────────────────

describe('extractInterpreterWrites — the interpreter detection primitive', () => {
  it('extracts a protected path from a node -e writeFileSync', () => {
    assert.deepEqual(
      extractInterpreterWrites(`node -e "require('fs').writeFileSync('.opencode/governance/governance-contract.json','x')"`),
      ['.opencode/governance/governance-contract.json'],
    );
  });

  it('extracts a protected path from a python -c open(...,w)', () => {
    assert.deepEqual(
      extractInterpreterWrites(`python -c "open('.opencode/governance/a.json','w').write('x')"`),
      ['.opencode/governance/a.json'],
    );
  });

  it('extracts a windows-spelled protected path from pwsh Set-Content', () => {
    assert.deepEqual(
      extractInterpreterWrites(`pwsh -Command "Set-Content -Path .opencode\\governance\\truth-gate.json -Value x"`),
      ['.opencode/governance/truth-gate.json'],
    );
  });

  it('extracts the protected directory itself for a recursive delete', () => {
    assert.deepEqual(
      extractInterpreterWrites(`node -e "require('fs').rmSync('.opencode/governance',{recursive:true})"`),
      ['.opencode/governance'],
    );
  });

  it('returns nothing for a node read', () => {
    assert.deepEqual(
      extractInterpreterWrites(`node -e "console.log(require('fs').readFileSync('.opencode/governance/a.json'))"`),
      [],
    );
  });

  it('returns nothing for a python read', () => {
    assert.deepEqual(
      extractInterpreterWrites(`python -c "print(open('.opencode/governance/a.json').read())"`),
      [],
    );
  });

  it('returns nothing for node script.mjs with no protected path on the command line', () => {
    assert.deepEqual(extractInterpreterWrites('node script.mjs'), []);
  });

  it('returns nothing for a non-interpreter shell command that mentions a governance path', () => {
    assert.deepEqual(extractInterpreterWrites('cat .opencode/governance/truth-gate.json | jq .'), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Secrets stay unreadable (the check that already worked — kept as a regression fence)
// ─────────────────────────────────────────────────────────────────────────────

describe('Protected reads', () => {
  for (const [form, target] of Object.entries(spellings('.env'))) {
    it(`denies reading .env — ${form}`, async () => {
      assertDenied(await attempt('read', { filePath: target }), `read .env ${form}`);
    });
  }

  it('denies reading a private key outside the project root', async () => {
    assertDenied(await attempt('read', { filePath: '/home/someone/.ssh/id_rsa' }), 'id_rsa outside root');
  });

  it('allows reading .env.example (explicit negation)', async () => {
    const error = await attempt('read', { filePath: '.env.example' });
    assert.equal(error, null, `.env.example should be readable, got: ${error?.message}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The gate must not be a blanket deny
// ─────────────────────────────────────────────────────────────────────────────

describe('No over-blocking', () => {
  it('does not treat an ordinary source write as a protected resource', async () => {
    const error = await attempt('write', { filePath: 'src/util.ts', content: 'export const y = 2;\n' });
    if (error) {
      assert.doesNotMatch(
        error.message,
        /(protegido|protected)/i,
        `src/util.ts must not hit protected-resources (got: ${error.message})`,
      );
    }
  });

  it('allows reading a governance file (only writes are restricted)', async () => {
    const error = await attempt('read', { filePath: '.opencode/governance/risk-engine.json' });
    assert.equal(error, null, `reading governance must stay allowed, got: ${error?.message}`);
  });

  it('does not flag a governance path in a non-mutating command', async () => {
    const paths = extractBashMutatedPaths('cat .opencode/governance/truth-gate.json | jq .');
    assert.deepEqual(paths, [], 'reading via cat is not a mutation');
  });

  it('does not flag operands of a sibling clause as mutated', async () => {
    const paths = extractBashMutatedPaths('cat .opencode/governance/a.json; rm build/tmp.txt');
    assert.deepEqual(paths, ['build/tmp.txt']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The mechanism the invariant rests on
// ─────────────────────────────────────────────────────────────────────────────

describe('canonicalTarget — the single normalization point', () => {
  const root = process.platform === 'win32' ? 'C:\\repo' : '/repo';
  const inside = process.platform === 'win32'
    ? 'C:\\repo\\.opencode\\governance\\a.json'
    : '/repo/.opencode/governance/a.json';

  it('reduces every spelling of an in-repo path to one relative form', () => {
    const expected = '.opencode/governance/a.json';
    assert.equal(canonicalTarget(root, '.opencode/governance/a.json'), expected);
    assert.equal(canonicalTarget(root, './.opencode/governance/a.json'), expected);
    assert.equal(canonicalTarget(root, inside), expected);
    assert.equal(canonicalTarget(root, inside.split('\\').join('/')), expected);
  });

  it('keeps an out-of-repo path absolute instead of relativizing with ..', () => {
    const outside = process.platform === 'win32' ? 'C:\\elsewhere\\id_rsa' : '/elsewhere/id_rsa';
    const result = canonicalTarget(root, outside);
    assert.ok(!result.startsWith('..'), `expected absolute, got ${result}`);
    assert.ok(matchesAny(result, ['**/id_rsa*']), 'out-of-repo secrets must still match');
  });

  it('resolves .. escapes rather than matching them literally', () => {
    const escaped = canonicalTarget(root, '.opencode/../../outside/x.json');
    assert.ok(!escaped.includes('..'), `.. must be resolved, got ${escaped}`);
  });

  it('root-anchored patterns match the canonical form', () => {
    const policy = JSON.parse(
      readFileSync(join(ROOT_DIR, 'templates', 'base', 'governance', 'protected-resources.json'), 'utf8'),
    );
    for (const target of [inside, '.opencode/governance/a.json', './.opencode/plugins/oage-enforce.js']) {
      assert.ok(
        matchesAny(target, policy.denyWritePatterns, root === '/repo' ? '/repo' : 'C:\\repo'),
        `shipped policy must deny ${target}`,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The block must be recorded, not silent
// ─────────────────────────────────────────────────────────────────────────────

describe('Audit trail of denials', () => {
  it('records a blocked event with the protected-resources gate', async () => {
    await attempt('write', { filePath: '.opencode/governance/ci-gate.json', content: '{}' });

    const auditFile = join(FIXTURE, '.opencode', 'audit', 'audit.jsonl');
    assert.ok(existsSync(auditFile), 'a denial must leave an audit record');

    const blocked = readFileSync(auditFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((r) => r.event === 'blocked' && r.gate === 'protected-resources');

    assert.ok(blocked.length > 0, 'no protected-resources denial found in audit.jsonl');
    assert.ok(blocked.every((r) => r.timestamp), 'every audit record needs a timestamp');
  });
});
