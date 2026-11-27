import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../worker/src/auth';

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra ?? '');
  }
}

console.log('\n[1] password hashing');
{
  const a = await hashPassword('correct horse battery staple');
  const b = await hashPassword('correct horse battery staple');
  ok('hash is not the plaintext', a.hash !== 'correct horse battery staple');
  ok('salt is 16 bytes base64', atob(a.salt).length === 16, a.salt);
  ok('two hashes use different salts', a.salt !== b.salt);
  ok('two hashes differ', a.hash !== b.hash);
  ok('correct password verifies', await verifyPassword('correct horse battery staple', a.hash, a.salt));
  ok('wrong password fails', !(await verifyPassword('wrong', a.hash, a.salt)));
  ok('empty password fails', !(await verifyPassword('', a.hash, a.salt)));
  ok('corrupt hash fails safely', !(await verifyPassword('x', 'not-base64!!', a.salt)));
}

console.log(`\n${passed} passed, ${failed} failed`);
assert.equal(failed, 0, `${failed} auth tests failed`);
