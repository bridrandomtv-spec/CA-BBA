-- إرسال التذكرة إلى حساب الأنصار داخل التطبيق (« تذاكري ») :
-- رمز QR شخصي قابل للمسح عند الباب، بلا ورق.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_owner ON tickets(owner_id);
