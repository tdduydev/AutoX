// ============================================================
// HIS Mini — API Client
// ============================================================

const API = '';

// ─── Auth token storage ───
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
  if (token) sessionStorage.setItem('his_token', token);
  else sessionStorage.removeItem('his_token');
}
export function getAuthToken() { return _authToken; }

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;
  return fetch(`${API}${path}`, { ...init, headers });
}

// ── Stats ──
export async function getStats() {
  const res = await apiFetch('/api/his/stats');
  return res.json();
}

// ── Patients ──
export async function getPatients(q?: string) {
  const url = q ? `/api/his/patients?q=${encodeURIComponent(q)}` : '/api/his/patients';
  const res = await apiFetch(url);
  return res.json();
}

export async function getPatient(id: string) {
  const res = await apiFetch(`/api/his/patients/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createPatient(data: {
  name: string; family?: string; given?: string[];
  gender: string; birthDate: string; phone?: string; address?: string; code?: string;
}) {
  const res = await apiFetch('/api/his/patients', { method: 'POST', body: JSON.stringify(data) });
  return res.json();
}

// ── Allergies ──
export async function getPatientAllergies(patientId: string) {
  const res = await apiFetch(`/api/his/patients/${encodeURIComponent(patientId)}/allergies`);
  return res.json();
}

export async function addAllergy(patientId: string, data: {
  substance: string; substanceCode?: string;
  criticality?: string; reaction?: string; reactionSeverity?: string; verified?: boolean;
}) {
  const res = await apiFetch(`/api/his/patients/${encodeURIComponent(patientId)}/allergies`, {
    method: 'POST', body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteAllergy(patientId: string, allergyId: string) {
  const res = await apiFetch(`/api/his/patients/${encodeURIComponent(patientId)}/allergies/${encodeURIComponent(allergyId)}`, {
    method: 'DELETE',
  });
  return res.json();
}

// ── Medications ──
export async function getMedications(q?: string) {
  const url = q ? `/api/his/medications?q=${encodeURIComponent(q)}` : '/api/his/medications';
  const res = await apiFetch(url);
  return res.json();
}

// ── Prescriptions ──
export async function getPrescriptions(patientId?: string) {
  const url = patientId ? `/api/his/prescriptions?patientId=${encodeURIComponent(patientId)}` : '/api/his/prescriptions';
  const res = await apiFetch(url);
  return res.json();
}

export interface CreatePrescriptionData {
  patientId: string;
  medicationId: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  note?: string;
  forceOverride?: boolean;
}

export async function createPrescription(data: CreatePrescriptionData) {
  const res = await apiFetch('/api/his/prescriptions', {
    method: 'POST', body: JSON.stringify(data),
  });
  const json = await res.json();
  return { ...json, status: res.status };
}

// ── Clinical Alert ──
export async function checkClinicalAlert(patientId: string, medicationId: string) {
  const res = await apiFetch('/api/his/clinical-alert/check', {
    method: 'POST', body: JSON.stringify({ patientId, medicationId }),
  });
  return res.json();
}

// ── Alert History ──
export async function getAlerts(patientId?: string) {
  const url = patientId ? `/api/his/alerts?patientId=${encodeURIComponent(patientId)}` : '/api/his/alerts';
  const res = await apiFetch(url);
  return res.json();
}

// ── SOAP Encounters ──
export async function getEncounters(patientId?: string) {
  const url = patientId ? `/api/his/encounters?patientId=${encodeURIComponent(patientId)}` : '/api/his/encounters';
  const res = await apiFetch(url);
  return res.json();
}

export async function getEncounter(id: string) {
  const res = await apiFetch(`/api/his/encounters/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createEncounter(data: { patientId: string; subjective?: string; objective?: string; assessment?: string; plan?: string }) {
  const res = await apiFetch('/api/his/encounters', { method: 'POST', body: JSON.stringify(data) });
  return res.json();
}

export async function updateEncounter(id: string, data: { subjective?: string; objective?: string; assessment?: string; plan?: string; status?: string }) {
  const res = await apiFetch(`/api/his/encounters/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
  return res.json();
}

// ── xClaw Chat ──
const XCLAW_BASE = '/xclaw-api';

export async function loginXClaw(email: string, password: string): Promise<{ token: string } | { error: string }> {
  const res = await fetch(`${XCLAW_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function chatXClaw(token: string, message: string, sessionId?: string, domainId?: string): Promise<{ content: string; sessionId: string }> {
  const res = await fetch(`${XCLAW_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, sessionId, stream: false, domainId }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  return res.json();
}

export function chatXClawStream(token: string, message: string, sessionId?: string, onDelta?: (text: string) => void): { cancel: () => void; done: Promise<string> } {
  const controller = new AbortController();

  const done = (async () => {
    const res = await fetch(`${XCLAW_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, sessionId, stream: true }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Chat failed: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text-delta' && data.content) {
            full += data.content;
            onDelta?.(data.content);
          }
        } catch { /* skip non-JSON lines */ }
      }
    }
    return full;
  })();

  return { cancel: () => controller.abort(), done };
}

// ── xClaw AI: Prescription Check ──
export async function aiCheckPrescription(
  token: string,
  patientName: string,
  allergies: string[],
  medicationName: string,
  ingredients: string[],
  dosage: string,
  sessionId?: string,
): Promise<{ content: string; sessionId: string }> {
  const prompt = `[HIS Clinical Decision Support]
Bệnh nhân: ${patientName}
Dị ứng đã ghi nhận: ${allergies.length > 0 ? allergies.join(', ') : 'Không có'}
Thuốc kê: ${medicationName}
Thành phần hoạt chất: ${ingredients.join(', ')}
Liều dùng: ${dosage}

Hãy phân tích đơn thuốc này:
1. Kiểm tra khả năng phản ứng chéo với dị ứng đã biết
2. Đánh giá liều dùng phù hợp
3. Cảnh báo tương tác thuốc tiềm ẩn
4. Đưa ra khuyến nghị cho bác sĩ

Trả lời ngắn gọn, rõ ràng bằng tiếng Việt.`;

  return chatXClaw(token, prompt, sessionId, 'healthcare');
}

// ── xClaw AI: Read Patient Record ──
export async function aiReadPatientRecord(
  token: string,
  patientData: {
    name: string;
    gender: string;
    birthDate: string;
    allergies: { substance: string; criticality: string }[];
    prescriptions: { medication: string; dosage: string; date: string }[];
    encounters: { date: string; subjective: string; objective: string; assessment: string; plan: string; status: string }[];
  },
  question?: string,
  sessionId?: string,
): Promise<{ content: string; sessionId: string }> {
  let prompt = `[HIS Bệnh án điện tử]
Bệnh nhân: ${patientData.name}
Giới tính: ${patientData.gender === 'male' ? 'Nam' : patientData.gender === 'female' ? 'Nữ' : patientData.gender}
Ngày sinh: ${patientData.birthDate}

--- Dị ứng ---
${patientData.allergies.length > 0 ? patientData.allergies.map(a => `• ${a.substance} (${a.criticality})`).join('\n') : 'Không có dị ứng đã ghi nhận'}

--- Đơn thuốc ---
${patientData.prescriptions.length > 0 ? patientData.prescriptions.map(p => `• ${p.medication} - ${p.dosage} (${p.date})`).join('\n') : 'Chưa có đơn thuốc'}

--- Lượt khám (SOAP) ---
${patientData.encounters.length > 0 ? patientData.encounters.map(e => `[${e.date} - ${e.status}]
S: ${e.subjective || 'N/A'}
O: ${e.objective || 'N/A'}
A: ${e.assessment || 'N/A'}
P: ${e.plan || 'N/A'}`).join('\n\n') : 'Chưa có lượt khám'}
`;

  if (question) {
    prompt += `\n\nCâu hỏi của bác sĩ: ${question}`;
  } else {
    prompt += `\n\nHãy tóm tắt bệnh án này, đánh giá tình trạng hiện tại, và đưa ra khuyến nghị theo dõi tiếp theo. Trả lời bằng tiếng Việt.`;
  }

  return chatXClaw(token, prompt, sessionId, 'healthcare');
}

// ============================================================
// Chat History & Rating
// ============================================================

export async function getChatSessions() {
  const res = await apiFetch('/api/his/chat/sessions');
  return res.json();
}

export async function createChatSession(id?: string, title?: string) {
  const res = await apiFetch('/api/his/chat/sessions', {
    method: 'POST', body: JSON.stringify({ id, title }),
  });
  return res.json();
}

export async function deleteChatSession(id: string) {
  const res = await apiFetch(`/api/his/chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.json();
}

export async function getChatMessages(sessionId: string) {
  const res = await apiFetch(`/api/his/chat/sessions/${encodeURIComponent(sessionId)}/messages`);
  return res.json();
}

export async function saveChatMessage(sessionId: string, data: { role: string; content: string; title?: string }) {
  const res = await apiFetch(`/api/his/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST', body: JSON.stringify(data),
  });
  return res.json();
}

export async function rateChatMessage(messageId: string, rating: number, note?: string) {
  const res = await apiFetch(`/api/his/chat/messages/${encodeURIComponent(messageId)}/rating`, {
    method: 'PUT', body: JSON.stringify({ rating, note }),
  });
  return res.json();
}

export async function getChatContext(sessionId: string, limit?: number) {
  const url = limit
    ? `/api/his/chat/sessions/${encodeURIComponent(sessionId)}/context?limit=${limit}`
    : `/api/his/chat/sessions/${encodeURIComponent(sessionId)}/context`;
  const res = await apiFetch(url);
  return res.json();
}

export async function getChatStats() {
  const res = await apiFetch('/api/his/chat/stats');
  return res.json();
}

// ============================================================
// Knowledge Packs
// ============================================================

export async function getKnowledgeStats() {
  const res = await apiFetch('/api/his/knowledge/stats');
  return res.json();
}

// ── Knowledge: Drugs (DataTable AJAX) ──
export async function getKnowledgeDrugs(params?: {
  q?: string; page?: number; limit?: number;
  group?: string; bhyt?: string; collectionId?: string;
  sortBy?: string; sortDir?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.group) sp.set('group', params.group);
  if (params?.bhyt) sp.set('bhyt', params.bhyt);
  if (params?.collectionId) sp.set('collectionId', params.collectionId);
  if (params?.sortBy) sp.set('sortBy', params.sortBy);
  if (params?.sortDir) sp.set('sortDir', params.sortDir);
  const res = await apiFetch(`/api/his/knowledge/drugs?${sp.toString()}`);
  return res.json();
}

// ── Knowledge: Interactions ──
export async function getKnowledgeInteractions(params?: { q?: string; page?: number; limit?: number; severity?: string }) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.severity) sp.set('severity', params.severity);
  const res = await apiFetch(`/api/his/knowledge/interactions?${sp.toString()}`);
  return res.json();
}

// ── Knowledge: ICD-10 ──
export async function getKnowledgeICD10(params?: { q?: string; page?: number; limit?: number; chapter?: string }) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.chapter) sp.set('chapter', params.chapter);
  const res = await apiFetch(`/api/his/knowledge/icd10?${sp.toString()}`);
  return res.json();
}

// ── Knowledge: Collections ──
export async function getKnowledgeCollections(type?: string) {
  const url = type ? `/api/his/knowledge/collections?type=${encodeURIComponent(type)}` : '/api/his/knowledge/collections';
  const res = await apiFetch(url);
  return res.json();
}

export async function createKnowledgeCollection(data: { name: string; description?: string; type: string; itemIds?: string[] }) {
  const res = await apiFetch('/api/his/knowledge/collections', { method: 'POST', body: JSON.stringify(data) });
  return res.json();
}

export async function updateKnowledgeCollection(id: string, data: { name?: string; description?: string; itemIds?: string[] }) {
  const res = await apiFetch(`/api/his/knowledge/collections/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
  return res.json();
}

export async function deleteKnowledgeCollection(id: string) {
  const res = await apiFetch(`/api/his/knowledge/collections/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.json();
}

// ============================================================
// HIS Auth
// ============================================================

export async function hisLogin(email: string, password: string) {
  const res = await fetch(`${API}/api/his/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function hisLogout() {
  const res = await apiFetch('/api/his/auth/logout', { method: 'POST' });
  setAuthToken(null);
  return res.json();
}

export async function hisGetMe() {
  const res = await apiFetch('/api/his/auth/me');
  return res.json();
}

export async function hisChangePassword(currentPassword: string, newPassword: string) {
  const res = await apiFetch('/api/his/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return res.json();
}

// ============================================================
// User Management
// ============================================================

export async function getUsers(params?: {
  q?: string; role?: string; status?: string; department?: string;
  page?: number; limit?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.role) sp.set('role', params.role);
  if (params?.status) sp.set('status', params.status);
  if (params?.department) sp.set('department', params.department);
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  const res = await apiFetch(`/api/his/users?${sp.toString()}`);
  return res.json();
}

export async function getUser(id: string) {
  const res = await apiFetch(`/api/his/users/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createUser(data: {
  name: string; email: string; password: string;
  role?: string; department?: string; status?: string;
}) {
  const res = await apiFetch('/api/his/users', { method: 'POST', body: JSON.stringify(data) });
  return res.json();
}

export async function updateUser(id: string, data: {
  name?: string; email?: string; password?: string;
  role?: string; department?: string; status?: string;
}) {
  const res = await apiFetch(`/api/his/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
  return res.json();
}

export async function deleteUser(id: string) {
  const res = await apiFetch(`/api/his/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.json();
}

// ============================================================
// Roles & Permissions
// ============================================================

export async function getRoles() {
  const res = await apiFetch('/api/his/roles');
  return res.json();
}

export async function getRole(id: string) {
  const res = await apiFetch(`/api/his/roles/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createRole(data: { name: string; description?: string; permissions?: string[] }) {
  const res = await apiFetch('/api/his/roles', { method: 'POST', body: JSON.stringify(data) });
  return res.json();
}

export async function updateRole(id: string, data: { name?: string; description?: string; permissions?: string[] }) {
  const res = await apiFetch(`/api/his/roles/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
  return res.json();
}

export async function deleteRole(id: string) {
  const res = await apiFetch(`/api/his/roles/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.json();
}

export async function getPermissions() {
  const res = await apiFetch('/api/his/permissions');
  return res.json();
}
