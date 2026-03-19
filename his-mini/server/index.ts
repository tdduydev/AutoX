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
    const aVal = (a as unknown as Record<string, unknown>)[sortBy] ?? '';
    const bVal = (b as unknown as Record<string, unknown>)[sortBy] ?? '';
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
// Users, Roles & Permissions
// ============================================================

// ─── Permission definitions ───

const ALL_PERMISSIONS = [
  // Patients
  'patients.read', 'patients.write', 'patients.delete',
  // Prescriptions
  'prescriptions.read', 'prescriptions.write',
  // Encounters
  'encounters.read', 'encounters.write',
  // Alerts
  'alerts.read',
  // Knowledge Base
  'knowledge.read', 'knowledge.write',
  // Chat AI
  'chat.use',
  // User Management
  'users.read', 'users.write', 'users.delete',
  // Roles
  'roles.read', 'roles.write',
  // System
  'system.admin',
] as const;

type Permission = typeof ALL_PERMISSIONS[number];

interface HISRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean; // system roles cannot be deleted
  createdAt: string;
  updatedAt: string;
}

interface HISUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string; // role id
  department: string;
  status: 'active' | 'inactive' | 'locked';
  avatar?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthToken {
  userId: string;
  token: string;
  expiresAt: string;
}

const hisRoles = new Map<string, HISRole>();
const hisUsers = new Map<string, HISUser>();
const authTokens = new Map<string, AuthToken>();

// ─── Password hashing (SHA-256) ───

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// ─── Seed roles ───

const seedRoles: Omit<HISRole, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'role-admin', name: 'Quản trị viên', description: 'Toàn quyền hệ thống',
    permissions: [...ALL_PERMISSIONS], isSystem: true,
  },
  {
    id: 'role-doctor', name: 'Bác sĩ', description: 'Khám bệnh, kê đơn, tra cứu',
    permissions: [
      'patients.read', 'patients.write',
      'prescriptions.read', 'prescriptions.write',
      'encounters.read', 'encounters.write',
      'alerts.read', 'knowledge.read', 'chat.use',
    ], isSystem: true,
  },
  {
    id: 'role-nurse', name: 'Điều dưỡng', description: 'Xem bệnh nhân, cảnh báo',
    permissions: [
      'patients.read', 'prescriptions.read',
      'encounters.read', 'alerts.read', 'knowledge.read', 'chat.use',
    ], isSystem: true,
  },
  {
    id: 'role-pharmacist', name: 'Dược sĩ', description: 'Quản lý thuốc, tra cứu tương tác',
    permissions: [
      'patients.read', 'prescriptions.read',
      'alerts.read', 'knowledge.read', 'knowledge.write', 'chat.use',
    ], isSystem: true,
  },
  {
    id: 'role-receptionist', name: 'Lễ tân', description: 'Tiếp nhận bệnh nhân',
    permissions: [
      'patients.read', 'patients.write', 'encounters.read',
    ], isSystem: true,
  },
];

for (const r of seedRoles) {
  const now = new Date().toISOString();
  hisRoles.set(r.id, { ...r, createdAt: now, updatedAt: now });
}

// ─── Seed users ───

const seedUsers: Omit<HISUser, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'user-admin', name: 'Admin HIS', email: 'admin@his.local',
    passwordHash: hashPassword('admin123'), role: 'role-admin',
    department: 'CNTT', status: 'active',
  },
  {
    id: 'user-doctor', name: 'BS. Nguyễn Văn A', email: 'doctor@his.local',
    passwordHash: hashPassword('doctor123'), role: 'role-doctor',
    department: 'Nội khoa', status: 'active',
  },
  {
    id: 'user-doctor2', name: 'BS. Trần Thị B', email: 'doctor2@his.local',
    passwordHash: hashPassword('doctor123'), role: 'role-doctor',
    department: 'Ngoại khoa', status: 'active',
  },
  {
    id: 'user-nurse', name: 'ĐD. Lê Văn C', email: 'nurse@his.local',
    passwordHash: hashPassword('nurse123'), role: 'role-nurse',
    department: 'Nội khoa', status: 'active',
  },
  {
    id: 'user-pharmacist', name: 'DS. Phạm Thị D', email: 'pharmacist@his.local',
    passwordHash: hashPassword('pharma123'), role: 'role-pharmacist',
    department: 'Dược', status: 'active',
  },
  {
    id: 'user-receptionist', name: 'Hoàng Văn E', email: 'reception@his.local',
    passwordHash: hashPassword('reception123'), role: 'role-receptionist',
    department: 'Lễ tân', status: 'active',
  },
];

for (const u of seedUsers) {
  const now = new Date().toISOString();
  hisUsers.set(u.id, { ...u, createdAt: now, updatedAt: now });
}

// ─── Auth helpers ───

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getUserFromToken(authHeader: string | undefined): HISUser | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const authToken = authTokens.get(token);
  if (!authToken) return null;
  if (new Date(authToken.expiresAt) < new Date()) {
    authTokens.delete(token);
    return null;
  }
  return hisUsers.get(authToken.userId) || null;
}

function userHasPermission(user: HISUser, permission: Permission): boolean {
  const role = hisRoles.get(user.role);
  if (!role) return false;
  return role.permissions.includes(permission) || role.permissions.includes('system.admin');
}

function sanitizeUser(u: HISUser) {
  const { passwordHash, ...safe } = u;
  const role = hisRoles.get(u.role);
  return { ...safe, roleName: role?.name || u.role, permissions: role?.permissions || [] };
}

// ─── Auth endpoints ───

app.post('/api/his/auth/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;
  if (!email || !password) return c.json({ error: 'Email và mật khẩu là bắt buộc' }, 400);

  const user = [...hisUsers.values()].find(u => u.email === email);
  if (!user) return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401);
  if (user.status === 'locked') return c.json({ error: 'Tài khoản đã bị khóa' }, 403);
  if (user.status === 'inactive') return c.json({ error: 'Tài khoản đã bị vô hiệu hóa' }, 403);
  if (!verifyPassword(password, user.passwordHash)) return c.json({ error: 'Email hoặc mật khẩu không đúng' }, 401);

  // Generate token (24h expiry)
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  authTokens.set(token, { userId: user.id, token, expiresAt });

  // Update last login
  user.lastLoginAt = new Date().toISOString();

  return c.json({ token, user: sanitizeUser(user), expiresAt });
});

app.post('/api/his/auth/logout', (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    authTokens.delete(authHeader.slice(7));
  }
  return c.json({ success: true });
});

app.get('/api/his/auth/me', (c) => {
  const user = getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Chưa đăng nhập' }, 401);
  return c.json({ user: sanitizeUser(user) });
});

app.put('/api/his/auth/password', async (c) => {
  const user = getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Chưa đăng nhập' }, 401);
  const body = await c.req.json();
  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) return c.json({ error: 'Thiếu mật khẩu' }, 400);
  if (!verifyPassword(currentPassword, user.passwordHash)) return c.json({ error: 'Mật khẩu hiện tại không đúng' }, 401);
  if (newPassword.length < 6) return c.json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' }, 400);
  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  return c.json({ success: true });
});

// ─── User CRUD ───

app.get('/api/his/users', (c) => {
  const authUser = getUserFromToken(c.req.header('Authorization'));
  if (!authUser || !userHasPermission(authUser, 'users.read')) {
    return c.json({ error: 'Không có quyền truy cập' }, 403);
  }

  const q = c.req.query('q')?.toLowerCase();
  const roleFilter = c.req.query('role');
  const statusFilter = c.req.query('status');
  const departmentFilter = c.req.query('department');
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));

  let list = [...hisUsers.values()].map(sanitizeUser);

  if (q) {
    list = list.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q),
    );
  }
  if (roleFilter) list = list.filter(u => u.role === roleFilter);
  if (statusFilter) list = list.filter(u => u.status === statusFilter);
  if (departmentFilter) list = list.filter(u => u.department === departmentFilter);

  list.sort((a, b) => a.name.localeCompare(b.name));

  const total = list.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = list.slice(offset, offset + limit);

  const departments = [...new Set([...hisUsers.values()].map(u => u.department))].sort();

  return c.json({ data, total, page, limit, totalPages, departments });
});

app.get('/api/his/users/:id', (c) => {
  const authUser = getUserFromToken(c.req.header('Authorization'));
  if (!authUser || !userHasPermission(authUser, 'users.read')) {
    return c.json({ error: 'Không có quyền truy cập' }, 403);
  }
  const user = hisUsers.get(c.req.param('id'));
  if (!user) return c.json({ error: 'Không tìm thấy người dùng' }, 404);
  return c.json({ user: sanitizeUser(user) });
});

app.post('/api/his/users', async (c) => {
  const authUser = getUserFromToken(c.req.header('Authorization'));
  if (!authUser || !userHasPermission(authUser, 'users.write')) {
    return c.json({ error: 'Không có quyền tạo người dùng' }, 403);
  }

  const body = await c.req.json();
  const { name, email, password, role, department, status } = body;
  if (!name || !email || !password) return c.json({ error: 'name, email, password là bắt buộc' }, 400);
  if (password.length < 6) return c.json({ error: 'Mật khẩu phải ít nhất 6 ký tự' }, 400);

  // Check duplicate email
  if ([...hisUsers.values()].some(u => u.email === email)) {
    return c.json({ error: 'Email đã tồn tại' }, 409);
  }
  // Validate role
  if (role && !hisRoles.has(role)) return c.json({ error: 'Role không tồn tại' }, 400);

  const id = `user-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const user: HISUser = {
    id, name, email,
    passwordHash: hashPassword(password),
    role: role || 'role-doctor',
    department: department || '',
    status: status || 'active',
    createdAt: now, updatedAt: now,
  };
  hisUsers.set(id, user);
  return c.json({ user: sanitizeUser(user) }, 201);
});

app.put('/api/his/users/:id', async (c) => {
  const authUser = getUserFromToken(c.req.header('Authorization'));
  if (!authUser || !userHasPermission(authUser, 'users.write')) {
    return c.json({ error: 'Không có quyền chỉnh sửa người dùng' }, 403);
  }

  const user = hisUsers.get(c.req.param('id'));
  if (!user) return c.json({ error: 'Không tìm thấy người dùng' }, 404);

  const body = await c.req.json();
  if (body.name !== undefined) user.name = body.name;
  if (body.email !== undefined) {
    // Check duplicate email
    const dup = [...hisUsers.values()].find(u => u.email === body.email && u.id !== user.id);
    if (dup) return c.json({ error: 'Email đã tồn tại' }, 409);
    user.email = body.email;
  }
  if (body.password) {
    if (body.password.length < 6) return c.json({ error: 'Mật khẩu phải ít nhất 6 ký tự' }, 400);
    user.passwordHash = hashPassword(body.password);
  }
  if (body.role !== undefined) {
    if (!hisRoles.has(body.role)) return c.json({ error: 'Role không tồn tại' }, 400);
    user.role = body.role;
  }
  if (body.department !== undefined) user.department = body.department;
  if (body.status !== undefined) user.status = body.status;
  user.updatedAt = new Date().toISOString();

  return c.json({ user: sanitizeUser(user) });
});

app.delete('/api/his/users/:id', (c) => {
  const authUser = getUserFromToken(c.req.header('Authorization'));
  if (!authUser || !userHasPermission(authUser, 'users.delete')) {
    return c.json({ error: 'Không có quyền xóa người dùng' }, 403);
  }

  const userId = c.req.param('id');
  if (userId === authUser.id) return c.json({ error: 'Không thể xóa chính mình' }, 400);
  if (!hisUsers.has(userId)) return c.json({ error: 'Không tìm thấy người dùng' }, 404);
  hisUsers.delete(userId);

  // Invalidate user tokens
  for (const [token, auth] of authTokens) {
    if (auth.userId === userId) authTokens.delete(token);
  }

  return c.json({ success: true });
});

// ─── Roles ───

app.get('/api/his/roles', (c) => {
  const list = [...hisRoles.values()];
  list.sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ roles: list, total: list.length });
});

app.get('/api/his/roles/:id', (c) => {
  const role = hisRoles.get(c.req.param('id'));
  if (!role) return c.json({ error: 'Role không tồn tại' }, 404);
  // Count users with this role
  const userCount = [...hisUsers.values()].filter(u => u.role === role.id).length;
  return c.json({ role, userCount });
});

app.post('/api/his/roles', async (c) => {
  const authUser = getUserFromToken(c.req.header('Authorization'));
  if (!authUser || !userHasPermission(authUser, 'roles.write')) {
    return c.json({ error: 'Không có quyền tạo vai trò' }, 403);
  }

  const body = await c.req.json();
  const { name, description, permissions } = body;
  if (!name) return c.json({ error: 'Tên vai trò là bắt buộc' }, 400);

  const id = `role-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const role: HISRole = {
    id, name, description: description || '',
    permissions: (permissions || []).filter((p: string) => ALL_PERMISSIONS.includes(p as Permission)),
    isSystem: false,
    createdAt: now, updatedAt: now,
  };
  hisRoles.set(id, role);
  return c.json({ role }, 201);
});

app.put('/api/his/roles/:id', async (c) => {
  const authUser = getUserFromToken(c.req.header('Authorization'));
  if (!authUser || !userHasPermission(authUser, 'roles.write')) {
    return c.json({ error: 'Không có quyền chỉnh sửa vai trò' }, 403);
  }

  const role = hisRoles.get(c.req.param('id'));
  if (!role) return c.json({ error: 'Role không tồn tại' }, 404);

  const body = await c.req.json();
  if (body.name !== undefined) role.name = body.name;
  if (body.description !== undefined) role.description = body.description;
  if (body.permissions !== undefined) {
    role.permissions = body.permissions.filter((p: string) => ALL_PERMISSIONS.includes(p as Permission));
  }
  role.updatedAt = new Date().toISOString();

  return c.json({ role });
});

app.delete('/api/his/roles/:id', (c) => {
  const authUser = getUserFromToken(c.req.header('Authorization'));
  if (!authUser || !userHasPermission(authUser, 'roles.write')) {
    return c.json({ error: 'Không có quyền xóa vai trò' }, 403);
  }

  const roleId = c.req.param('id');
  const role = hisRoles.get(roleId);
  if (!role) return c.json({ error: 'Role không tồn tại' }, 404);
  if (role.isSystem) return c.json({ error: 'Không thể xóa vai trò hệ thống' }, 400);

  // Check if any users still have this role
  const usersWithRole = [...hisUsers.values()].filter(u => u.role === roleId);
  if (usersWithRole.length > 0) {
    return c.json({ error: `Còn ${usersWithRole.length} người dùng có vai trò này, hãy chuyển vai trò trước` }, 400);
  }

  hisRoles.delete(roleId);
  return c.json({ success: true });
});

// ─── Permissions list ───

app.get('/api/his/permissions', (c) => {
  const groups: Record<string, { key: string; label: string }[]> = {
    'Bệnh nhân': [
      { key: 'patients.read', label: 'Xem bệnh nhân' },
      { key: 'patients.write', label: 'Thêm/sửa bệnh nhân' },
      { key: 'patients.delete', label: 'Xóa bệnh nhân' },
    ],
    'Kê đơn': [
      { key: 'prescriptions.read', label: 'Xem đơn thuốc' },
      { key: 'prescriptions.write', label: 'Kê đơn thuốc' },
    ],
    'Khám bệnh': [
      { key: 'encounters.read', label: 'Xem lượt khám' },
      { key: 'encounters.write', label: 'Tạo/sửa lượt khám' },
    ],
    'Cảnh báo': [
      { key: 'alerts.read', label: 'Xem cảnh báo' },
    ],
    'Knowledge Base': [
      { key: 'knowledge.read', label: 'Tra cứu' },
      { key: 'knowledge.write', label: 'Quản lý dữ liệu' },
    ],
    'AI Trợ lý': [
      { key: 'chat.use', label: 'Sử dụng AI chat' },
    ],
    'Người dùng': [
      { key: 'users.read', label: 'Xem danh sách' },
      { key: 'users.write', label: 'Thêm/sửa người dùng' },
      { key: 'users.delete', label: 'Xóa người dùng' },
    ],
    'Vai trò': [
      { key: 'roles.read', label: 'Xem vai trò' },
      { key: 'roles.write', label: 'Quản lý vai trò' },
    ],
    'Hệ thống': [
      { key: 'system.admin', label: 'Toàn quyền quản trị' },
    ],
  };
  return c.json({ permissions: groups, allKeys: ALL_PERMISSIONS });
});

// ============================================================
// Start
// ============================================================

const PORT = Number(process.env.HIS_PORT) || 4000;

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\n🏥 HIS Mini Server running at http://localhost:${PORT}`);
  console.log(`   FHIR R5 • Clinical Alert Engine • ${patients.size} patients • ${medications.size} medications`);
  console.log(`   📚 Knowledge: ${knowledgeDrugs.length} drugs • ${knowledgeInteractions.length} interactions • ${knowledgeICD10.length} ICD-10 codes`);
  console.log(`   👥 Users: ${hisUsers.size} users • ${hisRoles.size} roles\n`);
});
