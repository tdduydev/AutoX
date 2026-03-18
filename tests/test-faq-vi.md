# xClaw FAQ - Frequently Asked Questions

## Q: Thủ đô của Việt Nam là gì?

A: Thủ đô của Việt Nam là Hà Nội. Hà Nội là trung tâm chính trị, văn hóa và giáo dục của cả nước. Hà Nội nằm ở phía Bắc Việt Nam, bên bờ sông Hồng.

## Q: xClaw hỗ trợ bao nhiêu domain?

A: xClaw hỗ trợ 13 domain packs bao gồm: Healthcare (Y tế), Finance (Tài chính), Education (Giáo dục), Legal (Pháp luật), E-commerce (Thương mại điện tử), Manufacturing (Sản xuất), Real Estate (Bất động sản), Agriculture (Nông nghiệp), Logistics (Vận tải), Tourism (Du lịch), Energy (Năng lượng), Retail (Bán lẻ), và General (Tổng hợp).

## Q: xClaw sử dụng LLM nào?

A: xClaw mặc định sử dụng Ollama với model llama3.1:8b chạy local. Ngoài ra còn hỗ trợ OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), Google (Gemini), Groq, và Mistral.

## Q: Giá của xClaw là bao nhiêu?

A: xClaw có 3 gói:

- Community: Miễn phí, mã nguồn mở, tự host
- Pro: $49/tháng/người dùng, tính năng nâng cao, hỗ trợ ưu tiên
- Enterprise: Giá tùy chỉnh, hỗ trợ chuyên biệt, SLA, triển khai on-premise

## Q: RAG là gì trong xClaw?

A: RAG (Retrieval-Augmented Generation) là tính năng cho phép AI truy vấn kiến thức từ tài liệu đã upload. Khi người dùng hỏi, hệ thống sẽ tìm các đoạn văn bản liên quan nhất trong Knowledge Base và cung cấp context cho LLM để trả lời chính xác hơn.

## Q: xClaw có thể tìm kiếm web không?

A: Có! xClaw tích hợp tính năng Web Search sử dụng DuckDuckGo. Khi bật Web Search, hệ thống sẽ tìm kiếm thông tin mới nhất trên Internet và kết hợp với RAG để trả lời.

## Q: Debug mode trong xClaw là gì?

A: Debug mode cho phép hiển thị thông tin chi tiết cho mỗi tin nhắn AI trả về, bao gồm: RAG context (ngữ cảnh từ Knowledge Base), Web Search results, timing (thời gian xử lý), token usage (số token sử dụng), và finish reason.

## Q: Ai phát triển xClaw?

A: xClaw được phát triển bởi xDev Asia, một công ty phần mềm có trụ sở tại Việt Nam. Email: <contact@xdev.asia>

## Q: xClaw có hỗ trợ tiếng Việt không?

A: Có! xClaw hỗ trợ đa ngôn ngữ bao gồm tiếng Việt. Bạn có thể chat bằng tiếng Việt và hệ thống sẽ trả lời bằng tiếng Việt.

## Q: Yêu cầu kỹ thuật để chạy xClaw?

A: Cần Node.js 20+, TypeScript 5.5+, Ollama cho local LLM, PostgreSQL cho production (SQLite cho development). Hệ thống chạy trên port 3000 (server) và 5173 (web).
