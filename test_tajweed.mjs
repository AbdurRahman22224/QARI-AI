import { renderTajweed } from './frontend/src/utils/tajweedUtils.js';

const input = 'ذ<tajweed class=madda_normal>َٰ</tajweed>';
const output = renderTajweed(input);

console.log('--- TEST: Dhalika ---');
console.log('Input:  ' + input);
console.log('Output: ' + output);

if (output.includes('taj-base') && output.includes('taj-madd')) {
    console.log('SUCCESS: Both spans present.');
} else {
    console.error('FAILURE: Missing expected spans.');
}

const input2 = 'ذَ<tajweed class=madda_normal>ٰ</tajweed>';
const output2 = renderTajweed(input2);
console.log('\n--- TEST: Dhalika (Mark-only tag) ---');
console.log('Input:  ' + input2);
console.log('Output: ' + output2);
if (output2.includes('taj-base') && output2.includes('ذ')) {
  console.log('SUCCESS: Letter was stolen as anchor.');
} else {
  console.error('FAILURE: Letter was NOT stolen.');
}
