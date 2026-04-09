/**
 * Defense Strategy Engine — analyzes violation data and generates applicable defenses.
 * Reads from defense-library.json for templates, scores them against violation characteristics.
 */

const fs = require('fs');
const path = require('path');

const HIGH_VOLUME_MAKES = ['TSMR', 'TOYT', 'HOND', 'FORD', 'CHEV', 'NISS', 'BMW', 'MERZ', 'HYUN', 'KIA'];
const HIGH_VOLUME_LABELS = {
  TSMR: 'Tesla',
  TOYT: 'Toyota',
  HOND: 'Honda',
  FORD: 'Ford',
  CHEV: 'Chevrolet',
  NISS: 'Nissan',
  BMW: 'BMW',
  MERZ: 'Mercedes-Benz',
  HYUN: 'Hyundai',
  KIA: 'Kia'
};

/**
 * Load defense library templates from JSON file.
 */
function loadLibrary(dataDir) {
  const libPath = path.join(dataDir, 'defense-library.json');
  try {
    return JSON.parse(fs.readFileSync(libPath, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Determine if a time string represents nighttime (after sunset / before sunrise).
 */
function isNighttime(timeStr) {
  if (!timeStr) return false;
  const hour = parseInt(timeStr.split(':')[0], 10);
  return hour >= 18 || hour < 6;
}

/**
 * Analyze a violation and generate applicable defense strategies.
 * @param {Object} violation - The violation record
 * @param {Object[]} existingDefenses - Already-created defenses for this violation
 * @param {string} dataDir - Path to data directory
 * @returns {Object[]} Array of defense recommendations
 */
function analyzeViolation(violation, existingDefenses = [], dataDir) {
  const library = loadLibrary(dataDir);
  const recommendations = [];

  // 1. Photo Evidence Weakness — always applicable
  const photoDefense = library.find(d => d.category === 'photo-evidence') || {};
  const photoStrength = (!violation.photoDescription || violation.photoQuality === 'poor' ||
    (violation.photoDescription && violation.photoDescription.toLowerCase().includes('no') &&
     violation.photoDescription.toLowerCase().includes('plate'))) ? 'strong' : 'moderate';

  recommendations.push({
    category: 'photo-evidence',
    title: photoDefense.title || 'Photographic Evidence Is Insufficient',
    strength: photoStrength,
    legalBasis: 'CVC 40250; Due Process Clause',
    arguments: [
      'The photograph provided does not display a clearly legible license plate number.',
      'Without a readable plate in the photograph, there is insufficient evidence to identify the specific vehicle.',
      'The burden of proof lies with the issuing agency to demonstrate the vehicle in the photograph is registered to the respondent.',
      'A front-view photograph without a visible license plate cannot establish ownership or identity of the vehicle.'
    ],
    supportingFacts: violation.photoDescription ? [violation.photoDescription] : [],
    matchReason: 'Applicable to all toll violations — photo evidence is the primary identification method'
  });

  // 2. Vehicle Identification Challenge — stronger for high-volume vehicles
  const isHighVolume = HIGH_VOLUME_MAKES.includes(violation.vehicleMake);
  const makeLabel = HIGH_VOLUME_LABELS[violation.vehicleMake] || violation.vehicleMake;

  if (isHighVolume) {
    recommendations.push({
      category: 'vehicle-id',
      title: `${makeLabel} Is One of the Most Common Vehicles in California`,
      strength: 'strong',
      legalBasis: 'CVC 40250; Evidence sufficiency',
      arguments: [
        `${makeLabel} vehicles are among the most registered in California, with tens of thousands on the road.`,
        'White is the most popular color for this vehicle make, further increasing the number of visually identical vehicles.',
        'The combination of color and make alone describes thousands of vehicles in the state.',
        'Without a clearly identifiable license plate, color and vehicle make cannot establish that the vehicle belongs to the respondent.',
        'The issuing agency has not met its burden of establishing that this specific vehicle, rather than any of the thousands of similar vehicles, committed the alleged violation.'
      ],
      supportingFacts: [
        `Vehicle make code: ${violation.vehicleMake} (${makeLabel})`,
        violation.vehicleDescription || ''
      ].filter(Boolean),
      matchReason: `${makeLabel} is a high-volume vehicle in California`
    });
  }

  // 3. Procedural Defects
  const proceduralArgs = [];
  const proceduralFacts = [];

  if (violation.noticeType && violation.noticeType.toLowerCase().includes('second')) {
    proceduralArgs.push(
      'This notice is labeled as a "Second Notice," yet I have no record of receiving a valid first notice.',
      'If the first notice was not properly served, this second notice lacks proper foundation under CVC 40254.'
    );
    proceduralFacts.push('Notice type: ' + violation.noticeType);
  }

  if (violation.violationDate && violation.noticeDate) {
    const violDate = new Date(violation.violationDate);
    const noticeDate = new Date(violation.noticeDate);
    const daysDiff = Math.ceil((noticeDate - violDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 21) {
      proceduralArgs.push(
        `The notice was dated ${daysDiff} days after the alleged violation, potentially exceeding the 21-day requirement under CVC 40254(a).`
      );
      proceduralFacts.push(`Days between violation and notice: ${daysDiff}`);
    }
  }

  proceduralArgs.push(
    'The notice must include the approximate time, date, and location of the violation, as well as the specific Vehicle Code section violated (CVC 40254).',
    'Any deficiency in the required notice content is grounds for dismissal.'
  );

  recommendations.push({
    category: 'procedural',
    title: 'Procedural Defects in Notice and Service',
    strength: proceduralFacts.length > 0 ? 'moderate' : 'weak',
    legalBasis: 'CVC 40254(a); CVC 40255',
    arguments: proceduralArgs,
    supportingFacts: proceduralFacts,
    matchReason: 'Procedural compliance is always reviewable'
  });

  // 4. Technology/Camera Reliability
  const techArgs = [
    'Automated toll collection systems rely on camera-based license plate recognition, which has documented error rates.',
    'The issuing agency should produce maintenance and calibration records for the camera system at the specific lane and location.',
    'Automatic License Plate Recognition (ALPR) systems have known misread rates, particularly for certain plate configurations.'
  ];
  const techFacts = [];
  let techStrength = 'moderate';

  if (isNighttime(violation.violationTime)) {
    techArgs.push(
      `The alleged violation occurred at ${violation.violationTime} (nighttime), when reduced lighting conditions significantly degrade camera image quality and ALPR accuracy.`
    );
    techFacts.push(`Nighttime crossing: ${violation.violationTime}`);
    techStrength = 'strong';
  }

  if (violation.lane) {
    techArgs.push(
      `Calibration and maintenance records for Lane ${violation.lane} at ${violation.location || 'the toll plaza'} should be produced to verify system accuracy.`
    );
  }

  recommendations.push({
    category: 'technology',
    title: 'Camera and ALPR System Reliability',
    strength: techStrength,
    legalBasis: 'Due Process; Evidence reliability',
    arguments: techArgs,
    supportingFacts: techFacts,
    matchReason: isNighttime(violation.violationTime) ? 'Nighttime crossing degrades camera accuracy' : 'Camera reliability is always challengeable'
  });

  // 5. First Violation Leniency
  recommendations.push({
    category: 'first-violation',
    title: 'First Violation — Penalty Waiver Eligibility',
    strength: 'moderate',
    legalBasis: 'CVC 40258; Agency administrative policy',
    arguments: [
      'CVC 40258 limits the penalty for a first violation to no more than $100.',
      'Many toll agencies have administrative policies that waive penalties for first-time offenders who subsequently open a FasTrak account or demonstrate compliance.',
      'In the alternative to full dismissal, the respondent requests a waiver of all penalty amounts, leaving only the base toll amount (if liability is established).',
      'The FasTrak system itself offers first-violation account signup as a resolution path, acknowledging that first violations often result from unfamiliarity rather than intentional evasion.'
    ],
    supportingFacts: [
      'This is the first known violation for this license plate in the system'
    ],
    matchReason: 'First violation leniency is always worth raising as alternative relief'
  });

  return recommendations;
}

module.exports = { analyzeViolation, loadLibrary };
