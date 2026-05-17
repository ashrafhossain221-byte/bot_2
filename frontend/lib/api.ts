import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatResponse {
  reply: string;
  session_id: string;
  conversation_id: string;
  intent_score: number;
  persona: string;
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  conversation_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  channel: string;
  stage: string;
  persona: string;
  intent_score: number;
  created_at: string;
  updated_at: string;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  skip: number;
  limit: number;
}

export interface LeadStats {
  by_stage: Record<string, number>;
  by_persona: Record<string, number>;
  by_channel: Record<string, number>;
  hot_leads: number;
  avg_intent_score: number;
  total: number;
}

export async function fetchLeads(params?: {
  stage?: string;
  persona?: string;
  channel?: string;
  skip?: number;
  limit?: number;
}): Promise<LeadsResponse> {
  const { data } = await api.get<LeadsResponse>("/api/leads", { params });
  return data;
}

export async function fetchLeadStats(): Promise<LeadStats> {
  const { data } = await api.get<LeadStats>("/api/leads/stats");
  return data;
}

export interface BotSettings {
  provider_name: string;
  api_endpoint: string;
  model_name: string;
  api_key_set: boolean;
  bot_name: string;
  gender: string;
  tone: string;
  reply_language: string;
  reply_length: string;
  business_name: string | null;
  business_type: string | null;
  custom_instructions: string | null;
  telegram_bot_token_set: boolean;
  telegram_webhook_url: string | null;
  whatsapp_configured: boolean;
  whatsapp_phone_number_id: string | null;
  facebook_configured: boolean;
  facebook_page_id: string | null;
  instagram_configured: boolean;
  instagram_account_id: string | null;
  comment_auto_reply: string;
}

export interface SettingsUpdate {
  api_key?: string;
  provider_name?: string;
  api_endpoint?: string;
  model_name?: string;
  bot_name?: string;
  gender?: string;
  tone?: string;
  reply_language?: string;
  reply_length?: string;
  business_name?: string;
  business_type?: string;
  custom_instructions?: string;
  telegram_bot_token?: string;
  telegram_webhook_url?: string;
  whatsapp_access_token?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_verify_token?: string;
  facebook_page_token?: string;
  facebook_page_id?: string;
  facebook_verify_token?: string;
  facebook_app_secret?: string;
  instagram_access_token?: string;
  instagram_account_id?: string;
  comment_auto_reply?: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  sessionId?: string,
  userName?: string
): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>("/api/chat/message", {
    message,
    session_id: sessionId,
    user_name: userName,
  });
  return data;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<BotSettings> {
  const { data } = await api.get<BotSettings>("/api/settings");
  return data;
}

export async function patchSettings(update: SettingsUpdate): Promise<void> {
  await api.patch("/api/settings", update);
}

// ─── Telegram ────────────────────────────────────────────────────────────────

export async function setupTelegramWebhook(webhookUrl: string) {
  const { data } = await api.post("/api/telegram/setup-webhook", { webhook_url: webhookUrl });
  return data;
}

export async function removeTelegramWebhook() {
  const { data } = await api.delete("/api/telegram/webhook");
  return data;
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function checkHealth() {
  const { data } = await api.get("/api/health");
  return data;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardOverview {
  total_conversations: number;
  new_today: number;
  new_this_week: number;
  total_messages: number;
  user_messages: number;
  total_leads: number;
  hot_leads: number;
  customers: number;
  total_orders: number;
  orders_new: number;
  orders_dispatched: number;
  orders_delivered: number;
  revenue: number;
}

export interface RecentConversation {
  id: string;
  channel: string;
  user_name: string | null;
  stage: string;
  updated_at: string;
  last_message: string;
  last_message_role: string;
  intent_score: number;
  persona: string;
  lead_stage: string;
}

export interface HotLeadEntry {
  lead_id: string;
  conversation_id: string;
  name: string | null;
  phone: string | null;
  channel: string;
  intent_score: number;
  persona: string;
  updated_at: string;
}

export interface TrendPoint {
  date: string;
  conversations: number;
}

export interface DashboardData {
  overview: DashboardOverview;
  funnel: Record<string, number>;
  by_channel: Record<string, number>;
  by_persona: Record<string, number>;
  trend: TrendPoint[];
  recent_conversations: RecentConversation[];
  hot_leads_panel: HotLeadEntry[];
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>("/api/dashboard");
  return data;
}

// ─── Conversations ───────────────────────────────────────────────────────────

export interface ConversationLead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  stage: string;
  persona: string;
  intent_score: number;
}

export interface ConversationItem {
  id: string;
  channel: string;
  external_user_id: string;
  user_name: string | null;
  stage: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string;
  last_message_role: string;
  last_message_at: string | null;
  lead: ConversationLead | null;
}

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  message_type: string;
  created_at: string;
}

export async function fetchConversations(params?: {
  channel?: string;
  stage?: string;
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<{ conversations: ConversationItem[]; total: number; skip: number; limit: number }> {
  const { data } = await api.get("/api/conversations", { params });
  return data;
}

export async function fetchConversation(id: string): Promise<ConversationItem> {
  const { data } = await api.get(`/api/conversations/${id}`);
  return data;
}

export async function fetchMessages(
  conversationId: string,
  params?: { skip?: number; limit?: number }
): Promise<{ messages: ConversationMessage[]; total: number }> {
  const { data } = await api.get(`/api/conversations/${conversationId}/messages`, { params });
  return data;
}

// ─── Multimodal ───────────────────────────────────────────────────────────────

export interface UploadResponse {
  reply: string;
  session_id: string;
  conversation_id: string;
  file_type: "voice" | "image" | "document";
  extracted_text: string;
  intent_score: number;
  persona: string;
}

export async function uploadFile(
  file: File | Blob,
  sessionId?: string,
  fileName?: string
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file, fileName ?? (file instanceof File ? file.name : "recording.webm"));
  if (sessionId) form.append("session_id", sessionId);
  const { data } = await api.post<UploadResponse>("/api/multimodal/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ─── Automations ──────────────────────────────────────────────────────────────

export interface FlowStep {
  delay_hours: number;
  message: string;
}

export interface AutomationFlow {
  id: string;
  name: string;
  trigger: string;
  steps: FlowStep[];
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export interface ScheduledMsg {
  id: string;
  lead_id: string;
  flow_id: string;
  flow_name: string;
  channel: string;
  message: string;
  scheduled_at: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

export interface AutomationStats {
  total_flows: number;
  active_flows: number;
  messages_pending: number;
  messages_sent: number;
  messages_failed: number;
  messages_cancelled: number;
  by_trigger: Record<string, number>;
}

export async function fetchFlows(): Promise<AutomationFlow[]> {
  const { data } = await api.get<AutomationFlow[]>("/api/automations/flows");
  return data;
}

export async function toggleFlow(id: string, is_active: boolean): Promise<AutomationFlow> {
  const { data } = await api.patch<AutomationFlow>(`/api/automations/flows/${id}`, { is_active });
  return data;
}

export async function deleteFlow(id: string): Promise<void> {
  await api.delete(`/api/automations/flows/${id}`);
}

export async function fetchQueue(params?: { status?: string; skip?: number; limit?: number }): Promise<{ messages: ScheduledMsg[]; total: number }> {
  const { data } = await api.get("/api/automations/queue", { params });
  return data;
}

export async function fetchAutomationStats(): Promise<AutomationStats> {
  const { data } = await api.get<AutomationStats>("/api/automations/stats");
  return data;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number;
  sku: string | null;
  category: string | null;
  variants: any[] | null;
  images: string[] | null;
  is_active: boolean;
  keywords: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  stock?: number;
  sku?: string;
  category?: string;
  variants?: any[];
  images?: string[];
  is_active?: boolean;
  keywords?: string[];
}

export async function fetchProducts(params?: {
  category?: string;
  active_only?: boolean;
  search?: string;
}): Promise<{ products: Product[]; total: number }> {
  const { data } = await api.get("/api/products", { params });
  return data;
}

export async function createProduct(body: ProductCreate): Promise<Product> {
  const { data } = await api.post<Product>("/api/products", body);
  return data;
}

export async function updateProduct(id: string, body: Partial<ProductCreate>): Promise<Product> {
  const { data } = await api.patch<Product>(`/api/products/${id}`, body);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/api/products/${id}`);
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  variant: any | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  lead_id: string | null;
  conversation_id: string | null;
  channel: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  notes: string | null;
  total_amount: number;
  currency: string;
  payment_method: string | null;
  payment_status: string;
  delivery_charge: number;
  discount: number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface OrderStats {
  total: number;
  by_status: Record<string, number>;
  revenue: number;
}

export async function fetchOrders(params?: {
  status?: string;
  lead_id?: string;
  skip?: number;
  limit?: number;
}): Promise<{ orders: Order[]; total: number; skip: number; limit: number }> {
  const { data } = await api.get("/api/orders", { params });
  return data;
}

export async function fetchOrderStats(): Promise<OrderStats> {
  const { data } = await api.get<OrderStats>("/api/orders/stats");
  return data;
}

export async function updateOrderStatus(id: string, status: string): Promise<Order> {
  const { data } = await api.patch<Order>(`/api/orders/${id}/status`, { status });
  return data;
}

// ─── Broadcasts ───────────────────────────────────────────────────────────────

export interface Broadcast {
  id: string;
  name: string;
  message: string;
  channel: string;
  target_stage: string | null;
  target_persona: string | null;
  status: string;
  sent_count: number;
  failed_count: number;
  total_recipients: number;
  error_log: any | null;
  created_at: string;
  updated_at: string;
}

export interface BroadcastCreate {
  name: string;
  message: string;
  channel?: string;
  target_stage?: string;
  target_persona?: string;
}

export async function fetchBroadcasts(params?: { skip?: number; limit?: number }): Promise<{ broadcasts: Broadcast[]; total: number }> {
  const { data } = await api.get("/api/broadcasts", { params });
  return data;
}

export async function createBroadcast(body: BroadcastCreate): Promise<Broadcast> {
  const { data } = await api.post<Broadcast>("/api/broadcasts", body);
  return data;
}

export async function sendBroadcast(id: string): Promise<{ sent: number; failed: number; total: number }> {
  const { data } = await api.post(`/api/broadcasts/${id}/send`);
  return data;
}

// ─── Knowledge Base (RAG) ─────────────────────────────────────────────────────

export interface KnowledgeDoc {
  id: string;
  title: string;
  file_type: string;
  source_name: string | null;
  content_preview: string | null;
  chunk_count: number;
  token_estimate: number;
  is_active: boolean;
  embed_model: string | null;
  created_at: string;
}

export async function fetchKnowledgeDocs(): Promise<{ documents: KnowledgeDoc[]; total: number }> {
  const { data } = await api.get("/api/knowledge");
  return data;
}

export async function uploadKnowledgeDoc(file: File): Promise<KnowledgeDoc> {
  const form = new FormData();
  form.append("file", file, file.name);
  const { data } = await api.post<KnowledgeDoc>("/api/knowledge/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function addKnowledgeText(body: { title: string; content: string }): Promise<KnowledgeDoc> {
  const { data } = await api.post<KnowledgeDoc>("/api/knowledge/text", body);
  return data;
}

export async function deleteKnowledgeDoc(id: string): Promise<void> {
  await api.delete(`/api/knowledge/${id}`);
}

export async function toggleKnowledgeDoc(id: string, is_active: boolean): Promise<KnowledgeDoc> {
  const { data } = await api.patch<KnowledgeDoc>(`/api/knowledge/${id}/toggle`, null, {
    params: { active: is_active },
  });
  return data;
}

export async function searchKnowledge(query: string, top_k = 5): Promise<{ results: { doc_title: string; content: string; score: number }[] }> {
  const { data } = await api.get("/api/knowledge/search/query", { params: { q: query, top_k } });
  return data;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  total_conversations: number;
  total_leads: number;
  converted: number;
  conversion_rate: number;
  hot_conversion_rate: number;
  total_revenue: number;
  avg_intent_score: number;
  response_rate: number;
  msg_per_conversation: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  daily_messages: { date: string; value: number }[];
  daily_leads: { date: string; value: number }[];
  daily_orders: { date: string; value: number }[];
  daily_revenue: { date: string; value: number }[];
  by_channel: Record<string, number>;
  by_persona: Record<string, number>;
  funnel: Record<string, number>;
}

export async function fetchAnalytics(days = 30): Promise<AnalyticsData> {
  const { data } = await api.get<AnalyticsData>("/api/analytics", { params: { days } });
  return data;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface CommentEvent {
  id: string;
  platform: string;
  post_id: string | null;
  comment_id: string;
  user_id: string;
  user_name: string | null;
  content: string;
  handled: boolean;
  auto_replied: boolean;
  reply_message: string | null;
  created_at: string;
}

export interface CommentStats {
  total: number;
  unhandled: number;
  auto_replied: number;
  by_platform: Record<string, number>;
}

export async function fetchComments(params?: {
  platform?: string;
  handled?: boolean;
  skip?: number;
  limit?: number;
}): Promise<{ comments: CommentEvent[]; total: number }> {
  const { data } = await api.get("/api/comments", { params });
  return data;
}

export async function fetchCommentStats(): Promise<CommentStats> {
  const { data } = await api.get<CommentStats>("/api/comments/stats");
  return data;
}

export async function replyToComment(
  id: string,
  message: string,
  reply_mode: "dm" | "comment"
): Promise<void> {
  await api.post(`/api/comments/${id}/reply`, { message, reply_mode });
}

export async function markCommentHandled(id: string): Promise<void> {
  await api.patch(`/api/comments/${id}/mark-handled`);
}
