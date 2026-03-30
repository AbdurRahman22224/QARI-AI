
import { renderTajweed, TAJWEED_COLORS } from './frontend/src/utils/tajweedUtils.js';

// Mocking the API response for 1:7
const ayah_1_7_html = 'صِر<tajweed class=madda_normal>َٲ</tajweed>طَ <tajweed class=ham_wasl>ٱ</tajweed>لَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ <tajweed class=ham_wasl>ٱ</tajweed>لْمَغْضُوبِ عَلَيْهِمْ وَلَا <tajweed class=ham_wasl>ٱ</tajweed><tajweed class=laam_shamsiyah>ل</tajweed>ضّ<tajweed class=madda_necessary>َا</tajweed>ٓلّ<tajweed class=madda_permissible>ِي</tajweed>نَ';

const result = renderTajweed(ayah_1_7_html, 'kasra', false);

console.log("--- Ayah 1:7 Rendering Audit ---");
console.log(result);

// Check if 'Sirata' Ra is pink
if (result.includes('color: #F48FB1') && result.includes('ر')) {
  console.log("Issue Found: 'Ra' in Sirata is Pink (Normal Madd override)");
}

// Check if 'Ad-Dallin' Daad is black
if (!result.includes('color: #6169da') && result.includes('ضّ')) {
  console.log("Issue Found: 'Daad' in Ad-Dallin is Black (Manual Tafkhim missed)");
}

// Check if Madda Necessary is pink (Incorrect, should be Red)
if (result.includes('color: #F48FB1') && result.includes('َا')) {
  console.log("Issue Found: 'Necessary Madd' is Pink (Mapping error)");
}
