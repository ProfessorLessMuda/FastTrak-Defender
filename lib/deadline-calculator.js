/**
 * CVC-based deadline computation for California toll violations.
 * All deadlines per California Vehicle Code 40250-40273.
 */

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  return daysBetween(today, dateStr);
}

/**
 * Calculate all relevant deadlines for a violation.
 * @param {Object} violation - Violation record
 * @returns {Object} deadlines with dates and status
 */
function calculateDeadlines(violation) {
  const today = new Date().toISOString().split('T')[0];
  const deadlines = [];

  // Payment due date
  if (violation.dueDate) {
    const daysLeft = daysUntil(violation.dueDate);
    deadlines.push({
      type: 'payment',
      label: 'Payment Due (before escalation)',
      date: violation.dueDate,
      daysLeft,
      status: daysLeft < 0 ? 'overdue' : daysLeft <= 5 ? 'urgent' : 'upcoming',
      description: `Pay $${violation.totalDue} to avoid escalation to $${violation.escalatedAmount}`
    });
  }

  // Contest deadline: 30 days from notice date (CVC 40255)
  if (violation.noticeDate) {
    const contestDeadline = addDays(violation.noticeDate, 30);
    const daysLeft = daysUntil(contestDeadline);
    deadlines.push({
      type: 'contest',
      label: 'Contest Deadline (30 days from notice)',
      date: contestDeadline,
      daysLeft,
      status: daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'urgent' : 'upcoming',
      legalBasis: 'CVC 40255',
      description: 'File Section A Contested Notice of Toll Evasion'
    });
  }

  // First notice timeliness check: must be within 21 days of violation (CVC 40254(a))
  if (violation.violationDate) {
    const firstNoticeDeadline = addDays(violation.violationDate, 21);
    deadlines.push({
      type: 'first-notice-check',
      label: 'First Notice Should Have Been Sent By',
      date: firstNoticeDeadline,
      daysLeft: null,
      status: 'reference',
      legalBasis: 'CVC 40254(a)',
      description: 'If first notice was sent after this date, it may be a procedural defect'
    });
  }

  // Administrative review: 15 days after investigation results (CVC 40255)
  deadlines.push({
    type: 'admin-review',
    label: 'Administrative Review Request',
    date: null,
    daysLeft: null,
    status: 'pending-trigger',
    legalBasis: 'CVC 40255',
    description: '15 days from mailing date of investigation results to request administrative review'
  });

  // Superior Court appeal: 20 days after admin review decision (CVC 40256)
  deadlines.push({
    type: 'court-appeal',
    label: 'Superior Court Appeal',
    date: null,
    daysLeft: null,
    status: 'pending-trigger',
    legalBasis: 'CVC 40256',
    description: '20 days from administrative review decision to file appeal in Superior Court'
  });

  return deadlines;
}

/**
 * Get the most urgent deadline for a violation.
 */
function getMostUrgent(violation) {
  const deadlines = calculateDeadlines(violation);
  const actionable = deadlines.filter(d => d.daysLeft !== null && d.daysLeft >= 0);
  actionable.sort((a, b) => a.daysLeft - b.daysLeft);
  return actionable[0] || null;
}

module.exports = { calculateDeadlines, getMostUrgent, addDays, daysBetween, daysUntil };
