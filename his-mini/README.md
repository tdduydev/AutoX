# HIS Mini — Mini Hospital Information System

Hệ thống thông tin bệnh viện thu nhỏ, tích hợp xClaw AI Agent.

## Kiến trúc

| Thành phần | Port | Mô tả |
|---|---|---|
| **Frontend** (Vite + React 19) | `5174` | UI chính — Tailwind CSS v4, lucide-react |
| **Backend** (Hono + Node.js) | `4000` | API server — FHIR R5, Clinical Alerts, Knowledge Packs |
| **xClaw Server** | `3000` | AI Agent server — Auth, Chat, Multi-tenant |

## Chạy dự án

```bash
cd his-mini
npm install
npm run dev
```

- Frontend: <http://localhost:5174>
- Backend API: <http://localhost:4000>

> **Lưu ý**: Cần chạy xClaw server ở port 3000 để sử dụng tính năng AI Chat.

## Cấu hình AI (bắt buộc)

Tạo file `.env` ở thư mục gốc xClaw (`/xClaw/.env`) với API key của nhà cung cấp AI:

```bash
cp .env.example .env
```

Sau đó điền API key vào `.env`:

```env
# Chọn 1 trong các provider: openai | anthropic | ollama | google | groq | mistral
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Điền API key tương ứng với provider đã chọn
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
# ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
# GOOGLE_API_KEY=AIzaxxxxxxxxxxxxxxxx
# GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx

# Database
DATABASE_URL=postgresql://xclaw:xclaw@localhost:5451/xclaw

# Auth
JWT_SECRET=change-me-in-production
```

Nếu không có API key, dùng **Ollama** (miễn phí, local):

```env
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1:8b
OLLAMA_URL=http://localhost:11434
```

Sau khi cấu hình xong, chạy xClaw server:

```bash
cd /path/to/xClaw
npm run dev
```

## Tài khoản đăng nhập

### xClaw AI Chatbot

Trang **Chatbot** yêu cầu đăng nhập xClaw server. Đăng ký tài khoản mới qua API:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bác sĩ Demo",
    "email": "doctor@his.local",
    "password": "doctor123",
    "tenantName": "HIS Demo",
    "tenantSlug": "his-demo"
  }'
```

Sau khi đăng ký, đăng nhập trong giao diện Chatbot:

| Trường | Giá trị |
|---|---|
| **Email** | `doctor@his.local` |
| **Mật khẩu** | `doctor123` |

### Tài khoản tự động (internal)

Các trang **Kê đơn**, **Bệnh nhân**, **xClaw Widget** tự động đăng nhập bằng:

| Email | Mật khẩu |
|---|---|
| `doctor@his.local` | `doctor123` |

## Tính năng chính

- **Dashboard** — Tổng quan bệnh viện, thống kê
- **Bệnh nhân** — Quản lý FHIR Patient, dị ứng, AI đọc hồ sơ
- **Kê đơn** — Chọn thuốc, kiểm tra tương tác, AI review đơn thuốc
- **Cảnh báo lâm sàng** — Alert engine kiểm tra dị ứng–thuốc tự động
- **Tri thức (Knowledge)** — DataTable AJAX tra cứu thuốc (100), tương tác (20+), ICD-10 (265) + Collections
- **AI Chatbot** — Chat với xClaw AI, lưu lịch sử, đánh giá câu trả lời, vẽ sơ đồ Mermaid

## API Endpoints

### HIS API (`/api/his/`)

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/his/stats` | Thống kê tổng quan |
| GET | `/api/his/patients` | Danh sách bệnh nhân |
| GET | `/api/his/medications` | Danh mục thuốc |
| POST | `/api/his/prescriptions` | Tạo đơn thuốc |
| GET | `/api/his/knowledge/drugs` | Tra cứu thuốc (pagination, filter, sort) |
| GET | `/api/his/knowledge/interactions` | Tương tác thuốc |
| GET | `/api/his/knowledge/icd10` | Mã ICD-10 |
| CRUD | `/api/his/knowledge/collections` | Quản lý Collections thuốc |
| CRUD | `/api/his/chat/sessions` | Quản lý phiên chat |
| GET | `/api/his/chat/sessions/:id/messages` | Tin nhắn trong phiên |
| POST | `/api/his/chat/sessions/:id/messages` | Lưu tin nhắn |
| PUT | `/api/his/chat/messages/:id/rating` | Đánh giá tin nhắn (👍👎) |
| GET | `/api/his/chat/sessions/:id/context` | Lấy context cho AI |
| GET | `/api/his/chat/stats` | Thống kê chat |

### xClaw API (proxy `/xclaw-api/` → `localhost:3000`)

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/auth/login` | Đăng nhập |
| POST | `/auth/register` | Đăng ký tài khoản |
| POST | `/api/chat` | Chat với AI |

## Tech Stack

- **Frontend**: React 19, Tailwind CSS v4, Vite 6, lucide-react, Mermaid
- **Backend**: Hono, Node.js, FHIR R5 data model
- **AI**: xClaw Agent (multi-model LLM router)
- **Data**: JSON knowledge packs (thuốc VN, tương tác, ICD-10)
