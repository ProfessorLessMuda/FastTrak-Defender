/**
 * Dispute Letter Generator — produces formal contest letters, admin review requests,
 * and court appeal templates with legal citations.
 */

const TOLL_AUTHORITY = {
  name: 'Bay Area FasTrak',
  department: 'Violation Processing Department',
  address: 'PO Box 26925',
  city: 'San Francisco',
  state: 'CA',
  zip: '94126',
  phone: '(877) 229-8655',
  fax: '415-974-6356'
};

function formatDate(dateStr) {
  if (!dateStr) return '[DATE]';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function today() {
  return formatDate(new Date().toISOString().split('T')[0]);
}

/**
 * Generate a Section A Contest Letter.
 */
function generateContestLetter(violation, defenses, options = {}) {
  const { tone = 'formal', includeStatistics = true, senderName = '', senderAddress = '' } = options;
  const enabledDefenses = defenses.filter(d => d.enabled !== false);

  let letter = '';

  // Header
  letter += `${senderName || '[YOUR NAME]'}\n`;
  letter += `${senderAddress || '[YOUR ADDRESS]'}\n`;
  letter += `\n`;
  letter += `${today()}\n\n`;
  letter += `${TOLL_AUTHORITY.name}\n`;
  letter += `${TOLL_AUTHORITY.department}\n`;
  letter += `${TOLL_AUTHORITY.address}\n`;
  letter += `${TOLL_AUTHORITY.city}, ${TOLL_AUTHORITY.state} ${TOLL_AUTHORITY.zip}\n\n`;

  // Re line
  letter += `Re: Contested Notice of Toll Evasion Violation\n`;
  letter += `    Violation Number: ${violation.violationNumber || '[VIOLATION NUMBER]'}\n`;
  letter += `    License Plate: ${violation.plateState || 'CA'} ${violation.plate || '[PLATE]'}\n`;
  letter += `    Date of Alleged Violation: ${formatDate(violation.violationDate)}\n\n`;

  // Opening
  const openings = {
    formal: 'Dear Sir or Madam,',
    firm: 'To Whom It May Concern:',
    aggressive: 'To the Violation Processing Department:'
  };
  letter += `${openings[tone] || openings.formal}\n\n`;

  letter += `I am writing to contest the above-referenced toll evasion violation pursuant to California Vehicle Code Section 40255. `;
  letter += `I do not believe I owe the amount shown on the notice, and I am requesting an investigation of the items which constitute my defense against liability.\n\n`;

  // Factual section
  letter += `FACTUAL BACKGROUND\n\n`;
  letter += `The notice alleges that a vehicle bearing California license plate ${violation.plate || '[PLATE]'} `;
  letter += `crossed the ${violation.location || '[LOCATION]'} on ${formatDate(violation.violationDate)} `;
  letter += `at approximately ${violation.violationTime || '[TIME]'}`;
  if (violation.lane) letter += ` in Lane ${violation.lane}`;
  letter += `. The notice assesses a toll of $${(violation.tollAmount || 0).toFixed(2)} `;
  letter += `and a penalty of $${(violation.penaltyAmount || 0).toFixed(2)}, `;
  letter += `for a total of $${(violation.totalDue || 0).toFixed(2)}.\n\n`;

  // Defense arguments
  letter += `GROUNDS FOR CONTEST\n\n`;

  enabledDefenses.forEach((defense, idx) => {
    letter += `${idx + 1}. ${defense.title}\n\n`;
    defense.arguments.forEach(arg => {
      letter += `${arg}\n\n`;
    });
    if (defense.legalBasis) {
      letter += `Legal Basis: ${defense.legalBasis}\n\n`;
    }
  });

  // Statistics section
  if (includeStatistics && enabledDefenses.some(d => d.category === 'vehicle-id')) {
    letter += `STATISTICAL CONTEXT\n\n`;
    letter += `The vehicle described in the notice — a ${violation.vehicleDescription || 'common vehicle'} — is one of the most prevalent vehicles on California roads. `;
    letter += `According to California DMV registration data, tens of thousands of vehicles matching this description `;
    letter += `(same make, model, and color) are currently registered in the state. `;
    letter += `Without clear, unambiguous photographic evidence showing the license plate of the vehicle in question, `;
    letter += `the mere presence of a similar vehicle at the toll point cannot establish that it was my vehicle.\n\n`;
  }

  // Relief requested
  letter += `RELIEF REQUESTED\n\n`;

  const reliefs = {
    formal: `Based on the foregoing, I respectfully request that this violation be dismissed in its entirety. In the alternative, I request a waiver of all penalty amounts pursuant to the agency's first-violation waiver policy and CVC 40258.`,
    firm: `For the reasons stated above, I request the immediate dismissal of this violation. The evidence presented is insufficient to establish that my vehicle committed the alleged violation. In the alternative, all penalties should be waived pursuant to CVC 40258.`,
    aggressive: `I demand the dismissal of this violation. The issuing agency has failed to meet its burden of proof. The photographic evidence is wholly insufficient to identify my vehicle. If this violation is not dismissed, I intend to exercise my rights under CVC 40255 to request an administrative review, and if necessary, to appeal to the Superior Court under CVC 40256.`
  };
  letter += `${reliefs[tone] || reliefs.formal}\n\n`;

  // Notice of rights
  letter += `I am aware of my rights under California Vehicle Code Sections 40255 and 40256, including the right to an administrative review and subsequent appeal to the Superior Court.\n\n`;

  // Closing
  const closings = {
    formal: 'Thank you for your prompt attention to this matter.',
    firm: 'I expect a timely response to this contest.',
    aggressive: 'I expect this matter to be resolved promptly and in my favor.'
  };
  letter += `${closings[tone] || closings.formal}\n\n`;
  letter += `Sincerely,\n\n\n`;
  letter += `${senderName || '[YOUR NAME]'}\n`;
  letter += `${senderAddress || '[YOUR ADDRESS]'}\n`;

  return letter;
}

/**
 * Generate an Administrative Review Request per CVC 40255.
 */
function generateAdminReviewRequest(violation, options = {}) {
  const { senderName = '', senderAddress = '' } = options;

  let letter = '';
  letter += `${senderName || '[YOUR NAME]'}\n`;
  letter += `${senderAddress || '[YOUR ADDRESS]'}\n\n`;
  letter += `${today()}\n\n`;
  letter += `${TOLL_AUTHORITY.name}\n`;
  letter += `${TOLL_AUTHORITY.department}\n`;
  letter += `${TOLL_AUTHORITY.address}\n`;
  letter += `${TOLL_AUTHORITY.city}, ${TOLL_AUTHORITY.state} ${TOLL_AUTHORITY.zip}\n\n`;
  letter += `Re: Request for Administrative Review\n`;
  letter += `    Violation Number: ${violation.violationNumber || '[VIOLATION NUMBER]'}\n`;
  letter += `    License Plate: ${violation.plateState || 'CA'} ${violation.plate || '[PLATE]'}\n\n`;
  letter += `Dear Sir or Madam,\n\n`;
  letter += `Pursuant to California Vehicle Code Section 40255, I hereby request an administrative review of the above-referenced toll evasion violation. `;
  letter += `I am not satisfied with the results of the initial investigation and wish to present my case before an impartial reviewer.\n\n`;
  letter += `I request that the review be conducted:\n`;
  letter += `[ ] In person\n`;
  letter += `[ ] By teleconference\n`;
  letter += `[X] By written submission\n\n`;
  letter += `I have previously deposited the amount due pursuant to CVC 40255 and understand that this deposit will be refunded if the review is decided in my favor.\n\n`;
  letter += `I reserve all rights under CVC 40256 to appeal the administrative review decision to the Superior Court.\n\n`;
  letter += `Sincerely,\n\n\n`;
  letter += `${senderName || '[YOUR NAME]'}\n`;

  return letter;
}

/**
 * Generate a Superior Court Appeal template per CVC 40256.
 */
function generateCourtAppeal(violation, options = {}) {
  const { senderName = '', senderAddress = '' } = options;

  let letter = '';
  letter += `[SUPERIOR COURT APPEAL TEMPLATE — CVC 40256]\n\n`;
  letter += `NOTE: This is a template for guidance only. Consult an attorney for actual court filings.\n\n`;
  letter += `IN THE SUPERIOR COURT OF THE STATE OF CALIFORNIA\n`;
  letter += `COUNTY OF [COUNTY]\n\n`;
  letter += `${senderName || '[YOUR NAME]'},\n`;
  letter += `    Appellant,\n\n`;
  letter += `vs.\n\n`;
  letter += `BAY AREA TOLL AUTHORITY,\n`;
  letter += `    Respondent.\n\n`;
  letter += `Case No.: [TO BE ASSIGNED]\n\n`;
  letter += `NOTICE OF APPEAL FROM ADMINISTRATIVE REVIEW DECISION\n\n`;
  letter += `TO THE CLERK OF THE ABOVE-ENTITLED COURT:\n\n`;
  letter += `Appellant ${senderName || '[YOUR NAME]'} hereby appeals the administrative review decision dated [DECISION DATE] regarding toll evasion violation number ${violation.violationNumber || '[VIOLATION NUMBER]'}.\n\n`;
  letter += `This appeal is filed pursuant to California Vehicle Code Section 40256, within 20 days of the administrative review decision.\n\n`;
  letter += `GROUNDS FOR APPEAL:\n\n`;
  letter += `1. The administrative review decision was not supported by the evidence.\n`;
  letter += `2. The photographic evidence was insufficient to identify the vehicle.\n`;
  letter += `3. [ADDITIONAL GROUNDS]\n\n`;
  letter += `Appellant requests that the Court reverse the administrative decision and order a refund of all amounts deposited.\n\n`;
  letter += `Dated: ${today()}\n\n`;
  letter += `_________________________\n`;
  letter += `${senderName || '[YOUR NAME]'}\n`;
  letter += `${senderAddress || '[YOUR ADDRESS]'}\n`;
  letter += `Appellant, In Pro Per\n`;

  return letter;
}

module.exports = { generateContestLetter, generateAdminReviewRequest, generateCourtAppeal, TOLL_AUTHORITY };
