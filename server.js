require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const DataStore = require('./lib/data-store');
const { analyzeViolation } = require('./lib/defense-engine');
const { generateContestLetter, generateAdminReviewRequest, generateCourtAppeal } = require('./lib/letter-generator');
const { calculateDeadlines, getMostUrgent } = require('./lib/deadline-calculator');
const { extractPdfText, parseViolationText } = require('./lib/violation-parser');

const app = express();
const PORT = process.env.PORT || 3018;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS for hub/LaunchPad
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Ensure directories exist
const DIRS = ['data', 'public', 'cases', '01-Input', '02-Evidence', '03-Research', '04-Correspondence', '05-Exports'];
DIRS.forEach(dir => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// Data stores
const cases = new DataStore(path.join(__dirname, 'data', 'cases.json'));
const violations = new DataStore(path.join(__dirname, 'data', 'violations.json'));
const defenses = new DataStore(path.join(__dirname, 'data', 'defenses.json'));
const timeline = new DataStore(path.join(__dirname, 'data', 'timeline.json'));
const letters = new DataStore(path.join(__dirname, 'data', 'letters.json'));

// File upload
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Health & Stats ──────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ ok: true, port: PORT }));

app.get('/api/stats', (req, res) => {
  const allCases = cases.getAll();
  const allViolations = violations.getAll();
  const allLetters = letters.getAll();
  const activeCases = allCases.filter(c => !['resolved', 'dismissed', 'paid'].includes(c.status));

  let urgentDeadline = null;
  for (const v of allViolations) {
    const d = getMostUrgent(v);
    if (d && (urgentDeadline === null || d.daysLeft < urgentDeadline.daysLeft)) {
      urgentDeadline = d;
    }
  }

  res.json({
    name: 'Fast Track Defender',
    status: 'online',
    cases: allCases.length,
    activeCases: activeCases.length,
    violations: allViolations.length,
    letters: allLetters.length,
    urgentDeadline: urgentDeadline ? `${urgentDeadline.daysLeft}d — ${urgentDeadline.label}` : null
  });
});

// ── Dashboard ───────────────────────────────────────────────────────────────

app.get('/api/dashboard', (req, res) => {
  const allCases = cases.getAll();
  const allViolations = violations.getAll();
  const allDefenses = defenses.getAll();
  const allLetters = letters.getAll();

  const totalDue = allViolations.reduce((sum, v) => sum + (v.totalDue || 0), 0);
  const activeCases = allCases.filter(c => !['resolved', 'dismissed', 'paid'].includes(c.status));

  // Calculate deadlines for all active violations
  const deadlineAlerts = [];
  for (const v of allViolations.filter(v => v.status === 'active' || v.status === 'contested')) {
    const dl = calculateDeadlines(v);
    dl.filter(d => d.daysLeft !== null && d.daysLeft >= 0 && d.daysLeft <= 30)
      .forEach(d => deadlineAlerts.push({ ...d, violationNumber: v.violationNumber }));
  }
  deadlineAlerts.sort((a, b) => a.daysLeft - b.daysLeft);

  // Next actions
  const nextActions = [];
  for (const v of allViolations.filter(v => v.status === 'active')) {
    const vDefenses = allDefenses.filter(d => d.violationId === v.id);
    const vLetters = allLetters.filter(l => l.violationId === v.id);
    if (vDefenses.length === 0) {
      nextActions.push({ action: 'Run defense analysis', violationNumber: v.violationNumber, violationId: v.id });
    }
    if (vLetters.length === 0 && vDefenses.length > 0) {
      nextActions.push({ action: 'Generate contest letter', violationNumber: v.violationNumber, violationId: v.id });
    }
    const urgent = getMostUrgent(v);
    if (urgent && urgent.daysLeft <= 14) {
      nextActions.push({ action: `${urgent.label} in ${urgent.daysLeft} days`, violationNumber: v.violationNumber, violationId: v.id });
    }
  }

  res.json({
    totalDue,
    activeCases: activeCases.length,
    totalViolations: allViolations.length,
    totalDefenses: allDefenses.length,
    totalLetters: allLetters.length,
    deadlineAlerts,
    nextActions,
    cases: allCases
  });
});

// ── Cases CRUD ──────────────────────────────────────────────────────────────

app.get('/api/cases', (req, res) => res.json(cases.getAll()));

app.post('/api/cases', (req, res) => {
  const newCase = cases.add({
    name: req.body.name || 'New Case',
    owner: req.body.owner || '',
    status: req.body.status || 'active',
    notes: req.body.notes || ''
  });
  // Create case folder structure
  const caseDir = path.join(__dirname, 'cases', `case-${newCase.id}`);
  ['input', 'evidence', 'correspondence', 'exports'].forEach(sub => {
    const dir = path.join(caseDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  res.status(201).json(newCase);
});

app.get('/api/cases/:id', (req, res) => {
  const c = cases.getById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Case not found' });
  const caseViolations = violations.query({ caseId: c.id });
  const caseTimeline = timeline.query({ caseId: c.id });
  res.json({ ...c, violations: caseViolations, timeline: caseTimeline });
});

app.put('/api/cases/:id', (req, res) => {
  const updated = cases.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Case not found' });
  res.json(updated);
});

app.delete('/api/cases/:id', (req, res) => {
  const ok = cases.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Case not found' });
  res.json({ ok: true });
});

// ── Violations CRUD ─────────────────────────────────────────────────────────

app.get('/api/violations', (req, res) => {
  if (req.query.caseId) return res.json(violations.query({ caseId: req.query.caseId }));
  res.json(violations.getAll());
});

app.post('/api/violations', (req, res) => {
  const v = violations.add(req.body);
  // Auto-create timeline entries
  if (v.violationDate) {
    timeline.add({ caseId: v.caseId, violationId: v.id, type: 'violation', date: v.violationDate, label: 'Alleged Violation', description: `${v.location || 'Toll crossing'} at ${v.violationTime || 'unknown time'}` });
  }
  if (v.noticeDate) {
    timeline.add({ caseId: v.caseId, violationId: v.id, type: 'notice', date: v.noticeDate, label: `${v.noticeType || 'Notice'} Issued`, description: `Amount due: $${v.totalDue}` });
  }
  res.status(201).json(v);
});

app.get('/api/violations/:id', (req, res) => {
  const v = violations.getById(req.params.id);
  if (!v) return res.status(404).json({ error: 'Violation not found' });
  const vDefenses = defenses.query({ violationId: v.id });
  const vLetters = letters.query({ violationId: v.id });
  const deadlines = calculateDeadlines(v);
  res.json({ ...v, defenses: vDefenses, letters: vLetters, deadlines });
});

app.put('/api/violations/:id', (req, res) => {
  const updated = violations.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Violation not found' });
  res.json(updated);
});

app.delete('/api/violations/:id', (req, res) => {
  const ok = violations.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Violation not found' });
  res.json({ ok: true });
});

// ── Defenses CRUD ───────────────────────────────────────────────────────────

app.get('/api/defenses', (req, res) => {
  if (req.query.violationId) return res.json(defenses.query({ violationId: req.query.violationId }));
  res.json(defenses.getAll());
});

app.post('/api/defenses', (req, res) => {
  res.status(201).json(defenses.add(req.body));
});

app.put('/api/defenses/:id', (req, res) => {
  const updated = defenses.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Defense not found' });
  res.json(updated);
});

app.delete('/api/defenses/:id', (req, res) => {
  const ok = defenses.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Defense not found' });
  res.json({ ok: true });
});

// ── Defense Analysis Engine ─────────────────────────────────────────────────

app.get('/api/defense-library', (req, res) => {
  try {
    const lib = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'defense-library.json'), 'utf8'));
    res.json(lib);
  } catch {
    res.json([]);
  }
});

app.get('/api/defense-analysis/:violationId', (req, res) => {
  const v = violations.getById(req.params.violationId);
  if (!v) return res.status(404).json({ error: 'Violation not found' });

  const existing = defenses.query({ violationId: v.id });
  const recommendations = analyzeViolation(v, existing, path.join(__dirname, 'data'));
  res.json({ violation: v, recommendations, existingDefenses: existing });
});

app.post('/api/defense-analysis/:violationId/apply', (req, res) => {
  const v = violations.getById(req.params.violationId);
  if (!v) return res.status(404).json({ error: 'Violation not found' });

  const recommendations = analyzeViolation(v, [], path.join(__dirname, 'data'));
  const created = [];

  for (const rec of recommendations) {
    // Skip if defense already exists for this category+violation
    const existing = defenses.query({ violationId: v.id }).find(d => d.category === rec.category);
    if (existing) continue;

    const defense = defenses.add({
      violationId: v.id,
      category: rec.category,
      title: rec.title,
      strength: rec.strength,
      legalBasis: rec.legalBasis,
      arguments: rec.arguments,
      supportingFacts: rec.supportingFacts || [],
      enabled: true
    });
    created.push(defense);
  }

  res.json({ created, total: created.length });
});

// ── Letter Generator ────────────────────────────────────────────────────────

app.get('/api/letters', (req, res) => {
  if (req.query.violationId) return res.json(letters.query({ violationId: req.query.violationId }));
  res.json(letters.getAll());
});

app.post('/api/generate-letter', (req, res) => {
  const { violationId, template = 'contest', tone = 'formal', includeStatistics = true, senderName = '', senderAddress = '' } = req.body;

  const v = violations.getById(violationId);
  if (!v) return res.status(404).json({ error: 'Violation not found' });

  const vDefenses = defenses.query({ violationId: v.id });
  const options = { tone, includeStatistics, senderName, senderAddress };

  let text;
  switch (template) {
    case 'admin-review':
      text = generateAdminReviewRequest(v, options);
      break;
    case 'court-appeal':
      text = generateCourtAppeal(v, options);
      break;
    default:
      text = generateContestLetter(v, vDefenses, options);
  }

  const letter = letters.add({
    violationId: v.id,
    caseId: v.caseId,
    template,
    tone,
    text,
    includeStatistics,
    status: 'draft'
  });

  res.status(201).json(letter);
});

app.get('/api/letters/:id', (req, res) => {
  const l = letters.getById(req.params.id);
  if (!l) return res.status(404).json({ error: 'Letter not found' });
  res.json(l);
});

app.delete('/api/letters/:id', (req, res) => {
  const ok = letters.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Letter not found' });
  res.json({ ok: true });
});

// ── Timeline CRUD ───────────────────────────────────────────────────────────

app.get('/api/timeline', (req, res) => {
  let items;
  if (req.query.caseId) items = timeline.query({ caseId: req.query.caseId });
  else items = timeline.getAll();
  items.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  res.json(items);
});

app.post('/api/timeline', (req, res) => {
  res.status(201).json(timeline.add(req.body));
});

app.put('/api/timeline/:id', (req, res) => {
  const updated = timeline.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Event not found' });
  res.json(updated);
});

app.delete('/api/timeline/:id', (req, res) => {
  const ok = timeline.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Event not found' });
  res.json({ ok: true });
});

// ── File Operations ─────────────────────────────────────────────────────────

function scanDir(dirPath, basePath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(basePath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      results.push({ name: entry.name, path: relPath, type: 'directory', children: scanDir(fullPath, basePath) });
    } else {
      const stat = fs.statSync(fullPath);
      results.push({ name: entry.name, path: relPath, type: 'file', size: stat.size, ext: path.extname(entry.name).toLowerCase() });
    }
  }
  return results;
}

app.get('/api/files', (req, res) => {
  const caseId = req.query.caseId;
  let baseDir;

  if (caseId) {
    baseDir = path.join(__dirname, 'cases', `case-${caseId}`);
    if (!fs.existsSync(baseDir)) return res.json([]);
  } else {
    // Return top-level folders + legacy 01-Input
    const tree = [];
    ['01-Input', '02-Evidence', '03-Research', '04-Correspondence', '05-Exports'].forEach(dir => {
      const full = path.join(__dirname, dir);
      if (fs.existsSync(full)) {
        tree.push({ name: dir, path: dir, type: 'directory', children: scanDir(full, __dirname) });
      }
    });
    // Also scan case folders
    const casesDir = path.join(__dirname, 'cases');
    if (fs.existsSync(casesDir)) {
      const caseFolders = fs.readdirSync(casesDir, { withFileTypes: true }).filter(e => e.isDirectory());
      for (const cf of caseFolders) {
        const cFull = path.join(casesDir, cf.name);
        tree.push({ name: cf.name, path: `cases/${cf.name}`, type: 'directory', children: scanDir(cFull, __dirname) });
      }
    }
    return res.json(tree);
  }

  res.json(scanDir(baseDir, baseDir));
});

app.get('/api/serve', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const safe = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(__dirname, safe);

  if (!full.startsWith(__dirname)) return res.status(403).json({ error: 'forbidden' });
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'not found' });

  const ext = path.extname(full).toLowerCase();
  const mimeTypes = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json' };
  res.type(mimeTypes[ext] || 'application/octet-stream');
  res.sendFile(full);
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const dest = req.body.destination || '01-Input';
  const safe = path.normalize(dest).replace(/^(\.\.(\/|\\|$))+/, '');
  const destDir = path.join(__dirname, safe);

  if (!destDir.startsWith(__dirname)) return res.status(403).json({ error: 'forbidden' });
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const filename = req.file.originalname;
  const filepath = path.join(destDir, filename);
  fs.writeFileSync(filepath, req.file.buffer);

  res.json({ ok: true, filename, path: path.relative(__dirname, filepath).replace(/\\/g, '/'), size: req.file.size });
});

app.get('/api/upload-destinations', (req, res) => {
  const dests = ['01-Input', '02-Evidence', '03-Research', '04-Correspondence', '05-Exports'];
  // Add case-specific destinations
  const casesDir = path.join(__dirname, 'cases');
  if (fs.existsSync(casesDir)) {
    const caseFolders = fs.readdirSync(casesDir, { withFileTypes: true }).filter(e => e.isDirectory());
    for (const cf of caseFolders) {
      ['input', 'evidence', 'correspondence', 'exports'].forEach(sub => {
        dests.push(`cases/${cf.name}/${sub}`);
      });
    }
  }
  res.json(dests);
});

// ── PDF Parsing ─────────────────────────────────────────────────────────────

app.post('/api/parse-pdf', upload.single('file'), async (req, res) => {
  try {
    let buffer;
    if (req.file) {
      buffer = req.file.buffer;
    } else if (req.body.path) {
      const safe = path.normalize(req.body.path).replace(/^(\.\.(\/|\\|$))+/, '');
      const full = path.join(__dirname, safe);
      if (!full.startsWith(__dirname) || !fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
      buffer = fs.readFileSync(full);
    } else {
      return res.status(400).json({ error: 'Provide a file upload or path' });
    }

    const text = await extractPdfText(buffer);
    const parsed = parseViolationText(text);
    res.json({ text, parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Legal Reference ─────────────────────────────────────────────────────────

app.get('/api/legal-reference', (req, res) => {
  res.json([
    {
      section: 'CVC 40250',
      title: 'Toll Evasion Violation Defined',
      summary: 'Defines toll evasion as failure to pay the proper toll. The registered owner of the vehicle is presumed liable.',
      keyPoints: ['Registered owner is presumed liable', 'Applies to all toll facilities in California', 'Creates a rebuttable presumption'],
      deadline: null
    },
    {
      section: 'CVC 40254',
      title: 'Notice of Toll Evasion Violation',
      summary: 'Requires the issuing agency to mail a notice within 21 days of the alleged violation. The notice must include the date, time, location, and applicable CVC section.',
      keyPoints: ['21-day mailing requirement', 'Must include date, time, location', 'Must cite applicable CVC section', 'Deficient notices may be challenged'],
      deadline: '21 days from violation for agency to send first notice'
    },
    {
      section: 'CVC 40255',
      title: 'Contest and Administrative Review',
      summary: 'The registered owner may contest the violation within 30 days. If unsatisfied with investigation results, may request administrative review within 15 days.',
      keyPoints: ['30 days to contest from notice date', '15 days to request admin review after investigation results', 'Right to fair and impartial review', 'Can appear in person, by phone, or in writing'],
      deadline: '30 days to contest; 15 days for admin review request'
    },
    {
      section: 'CVC 40256',
      title: 'Superior Court Appeal',
      summary: 'After administrative review, the owner may appeal to Superior Court within 20 days of the decision.',
      keyPoints: ['20-day appeal window', 'Filed in Superior Court', 'Must have completed administrative review first'],
      deadline: '20 days from admin review decision'
    },
    {
      section: 'CVC 40258',
      title: 'Penalty Limits',
      summary: 'Caps penalties: $100 for first violation, $250 for second within one year, $500 for each additional within one year.',
      keyPoints: ['First violation: max $100 penalty', 'Second within one year: max $250', 'Additional within one year: max $500', 'Many agencies offer first-violation waivers'],
      deadline: null
    },
    {
      section: 'CVC 4770',
      title: 'DMV Registration Hold',
      summary: 'Unpaid toll violations may result in a hold on DMV vehicle registration renewal.',
      keyPoints: ['Registration hold for unpaid violations', 'Hold prevents registration renewal', 'Must resolve violations to clear hold'],
      deadline: null
    },
    {
      section: 'CVC 40267',
      title: 'Collection Agency Referral',
      summary: 'Unpaid violations may be referred to a collection agency after all administrative remedies are exhausted.',
      keyPoints: ['Collection referral for unpaid violations', 'May affect credit', 'Occurs after administrative process'],
      deadline: null
    }
  ]);
});

// ── Seed / Initialize ───────────────────────────────────────────────────────

app.post('/api/seed', (req, res) => {
  // Check if already seeded
  const existing = violations.getAll().find(v => v.violationNumber === 'T712655837788');
  if (existing) return res.json({ message: 'Already seeded', caseId: existing.caseId, violationId: existing.id });

  // Create the test case
  const testCase = cases.add({
    name: 'Benicia Bridge 12/12/25',
    owner: 'Marc Fechner',
    status: 'active',
    notes: 'First live test case — FasTrak violation from Benicia-Martinez Bridge'
  });

  // Create case folder
  const caseDir = path.join(__dirname, 'cases', `case-${testCase.id}`);
  ['input', 'evidence', 'correspondence', 'exports'].forEach(sub => {
    const dir = path.join(caseDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Copy 01-Input files to case input folder
  const inputDir = path.join(__dirname, '01-Input');
  if (fs.existsSync(inputDir)) {
    const files = fs.readdirSync(inputDir);
    for (const file of files) {
      const src = path.join(inputDir, file);
      const dest = path.join(caseDir, 'input', file);
      if (fs.statSync(src).isFile()) fs.copyFileSync(src, dest);
    }
  }

  // Create the violation record
  const violation = violations.add({
    caseId: testCase.id,
    violationNumber: 'T712655837788',
    noticeType: 'Second Notice / Final Notice',
    violationDate: '2025-12-12',
    violationTime: '21:20',
    location: 'Benicia-Martinez Bridge',
    lane: '13',
    plate: 'YQGAI',
    plateState: 'CA',
    vehicleMake: 'TSMR',
    vehicleDescription: 'White Tesla Model 3',
    tollAmount: 8.00,
    penaltyAmount: 5.00,
    totalDue: 13.00,
    escalatedAmount: 23.00,
    dueDate: '2026-04-14',
    noticeDate: '2026-03-30',
    photoDescription: 'Front view, white Tesla Model 3, no visible license plate',
    photoQuality: 'poor',
    status: 'active'
  });

  // Add timeline events
  timeline.add({ caseId: testCase.id, violationId: violation.id, type: 'violation', date: '2025-12-12', label: 'Alleged Toll Violation', description: 'Benicia-Martinez Bridge, Lane 13, 21:20' });
  timeline.add({ caseId: testCase.id, violationId: violation.id, type: 'notice', date: '2026-03-30', label: 'Second Notice Issued', description: 'Amount due: $13.00, escalates to $23.00 after 04/14/26' });
  timeline.add({ caseId: testCase.id, violationId: violation.id, type: 'deadline', date: '2026-04-14', label: 'Payment Due / Escalation Date', description: 'Amount increases from $13.00 to $23.00' });
  timeline.add({ caseId: testCase.id, violationId: violation.id, type: 'deadline', date: '2026-04-29', label: 'Contest Deadline (estimated)', description: '30 days from notice date per CVC 40255' });

  res.json({ message: 'Seeded successfully', caseId: testCase.id, violationId: violation.id });
});

// ── SPA fallback ────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Fast Track Defender running on http://localhost:${PORT}\n`);
});
