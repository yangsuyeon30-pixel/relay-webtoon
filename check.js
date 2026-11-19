// Syntax + chunk-math check for the relay webtoon app.
// Lives in the workspace (NOT /tmp — /tmp was wiped by a VM replacement on 2026-11-17).
// Run: node check.js  (from ~/workspace/relay-webtoon-app/)
const fs = require('fs');
const vm = require('vm');
const dir = __dirname;

const common = fs.readFileSync(dir + '/common.js', 'utf8');
new vm.Script(common, { filename: 'common.js' });
console.log('common.js syntax OK');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(common + '\n;globalThis.__t = { teamChunk, chunkOwner, relayAuthor, chunkLabel, PANELS, BUBBLES_PER_PANEL, RESET_CONFIG_ID };', sandbox);
const t = sandbox.__t;

for (const page of ['index.html', 'write.html', 'result.html', 'admin.html']) {
  const html = fs.readFileSync(dir + '/' + page, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  scripts.forEach((s, i) => new vm.Script(s, { filename: page + '#' + i }));
  console.log(page + ' ' + scripts.length + ' inline script(s) OK');
}

function assert(cond, msg) { if (!cond) throw new Error('ASSERT FAILED: ' + msg); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

assert(t.PANELS.length === 15, 'PANELS.length should be 15, got ' + t.PANELS.length);
assert(t.BUBBLES_PER_PANEL === 2, 'BUBBLES_PER_PANEL should be 2');
assert(t.RESET_CONFIG_ID === 5, 'RESET_CONFIG_ID should be 5');

// 15 panels / 8 teams -> teams 1-7 get 2, team 8 gets 1
assert(eq(Array.from({ length: 15 }, (_, p) => t.chunkOwner(p, 8, 15)), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8]), 'chunkOwner 15/8');
assert(eq(t.teamChunk(1, 8, 15), { start: 0, end: 1, size: 2 }), 'teamChunk(1,8,15)');
assert(eq(t.teamChunk(8, 8, 15), { start: 14, end: 14, size: 1 }), 'teamChunk(8,8,15)');

// 15 panels / 9 teams (current live setting) -> teams 1-6 get 2, teams 7-9 get 1
assert(eq(t.teamChunk(6, 9, 15), { start: 10, end: 11, size: 2 }), 'teamChunk(6,9,15)');
assert(eq(t.teamChunk(9, 9, 15), { start: 14, end: 14, size: 1 }), 'teamChunk(9,9,15)');

// Every panel covered exactly once, chunks contiguous, for several combos
for (const [n, pc] of [[8, 15], [9, 15], [2, 5], [6, 15], [15, 15], [3, 10]]) {
  const owners = Array.from({ length: pc }, (_, p) => t.chunkOwner(p, n, pc));
  assert(new Set(owners).size === Math.min(n, pc), 'coverage ' + n + '/' + pc);
  for (let team = 1; team <= n; team++) {
    const ch = t.teamChunk(team, n, pc);
    if (team <= pc) {
      assert(ch && ch.size >= 1, 'chunk exists ' + team + ' ' + n + '/' + pc);
      for (let p = ch.start; p <= ch.end; p++) assert(t.chunkOwner(p, n, pc) === team, 'chunk owner match');
    } else {
      assert(ch === null, 'no chunk when team > panels');
    }
  }
}
console.log('CHUNK TESTS PASS');
