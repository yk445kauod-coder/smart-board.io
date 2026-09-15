import { THEMES, defaultInk, isDarkTheme } from '../data/themes';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('[classroom-toolkit] running tests...');

// 1. Theme Presets Smoke Test
assert(THEMES.white.bg === '#F8FAFC', 'White theme bg should be #F8FAFC');
assert(THEMES.chalk.bg === '#14382A', 'Chalkboard theme bg should be #14382A');
assert(THEMES.black.bg === '#080D1E', 'Cosmic dark theme bg should be #080D1E');

assert(defaultInk('white') === '#080D1E', 'White theme default ink should be dark');
assert(defaultInk('chalk') === '#ffffff', 'Chalkboard theme default ink should be white');
assert(defaultInk('black') === '#00E5FF', 'Dark theme default ink should be orbital cyan');

assert(!isDarkTheme('white'), 'White theme is not dark');
assert(isDarkTheme('chalk'), 'Chalkboard theme is dark');
assert(isDarkTheme('black'), 'Black theme is dark');

console.log('✓ Themes & color tokens verified.');

// 2. Timer Formatting Helper Test
function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

assert(formatTime(300) === '05:00', '300s formats to 05:00');
assert(formatTime(65) === '01:05', '65s formats to 01:05');
assert(formatTime(0) === '00:00', '0s formats to 00:00');

console.log('✓ Activity timer format logic verified.');

// 3. Calculator Expression Evaluator Test
function evaluateExpression(exprString: string): number {
  let expr = exprString
    .replace(/sin/g, 'Math.sin')
    .replace(/cos/g, 'Math.cos')
    .replace(/tan/g, 'Math.tan')
    .replace(/sqrt/g, 'Math.sqrt')
    .replace(/π/g, 'Math.PI')
    .replace(/\^/g, '**');

  return Function(`'use strict'; return (${expr})`)();
}

assert(evaluateExpression('2+3*4') === 14, 'Basic arithmetic calculation');
assert(evaluateExpression('sqrt(16)') === 4, 'Scientific sqrt function');
assert(Math.abs(evaluateExpression('sin(0)')) < 0.0001, 'Trigonometric sin(0)');

console.log('✓ Calculator evaluation logic verified.');

// 4. Student Wheel Selection Index Logic Test
function getWinnerIndex(totalRotation: number, numStudents: number): number {
  const normalizedAngle = (360 - (totalRotation % 360)) % 360;
  const sliceSize = 360 / numStudents;
  return Math.floor(normalizedAngle / sliceSize);
}

const students = ['Ahmad', 'Sara', 'Omar', 'Mariam'];
const winnerIndex = getWinnerIndex(720, students.length);
assert(winnerIndex >= 0 && winnerIndex < students.length, 'Winner index within bounds');

console.log('✓ Student Wheel selection logic verified.');
console.log('ALL CLASSROOM TOOLKIT TESTS PASSED SUCCESSFULLY!');
