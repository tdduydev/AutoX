// ============================================================
// HIS Mini — Backend Server (Hono on Node.js)
// Port 4000 • FHIR R5 data model • Clinical Alert Engine
// ============================================================

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import crypto from 'node:crypto';
import type {
  FHIRPatient, FHIRAllergyIntolerance, FHIRMedicationRequest, FHIRMedication, ClinicalAlert,
} from './fhir-types.js';
import { buildMedicationCatalog } from './medications.js';
import { seedPatients, seedAllergies, seedEncounters, seedPrescriptions } from './seed.js';
import type { SOAPEncounter } from './seed.js';
import { checkAllergyDrugConflicts } from './alert-engine.js';

// ─── In-Memory Data Stores ──────────────────────────────────

const patients = seedPatients();
const allergies = seedAllergies();
const medications = buildMedicationCatalog();
const prescriptions = seedPrescriptions();
const alertHistory: ClinicalAlert[] = [];

// ─── SOAP Encounters ───
const encounters = seedEncounters();

// ─── Helpers ────────────────────────────────────────────────

function getPatientAllergies(patientId: string): FHIRAllergyIntolerance[] {
  return [...allergies.values()].filter(
    (a) => a.patient.reference === `Patient/${patientId}`,
  );
}

// ─── App ────────────────────────────────────────────────────

const app = new Hono();

app.use('*', logger());
app.use('*', cors({ origin: '*' }));

// ── Health ──
app.get('/', (c) => c.json({ name: 'HIS Mini', version: '1.0.0', fhir: 'R5', status: 'ok' }));

// ============================================================
// /api/his/stats
// ============================================================
app.get('/api/his/stats', (c) => {
  return c.json({
    patients: patients.size,
    allergies: allergies.size,
    medications: medications.size,
    prescriptions: prescriptions.size,
    alerts: alertHistory.length,
    criticalAlerts: alertHistory.filter((a) => a.severity === 'critical').length,
  });
});

// ============================================================
// Patients
// ============================================================

app.get('/api/his/patients', (c) => {
  const q = c.req.query('q')?.toLowerCase();
  let list = [...patients.values()];
  if (q) {
    list = list.filter((p) =>
      p.name[0]?.text?.toLowerCase().includes(q) ||
      p.identifier[0]?.value?.toLowerCase().includes(q),
    );
  }
  return c.json({ patients: list, total: list.length });
});

app.get('/api/his/patients/:id', (c) => {
  const patient = patients.get(c.req.param('id'));
  if (!patient) return c.json({ error: 'Patient not found' }, 404);
  const patientAllergies = getPatientAllergies(patient.id);
  const patientPrescriptions = [...prescriptions.values()].filter(
    (p) => p.subject.reference === `Patient/${patient.id}`,
  );
  return c.json({ patient, allergies: patientAllergies, prescriptions: patientPrescriptions });
});

app.post('/api/his/patients', async (c) => {
  const body = await c.req.json();
  const id = `patient-${crypto.randomUUID().slice(0, 8)}`;
  const patient: FHIRPatient = {
    resourceType: 'Patient', id,
    identifier: [{ system: 'urn:oid:1.2.840.113883.1.56', value: body.code || `BN-${Date.now()}` }],
    name: [{
      family: body.family || '',
      given: body.given || [],
      text: body.name || `${body.family || ''} ${(body.given || []).join(' ')}`.trim(),
    }],
    gender: body.gender || 'unknown',
    birthDate: body.birthDate || '',
    telecom: body.phone ? [{ system: 'phone', value: body.phone }] : [],
    address: body.address ? [{ text: body.address }] : [],
    meta: { lastUpdated: new Date().toISOString() },
  };
  patients.set(id, patient);
  return c.json({ patient }, 201);
});

// ============================================================
// Allergies
// ============================================================

app.get('/api/his/patients/:id/allergies', (c) => {
  const patientId = c.req.param('id');
  if (!patients.has(patientId)) return c.json({ error: 'Patient not found' }, 404);
  return c.json({ allergies: getPatientAllergies(patientId) });
});

app.post('/api/his/patients/:id/allergies', async (c) => {
  const patientId = c.req.param('id');
  if (!patients.has(patientId)) return c.json({ error: 'Patient not found' }, 404);
  const body = await c.req.json();
  const id = `allergy-${crypto.randomUUID().slice(0, 8)}`;
  const allergy: FHIRAllergyIntolerance = {
    resourceType: 'AllergyIntolerance', id,
    clinicalStatus: { coding: [{ code: 'active', display: 'Active' }] },
    verificationStatus: { coding: [{ code: body.verified ? 'confirmed' : 'unconfirmed', display: body.verified ? 'Confirmed' : 'Unconfirmed' }] },
    type: 'allergy', category: ['medication'],
    criticality: body.criticality || 'high',
    code: { coding: [{ system: 'http://snomed.info/sct', code: body.substanceCode || 'unknown', display: body.substance || '' }] },
    patient: { reference: `Patient/${patientId}` },
    recordedDate: new Date().toISOString().split('T')[0],
    reaction: body.reaction ? [{
      manifestation: [{ coding: [{ system: 'http://snomed.info/sct', code: 'unknown', display: body.reaction }] }],
      severity: body.reactionSeverity || 'moderate',
    }] : undefined,
  };
  allergies.set(id, allergy);
  return c.json({ allergy }, 201);
});

app.delete('/api/his/patients/:id/allergies/:aid', (c) => {
  const allergyId = c.req.param('aid');
  if (!allergies.has(allergyId)) return c.json({ error: 'Allergy not found' }, 404);
  allergies.delete(allergyId);
  return c.json({ success: true });
});

// ============================================================
// Medications Catalog
// ============================================================

app.get('/api/his/medications', (c) => {
  const q = c.req.query('q')?.toLowerCase();
  let list = [...medications.values()];
  if (q) {
    list = list.filter((m) =>
      m.code.coding[0]?.display?.toLowerCase().includes(q) ||
      m.ingredient.some((i) => i.item.concept.coding[0]?.display?.toLowerCase().includes(q)),
    );
  }
  return c.json({ medications: list, total: list.length });
});

// ============================================================
// Prescriptions — with Clinical Alert Validation
// ============================================================

app.get('/api/his/prescriptions', (c) => {
  const patientId = c.req.query('patientId');
  let list = [...prescriptions.values()];
  if (patientId) {
    list = list.filter((p) => p.subject.reference === `Patient/${patientId}`);
  }
  list.sort((a, b) => new Date(b.authoredOn).getTime() - new Date(a.authoredOn).getTime());
  return c.json({ prescriptions: list, total: list.length });
});

app.get('/api/his/prescriptions/:id', (c) => {
  const rx = prescriptions.get(c.req.param('id'));
  if (!rx) return c.json({ error: 'Prescription not found' }, 404);
  return c.json({ prescription: rx });
});

/**
 * POST /api/his/prescriptions
 * Body: { patientId, medicationId, dosage, route, frequency, note, forceOverride? }
 *
 * If allergy conflict → 409 + alerts[]. Doctor re-sends with forceOverride=true to acknowledge.
 */
app.post('/api/his/prescriptions', async (c) => {
  const body = await c.req.json();
  const { patientId, medicationId, dosage, route, frequency, note, forceOverride } = body;

  if (!patientId || !medicationId) {
    return c.json({ error: 'patientId và medicationId là bắt buộc' }, 400);
  }
  const patient = patients.get(patientId);
  if (!patient) return c.json({ error: 'Không tìm thấy bệnh nhân' }, 404);
  const med = medications.get(medicationId);
  if (!med) return c.json({ error: 'Không tìm thấy thuốc' }, 404);

  // ─── Clinical Alert Check ───
  const patientAllergies = getPatientAllergies(patientId);
  const alerts = checkAllergyDrugConflicts(patientId, med, patientAllergies);

  // Always record alerts in history when detected
  if (alerts.length > 0) {
    alertHistory.push(...alerts);
  }

  if (alerts.length > 0 && !forceOverride) {
    return c.json({
      blocked: true,
      alerts,
      message: `⚠️ Phát hiện ${alerts.length} cảnh báo lâm sàng! Đơn thuốc CHƯA được lưu. Bác sĩ cần xác nhận để tiếp tục.`,
    }, 409);
  }

  // ─── Create MedicationRequest ───
  const id = `rx-${crypto.randomUUID().slice(0, 8)}`;
  const prescription: FHIRMedicationRequest = {
    resourceType: 'MedicationRequest', id,
    status: 'active', intent: 'order',
    medication: { reference: `Medication/${medicationId}`, display: med.code.coding[0]?.display ?? '' },
    subject: { reference: `Patient/${patientId}`, display: patient.name[0]?.text ?? '' },
    authoredOn: new Date().toISOString(),
    dosageInstruction: [{
      text: `${dosage || '1 viên'}, ${frequency || '3 lần/ngày'}, ${route || 'Đường uống'}`,
      timing: frequency ? { code: { text: frequency } } : undefined,
      route: route ? { coding: [{ system: 'http://snomed.info/sct', code: '26643006', display: route }] } : undefined,
      doseAndRate: dosage ? [{ doseQuantity: { value: parseFloat(dosage) || 1, unit: 'viên' } }] : undefined,
    }],
    note: note ? [{ text: note }] : undefined,
  };

  if (alerts.length > 0 && forceOverride) {
    prescription.note = [
      ...(prescription.note || []),
      { text: `⚠️ Bác sĩ đã xác nhận bỏ qua ${alerts.length} cảnh báo dị ứng: ${alerts.map((a) => a.title).join('; ')}` },
    ];
  }

  prescriptions.set(id, prescription);
  return c.json({
    prescription,
    alerts: alerts.length > 0 ? alerts : undefined,
    overridden: alerts.length > 0 && forceOverride,
  }, 201);
});

// ============================================================
// Manual Clinical Alert Check
// ============================================================

app.post('/api/his/clinical-alert/check', async (c) => {
  const { patientId, medicationId } = await c.req.json();
  if (!patientId || !medicationId) {
    return c.json({ error: 'patientId and medicationId required' }, 400);
  }
  const med = medications.get(medicationId);
  if (!med) return c.json({ error: 'Medication not found' }, 404);

  const patientAllergies = getPatientAllergies(patientId);
  const alerts = checkAllergyDrugConflicts(patientId, med, patientAllergies);
  return c.json({ safe: alerts.length === 0, alerts, checkedAt: new Date().toISOString() });
});

// ============================================================
// SOAP Encounters
// ============================================================

app.get('/api/his/encounters', (c) => {
  const patientId = c.req.query('patientId');
  let list = [...encounters.values()];
  if (patientId) list = list.filter((e) => e.patientId === patientId);
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return c.json({ encounters: list, total: list.length });
});

app.get('/api/his/encounters/:id', (c) => {
  const enc = encounters.get(c.req.param('id'));
  if (!enc) return c.json({ error: 'Encounter not found' }, 404);
  return c.json({ encounter: enc });
});

app.post('/api/his/encounters', async (c) => {
  const body = await c.req.json();
  const { patientId } = body;
  if (!patientId) return c.json({ error: 'patientId required' }, 400);
  const patient = patients.get(patientId);
  if (!patient) return c.json({ error: 'Patient not found' }, 404);

  const id = `enc-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const enc: SOAPEncounter = {
    id, patientId,
    patientName: patient.name[0]?.text ?? '',
    date: now.split('T')[0],
    status: 'in-progress',
    subjective: body.subjective || '',
    objective: body.objective || '',
    assessment: body.assessment || '',
    plan: body.plan || '',
    prescriptionIds: [],
    createdAt: now, updatedAt: now,
  };
  encounters.set(id, enc);
  return c.json({ encounter: enc }, 201);
});

app.put('/api/his/encounters/:id', async (c) => {
  const enc = encounters.get(c.req.param('id'));
  if (!enc) return c.json({ error: 'Encounter not found' }, 404);
  const body = await c.req.json();
  if (body.subjective !== undefined) enc.subjective = body.subjective;
  if (body.objective !== undefined) enc.objective = body.objective;
  if (body.assessment !== undefined) enc.assessment = body.assessment;
  if (body.plan !== undefined) enc.plan = body.plan;
  if (body.status !== undefined) enc.status = body.status;
  enc.updatedAt = new Date().toISOString();
  return c.json({ encounter: enc });
});

// ============================================================
// Alert History
// ============================================================

app.get('/api/his/alerts', (c) => {
  const patientId = c.req.query('patientId');
  let list = [...alertHistory];
  if (patientId) {
    list = list.filter((a) => a.patientId === patientId);
  }
  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return c.json({ alerts: list, total: list.length });
});

// ============================================================
// Chat History — Persistent in-memory store
// ============================================================

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  rating?: number; // 1 = thumbs down, 5 = thumbs up
  ratingNote?: string;
  createdAt: string;
}

interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

const chatSessions = new Map<string, ChatSession>();
const chatMessages = new Map<string, ChatMessage>();

// ─── Chat Sessions ───

app.get('/api/his/chat/sessions', (c) => {
  let list = [...chatSessions.values()];
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return c.json({ sessions: list, total: list.length });
});

app.post('/api/his/chat/sessions', async (c) => {
  const body = await c.req.json();
  const id = body.id || `chat-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const session: ChatSession = {
    id, title: body.title || 'Cuộc trò chuyện mới',
    messageCount: 0, createdAt: now, updatedAt: now,
  };
  chatSessions.set(id, session);
  return c.json({ session }, 201);
});

app.delete('/api/his/chat/sessions/:id', (c) => {
  const sid = c.req.param('id');
  if (!chatSessions.has(sid)) return c.json({ error: 'Session not found' }, 404);
  // Delete session and its messages
  chatSessions.delete(sid);
  for (const [mid, msg] of chatMessages) {
    if (msg.sessionId === sid) chatMessages.delete(mid);
  }
  return c.json({ success: true });
});

// ─── Chat Messages ───

app.get('/api/his/chat/sessions/:id/messages', (c) => {
  const sid = c.req.param('id');
  let list = [...chatMessages.values()].filter(m => m.sessionId === sid);
  list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return c.json({ messages: list, total: list.length });
});

app.post('/api/his/chat/sessions/:id/messages', async (c) => {
  const sid = c.req.param('id');
  const body = await c.req.json();

  // Auto-create session if not exists
  if (!chatSessions.has(sid)) {
    const now = new Date().toISOString();
    chatSessions.set(sid, {
      id: sid, title: body.title || 'Cuộc trò chuyện mới',
      messageCount: 0, createdAt: now, updatedAt: now,
    });
  }

  const id = `msg-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const msg: ChatMessage = {
    id, sessionId: sid, role: body.role || 'user',
    content: body.content || '', createdAt: now,
  };
  chatMessages.set(id, msg);

  // Update session
  const session = chatSessions.get(sid)!;
  session.messageCount++;
  session.updatedAt = now;
  // Auto-title from first user message
  if (session.messageCount === 1 && msg.role === 'user') {
    session.title = msg.content.slice(0, 60) + (msg.content.length > 60 ? '...' : '');
  }

  return c.json({ message: msg }, 201);
});

// ─── Rating ───

app.put('/api/his/chat/messages/:id/rating', async (c) => {
  const mid = c.req.param('id');
  const msg = chatMessages.get(mid);
  if (!msg) return c.json({ error: 'Message not found' }, 404);
  const body = await c.req.json();
  msg.rating = body.rating; // 1 = bad, 5 = good
  msg.ratingNote = body.note;
  return c.json({ message: msg });
});

// ─── Chat Context (recent history for AI) ───

app.get('/api/his/chat/sessions/:id/context', (c) => {
  const sid = c.req.param('id');
  const limit = Math.min(20, Math.max(1, parseInt(c.req.query('limit') || '10')));
  let list = [...chatMessages.values()].filter(m => m.sessionId === sid);
  list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const recent = list.slice(-limit);
  const contextText = recent.map(m => `[${m.role}]: ${m.content}`).join('\n');
  return c.json({ messages: recent, contextText });
});

// ─── Chat Stats ───

app.get('/api/his/chat/stats', (c) => {
  const allMsgs = [...chatMessages.values()];
  const rated = allMsgs.filter(m => m.rating != null);
  const avgRating = rated.length > 0 ? rated.reduce((s, m) => s + (m.rating || 0), 0) / rated.length : 0;
  return c.json({
    totalSessions: chatSessions.size,
    totalMessages: chatMessages.size,
    ratedMessages: rated.length,
    avgRating: Math.round(avgRating * 10) / 10,
    thumbsUp: rated.filter(m => m.rating === 5).length,
    thumbsDown: rated.filter(m => m.rating === 1).length,
  });
});

// ============================================================
// Knowledge Packs — Drug Formulary, Interactions, ICD-10
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

// ─── Load knowledge data from JSON files ───
const KNOWLEDGE_DIR = path.resolve(import.meta.dirname, '../../data/knowledge-packs');

interface KnowledgeDrug {
  id: string; brandName: string; genericName: string;
  substances: { name: string; rxnorm: string; strength: string }[];
  pharmacoGroup: string; atcCode: string; dosageForm: string;
  commonDosage: string; bhyt: boolean; manufacturer?: string;
}

interface KnowledgeInteraction {
  id: string;
  drugA: { code: string; system: string; display: string };
  drugB: { code: string; system: string; display: string };
  severity: string; description: string; mechanism?: string;
}

interface KnowledgeICD10 {
  code: string; title: string; titleEn: string; chapter: string;
}

interface KnowledgeCollection {
  id: string; name: string; description: string;
  type: 'drug' | 'interaction' | 'icd10';
  itemIds: string[];
  createdAt: string; updatedAt: string;
}

let knowledgeDrugs: KnowledgeDrug[] = [];
let knowledgeInteractions: KnowledgeInteraction[] = [];
let knowledgeICD10: KnowledgeICD10[] = [];
const knowledgeCollections = new Map<string, KnowledgeCollection>();

// Load data
try {
  const formularyRaw = fs.readFileSync(path.join(KNOWLEDGE_DIR, 'vn-drug-formulary/vn-formulary-v2.json'), 'utf-8');
  knowledgeDrugs = JSON.parse(formularyRaw).drugs || [];
} catch { console.warn('⚠️  Could not load vn-drug-formulary'); }

try {
  const interactionsRaw = fs.readFileSync(path.join(KNOWLEDGE_DIR, 'drug-interactions/drug-interactions.json'), 'utf-8');
  knowledgeInteractions = JSON.parse(interactionsRaw).interactions || [];
} catch { console.warn('⚠️  Could not load drug-interactions'); }

try {
  const icd10Raw = fs.readFileSync(path.join(KNOWLEDGE_DIR, 'icd10-vietnam/icd10-codes.json'), 'utf-8');
  knowledgeICD10 = JSON.parse(icd10Raw).codes || [];
} catch { console.warn('⚠️  Could not load icd10-codes'); }

// Seed default collections
const defaultCollections: Omit<KnowledgeCollection, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'col-antibiotics', name: 'Kháng sinh', description: 'Các thuốc kháng sinh thông dụng',
    type: 'drug', itemIds: knowledgeDrugs.filter(d => d.pharmacoGroup.toLowerCase().includes('kháng sinh')).map(d => d.id),
  },
  {
    id: 'col-nsaids', name: 'Giảm đau / NSAID', description: 'Thuốc giảm đau, kháng viêm không steroid',
    type: 'drug', itemIds: knowledgeDrugs.filter(d => d.pharmacoGroup.toLowerCase().includes('giảm đau') || d.pharmacoGroup.toLowerCase().includes('nsaid')).map(d => d.id),
  },
  {
    id: 'col-bhyt', name: 'Thuốc BHYT', description: 'Thuốc trong danh mục bảo hiểm y tế',
    type: 'drug', itemIds: knowledgeDrugs.filter(d => d.bhyt).map(d => d.id),
  },
];
for (const col of defaultCollections) {
  const now = new Date().toISOString();
  knowledgeCollections.set(col.id, { ...col, createdAt: now, updatedAt: now });
}

// ─── Knowledge: Drugs (DataTable AJAX) ───

app.get('/api/his/knowledge/drugs', (c) => {
  const q = c.req.query('q')?.toLowerCase();
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
  const group = c.req.query('group');
  const bhyt = c.req.query('bhyt');
  const collectionId = c.req.query('collectionId');
  const sortBy = c.req.query('sortBy') || 'brandName';
  const sortDir = c.req.query('sortDir') === 'desc' ? -1 : 1;

  let list = [...knowledgeDrugs];

  // Filter by collection
  if (collectionId) {
    const col = knowledgeCollections.get(collectionId);
    if (col) {
      const idSet = new Set(col.itemIds);
      list = list.filter(d => idSet.has(d.id));
    }
  }

  if (q) {
    list = list.filter(d =>
      d.brandName.toLowerCase().includes(q) ||
      d.genericName.toLowerCase().includes(q) ||
      d.atcCode.toLowerCase().includes(q) ||
      d.substances.some(s => s.name.toLowerCase().includes(q)),
    );
  }
  if (group) list = list.filter(d => d.pharmacoGroup.toLowerCase().includes(group.toLowerCase()));
  if (bhyt === 'true') list = list.filter(d => d.bhyt);
  if (bhyt === 'false') list = list.filter(d => !d.bhyt);

  // Sort
  list.sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortBy] ?? '';
    const bVal = (b as Record<string, unknown>)[sortBy] ?? '';
    return String(aVal).localeCompare(String(bVal)) * sortDir;
  });

  const total = list.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = list.slice(offset, offset + limit);

  // Unique groups for filter dropdown
  const groups = [...new Set(knowledgeDrugs.map(d => d.pharmacoGroup))].sort();

  return c.json({ data, total, page, limit, totalPages, groups });
});

app.get('/api/his/knowledge/drugs/:id', (c) => {
  const drug = knowledgeDrugs.find(d => d.id === c.req.param('id'));
  if (!drug) return c.json({ error: 'Drug not found' }, 404);
  return c.json({ drug });
});

// ─── Knowledge: Drug Interactions ───

app.get('/api/his/knowledge/interactions', (c) => {
  const q = c.req.query('q')?.toLowerCase();
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
  const severity = c.req.query('severity');

  let list = [...knowledgeInteractions];
  if (q) {
    list = list.filter(i =>
      i.drugA.display.toLowerCase().includes(q) ||
      i.drugB.display.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q),
    );
  }
  if (severity) list = list.filter(i => i.severity === severity);

  const total = list.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = list.slice(offset, offset + limit);

  return c.json({ data, total, page, limit, totalPages });
});

// ─── Knowledge: ICD-10 ───

app.get('/api/his/knowledge/icd10', (c) => {
  const q = c.req.query('q')?.toLowerCase();
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
  const chapter = c.req.query('chapter');

  let list = [...knowledgeICD10];
  if (q) {
    list = list.filter(i =>
      i.code.toLowerCase().includes(q) ||
      i.title.toLowerCase().includes(q) ||
      i.titleEn.toLowerCase().includes(q),
    );
  }
  if (chapter) list = list.filter(i => i.chapter === chapter);

  const total = list.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = list.slice(offset, offset + limit);

  const chapters = [...new Set(knowledgeICD10.map(i => i.chapter))].sort();

  return c.json({ data, total, page, limit, totalPages, chapters });
});

// ─── Knowledge: Collections CRUD ───

app.get('/api/his/knowledge/collections', (c) => {
  const type = c.req.query('type') as 'drug' | 'interaction' | 'icd10' | undefined;
  let list = [...knowledgeCollections.values()];
  if (type) list = list.filter(col => col.type === type);
  list.sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ collections: list, total: list.length });
});

app.get('/api/his/knowledge/collections/:id', (c) => {
  const col = knowledgeCollections.get(c.req.param('id'));
  if (!col) return c.json({ error: 'Collection not found' }, 404);
  return c.json({ collection: col });
});

app.post('/api/his/knowledge/collections', async (c) => {
  const body = await c.req.json();
  const { name, description, type, itemIds } = body;
  if (!name || !type) return c.json({ error: 'name và type là bắt buộc' }, 400);
  const id = `col-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const col: KnowledgeCollection = {
    id, name, description: description || '', type,
    itemIds: itemIds || [], createdAt: now, updatedAt: now,
  };
  knowledgeCollections.set(id, col);
  return c.json({ collection: col }, 201);
});

app.put('/api/his/knowledge/collections/:id', async (c) => {
  const col = knowledgeCollections.get(c.req.param('id'));
  if (!col) return c.json({ error: 'Collection not found' }, 404);
  const body = await c.req.json();
  if (body.name !== undefined) col.name = body.name;
  if (body.description !== undefined) col.description = body.description;
  if (body.itemIds !== undefined) col.itemIds = body.itemIds;
  col.updatedAt = new Date().toISOString();
  return c.json({ collection: col });
});

app.delete('/api/his/knowledge/collections/:id', (c) => {
  if (!knowledgeCollections.has(c.req.param('id'))) return c.json({ error: 'Collection not found' }, 404);
  knowledgeCollections.delete(c.req.param('id'));
  return c.json({ success: true });
});

// ─── Knowledge: Stats ───

app.get('/api/his/knowledge/stats', (c) => {
  return c.json({
    drugs: knowledgeDrugs.length,
    interactions: knowledgeInteractions.length,
    icd10: knowledgeICD10.length,
    collections: knowledgeCollections.size,
  });
});

// ============================================================
// Start
// ============================================================

const PORT = Number(process.env.HIS_PORT) || 4000;

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\n🏥 HIS Mini Server running at http://localhost:${PORT}`);
  console.log(`   FHIR R5 • Clinical Alert Engine • ${patients.size} patients • ${medications.size} medications`);
  console.log(`   📚 Knowledge: ${knowledgeDrugs.length} drugs • ${knowledgeInteractions.length} interactions • ${knowledgeICD10.length} ICD-10 codes\n`);
});
