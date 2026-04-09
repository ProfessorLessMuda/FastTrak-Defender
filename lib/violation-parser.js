/**
 * PDF text extraction and violation data parsing.
 * Extracts structured violation data from FasTrak notice PDFs.
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract text from a PDF buffer using pdf-parse.
 */
async function extractPdfText(buffer) {
  const pdfParse = require('pdf-parse');
  const result = await pdfParse(buffer);
  return result.text;
}

/**
 * Parse violation details from extracted PDF text.
 * Returns structured violation data or null if not a recognizable violation notice.
 */
function parseViolationText(text) {
  if (!text) return null;

  const violation = {};

  // Violation number pattern: T followed by digits
  const violNumMatch = text.match(/T\d{12,}/);
  if (violNumMatch) violation.violationNumber = violNumMatch[0];

  // License plate: CA followed by plate chars
  const plateMatch = text.match(/CA\s+([A-Z0-9]+)/);
  if (plateMatch) {
    violation.plateState = 'CA';
    violation.plate = plateMatch[1];
  }

  // Notice date: MM/DD/YY or MM/DD/YYYY after "NOTICE DATE"
  const noticeDateMatch = text.match(/NOTICE\s*DATE[:\s]*(\d{2}\/\d{2}\/\d{2,4})/i);
  if (noticeDateMatch) {
    violation.noticeDate = normalizeDate(noticeDateMatch[1]);
  }

  // Due date
  const dueDateMatch = text.match(/DUE\s*DATE[:\s]*(\d{2}\/\d{2}\/\d{2,4})/i);
  if (dueDateMatch) {
    violation.dueDate = normalizeDate(dueDateMatch[1]);
  }

  // Amount due
  const amountMatch = text.match(/AMOUNT\s*DUE[:\s]*\$?([\d.]+)/i);
  if (amountMatch) {
    violation.totalDue = parseFloat(amountMatch[1]);
  }

  // Transaction details: Make, Plaza, Lane, Date, Time, Toll, Penalty
  const txMatch = text.match(/([A-Z]{4})\s+(BEN|GGB|RSR|SMH|ANT|CAR|DUM)\s+(\d+)\s+(\d{2}\/\d{2}\/\d{2,4})\s+(\d{2}:\d{2})\s+\$?([\d.]+)\s+\$?([\d.]+)/);
  if (txMatch) {
    violation.vehicleMake = txMatch[1];
    violation.location = getPlazaName(txMatch[2]);
    violation.lane = txMatch[3];
    violation.violationDate = normalizeDate(txMatch[4]);
    violation.violationTime = txMatch[5];
    violation.tollAmount = parseFloat(txMatch[6]);
    violation.penaltyAmount = parseFloat(txMatch[7]);
    violation.totalDue = violation.tollAmount + violation.penaltyAmount;
  }

  // Escalated amount
  const escalatedMatch = text.match(/AMOUNT\s*DUE\s*AFTER[^$]*\$?([\d.]+)/i);
  if (escalatedMatch) {
    violation.escalatedAmount = parseFloat(escalatedMatch[1]);
  }

  // Notice type
  if (text.includes('SECOND NOTICE') || text.includes('Second and Final')) {
    violation.noticeType = 'Second Notice / Final Notice';
  } else if (text.includes('FIRST NOTICE') || text.includes('Notice of Toll Evasion')) {
    violation.noticeType = 'First Notice';
  }

  return Object.keys(violation).length > 0 ? violation : null;
}

function normalizeDate(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  let [month, day, year] = parts;
  if (year.length === 2) year = (parseInt(year) > 50 ? '19' : '20') + year;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function getPlazaName(code) {
  const plazas = {
    BEN: 'Benicia-Martinez Bridge',
    GGB: 'Golden Gate Bridge',
    RSR: 'Richmond-San Rafael Bridge',
    SMH: 'San Mateo-Hayward Bridge',
    ANT: 'Antioch Bridge',
    CAR: 'Carquinez Bridge',
    DUM: 'Dumbarton Bridge'
  };
  return plazas[code] || code;
}

module.exports = { extractPdfText, parseViolationText, normalizeDate, getPlazaName };
