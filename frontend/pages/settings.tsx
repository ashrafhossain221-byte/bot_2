import { useEffect, useState } from "react";
import { Save, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { fetchSettings, patchSettings, setupTelegramWebhook, BotSettings } from "@/lib/api";

type Status = { type: "success" | "error"; message: string } | null;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 mb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-5 pb-3 border-b border-gray-100">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);

  const [showWaToken, setShowWaToken] = useState(false);
  const [showFbToken, setShowFbToken] = useState(false);
  const [showIgToken, setShowIgToken] = useState(false);

  // Form state
  const [form, setForm] = useState({
    api_key: "",
    provider_name: "groq",
    api_endpoint: "https://api.groq.com/openai/v1",
    model_name: "llama-3.3-70b-versatile",
    bot_name: "BotCore",
    gender: "neutral",
    tone: "friendly",
    reply_language: "auto",
    reply_length: "medium",
    business_name: "",
    business_type: "",
    custom_instructions: "",
    telegram_bot_token: "",
    telegram_webhook_url: "",
    // Phase 6
    whatsapp_access_token: "",
    whatsapp_phone_number_id: "",
    whatsapp_verify_token: "",
    facebook_page_token: "",
    facebook_page_id: "",
    facebook_verify_token: "",
    facebook_app_secret: "",
    instagram_access_token: "",
    instagram_account_id: "",
    comment_auto_reply: "off",
  });

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setSettings(s);
        setForm((f) => ({
          ...f,
          provider_name: s.provider_name,
          api_endpoint: s.api_endpoint,
          model_name: s.model_name,
          bot_name: s.bot_name,
          gender: s.gender,
          tone: s.tone,
          reply_language: s.reply_language,
          reply_length: s.reply_length,
          business_name: s.business_name || "",
          business_type: s.business_type || "",
          custom_instructions: s.custom_instructions || "",
          telegram_webhook_url: s.telegram_webhook_url || "",
          whatsapp_phone_number_id: s.whatsapp_phone_number_id || "",
          facebook_page_id: s.facebook_page_id || "",
          instagram_account_id: s.instagram_account_id || "",
          comment_auto_reply: s.comment_auto_reply || "off",
        }));
      })
      .catch(() => setStatus({ type: "error", message: "Failed to load settings" }))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const update: Record<string, string> = {};
      const fields = [
        "provider_name", "api_endpoint", "model_name",
        "bot_name", "gender", "tone", "reply_language", "reply_length",
        "business_name", "business_type", "custom_instructions", "telegram_webhook_url",
        "whatsapp_phone_number_id", "whatsapp_verify_token",
        "facebook_page_id", "facebook_verify_token",
        "instagram_account_id", "comment_auto_reply",
      ];
      for (const f of fields) {
        const v = form[f as keyof typeof form];
        if (v !== undefined) update[f] = v;
      }
      if (form.api_key) update.api_key = form.api_key;
      if (form.telegram_bot_token) update.telegram_bot_token = form.telegram_bot_token;
      if (form.whatsapp_access_token) update.whatsapp_access_token = form.whatsapp_access_token;
      if (form.facebook_page_token) update.facebook_page_token = form.facebook_page_token;
      if (form.facebook_app_secret) update.facebook_app_secret = form.facebook_app_secret;
      if (form.instagram_access_token) update.instagram_access_token = form.instagram_access_token;

      await patchSettings(update);
      setSettings((s) => s ? { ...s, api_key_set: s.api_key_set || !!form.api_key, telegram_bot_token_set: s.telegram_bot_token_set || !!form.telegram_bot_token } : s);
      setForm((f) => ({ ...f, api_key: "", telegram_bot_token: "" }));
      setStatus({ type: "success", message: "Settings saved successfully" });
    } catch {
      setStatus({ type: "error", message: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!form.telegram_webhook_url) return;
    try {
      const result = await setupTelegramWebhook(form.telegram_webhook_url);
      if (result.ok) {
        setStatus({ type: "success", message: "Telegram webhook set successfully" });
      } else {
        setStatus({ type: "error", message: result.description || "Webhook setup failed" });
      }
    } catch {
      setStatus({ type: "error", message: "Failed to set Telegram webhook" });
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Configure your AI provider, bot identity, and channels</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All
        </button>
      </div>

      {status && (
        <div className={`mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${status.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {status.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {status.message}
        </div>
      )}

      {/* AI Provider */}
      <Section title="AI Provider — Open Connection">
        <p className="text-xs text-gray-500 -mt-2 mb-2">
          Works with any OpenAI-compatible API: Groq, OpenAI, Mistral, DeepSeek, Ollama, etc.
        </p>
        <Field label="API Key" hint={settings?.api_key_set ? "Key is saved (encrypted). Paste a new one to replace it." : "Required — paste your API key here."}>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              className="input pr-10"
              placeholder={settings?.api_key_set ? "●●●●●●●●●●● (saved)" : "sk-..."}
              value={form.api_key}
              onChange={set("api_key")}
            />
            <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <Field label="Provider Name" hint="e.g. groq, openai, mistral, deepseek, ollama">
          <input className="input" value={form.provider_name} onChange={set("provider_name")} placeholder="groq" />
        </Field>
        <Field label="API Endpoint" hint="Base URL without trailing slash">
          <input className="input" value={form.api_endpoint} onChange={set("api_endpoint")} placeholder="https://api.groq.com/openai/v1" />
        </Field>
        <Field label="Model Name">
          <input className="input" value={form.model_name} onChange={set("model_name")} placeholder="llama-3.3-70b-versatile" />
        </Field>
      </Section>

      {/* Bot Identity */}
      <Section title="Bot Identity">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bot Name">
            <input className="input" value={form.bot_name} onChange={set("bot_name")} placeholder="BotCore" />
          </Field>
          <Field label="Gender">
            <select className="input" value={form.gender} onChange={set("gender")}>
              <option value="neutral">Neutral</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Tone">
            <select className="input" value={form.tone} onChange={set("tone")}>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="casual">Casual</option>
              <option value="professional">Professional</option>
              <option value="enthusiastic">Enthusiastic</option>
            </select>
          </Field>
          <Field label="Reply Length">
            <select className="input" value={form.reply_length} onChange={set("reply_length")}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </Field>
          <Field label="Reply Language" hint="auto = detect user language">
            <input className="input" value={form.reply_language} onChange={set("reply_language")} placeholder="auto" />
          </Field>
        </div>
      </Section>

      {/* Business Info */}
      <Section title="Business Info">
        <Field label="Business Name">
          <input className="input" value={form.business_name} onChange={set("business_name")} placeholder="Acme Store" />
        </Field>
        <Field label="Business Type">
          <input className="input" value={form.business_type} onChange={set("business_type")} placeholder="E-commerce, SaaS, Restaurant…" />
        </Field>
        <Field label="Custom Instructions" hint="Extra context the bot should always know about your business">
          <textarea
            className="input min-h-24 resize-y"
            value={form.custom_instructions}
            onChange={set("custom_instructions")}
            placeholder="We offer free delivery above ৳999. Our return policy is 7 days…"
          />
        </Field>
      </Section>

      {/* Telegram */}
      <Section title="Telegram">
        <Field label="Bot Token" hint={settings?.telegram_bot_token_set ? "Token is saved. Paste new to replace." : "Get from @BotFather on Telegram"}>
          <div className="relative">
            <input
              type={showTgToken ? "text" : "password"}
              className="input pr-10"
              placeholder={settings?.telegram_bot_token_set ? "●●●●●●●●●●● (saved)" : "1234567890:ABC..."}
              value={form.telegram_bot_token}
              onChange={set("telegram_bot_token")}
            />
            <button type="button" onClick={() => setShowTgToken(!showTgToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showTgToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <Field label="Webhook URL" hint="Your Railway backend URL + /api/telegram/webhook">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={form.telegram_webhook_url}
              onChange={set("telegram_webhook_url")}
              placeholder="https://your-app.railway.app/api/telegram/webhook"
            />
            <button onClick={handleSetWebhook} className="btn-secondary whitespace-nowrap">
              Set Webhook
            </button>
          </div>
        </Field>
      </Section>

      {/* WhatsApp */}
      <Section title="WhatsApp (Meta Cloud API)">
        <p className="text-xs text-gray-400 -mt-2 mb-2">
          Webhook URL: <code className="bg-gray-100 px-1 rounded">{`${process.env.NEXT_PUBLIC_API_URL || "https://your-backend.railway.app"}/api/whatsapp/webhook`}</code>
        </p>
        <Field label="Access Token" hint={settings?.whatsapp_configured ? "Saved. Paste new to replace." : "Permanent token from Meta Developer Console"}>
          <div className="relative">
            <input type={showWaToken ? "text" : "password"} className="input pr-10"
              placeholder={settings?.whatsapp_configured ? "●●●●●●●● (saved)" : "EAABwzLix..."}
              value={form.whatsapp_access_token} onChange={set("whatsapp_access_token")} />
            <button type="button" onClick={() => setShowWaToken(!showWaToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone Number ID" hint="From Meta Developer Console → WhatsApp → Phone numbers">
            <input className="input" value={form.whatsapp_phone_number_id} onChange={set("whatsapp_phone_number_id")} placeholder="123456789..." />
          </Field>
          <Field label="Verify Token" hint="Any string — must match when setting up the webhook">
            <input className="input" value={form.whatsapp_verify_token} onChange={set("whatsapp_verify_token")} placeholder="botcore_wh_verify" />
          </Field>
        </div>
      </Section>

      {/* Facebook */}
      <Section title="Facebook Messenger">
        <p className="text-xs text-gray-400 -mt-2 mb-2">
          Webhook URL: <code className="bg-gray-100 px-1 rounded">{`${process.env.NEXT_PUBLIC_API_URL || "https://your-backend.railway.app"}/api/facebook/webhook`}</code>
        </p>
        <Field label="Page Access Token" hint={settings?.facebook_configured ? "Saved. Paste new to replace." : "From Meta Developer Console → Messenger → Generate token"}>
          <div className="relative">
            <input type={showFbToken ? "text" : "password"} className="input pr-10"
              placeholder={settings?.facebook_configured ? "●●●●●●●● (saved)" : "EAABwzLix..."}
              value={form.facebook_page_token} onChange={set("facebook_page_token")} />
            <button type="button" onClick={() => setShowFbToken(!showFbToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showFbToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Page ID">
            <input className="input" value={form.facebook_page_id} onChange={set("facebook_page_id")} placeholder="Your Facebook Page ID" />
          </Field>
          <Field label="Verify Token">
            <input className="input" value={form.facebook_verify_token} onChange={set("facebook_verify_token")} placeholder="botcore_fb_verify" />
          </Field>
        </div>
        <Field label="App Secret" hint="Used to verify webhook signatures — keep confidential">
          <input type="password" className="input" value={form.facebook_app_secret} onChange={set("facebook_app_secret")} placeholder="App secret from Meta Developer Console" />
        </Field>
      </Section>

      {/* Instagram */}
      <Section title="Instagram DMs">
        <p className="text-xs text-gray-400 -mt-2 mb-2">
          Uses same webhook as Facebook. Webhook URL: <code className="bg-gray-100 px-1 rounded">{`${process.env.NEXT_PUBLIC_API_URL || "https://your-backend.railway.app"}/api/instagram/webhook`}</code>
        </p>
        <Field label="Access Token" hint={settings?.instagram_configured ? "Saved. Paste new to replace." : "Instagram Graph API access token"}>
          <div className="relative">
            <input type={showIgToken ? "text" : "password"} className="input pr-10"
              placeholder={settings?.instagram_configured ? "●●●●●●●● (saved)" : "EAABwzLix..."}
              value={form.instagram_access_token} onChange={set("instagram_access_token")} />
            <button type="button" onClick={() => setShowIgToken(!showIgToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showIgToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <Field label="Instagram Account ID">
          <input className="input" value={form.instagram_account_id} onChange={set("instagram_account_id")} placeholder="Your Instagram Business Account ID" />
        </Field>
      </Section>

      {/* Comment Auto-Reply */}
      <Section title="Comment Auto-Reply">
        <Field label="Mode" hint="When a comment is received on Facebook/Instagram, the bot can:">
          <select className="input" value={form.comment_auto_reply} onChange={set("comment_auto_reply")}>
            <option value="off">Off — store comments only, no auto-reply</option>
            <option value="dm">DM — reply via private message to the commenter</option>
            <option value="comment">Comment — reply publicly on the same post</option>
          </select>
        </Field>
      </Section>

      {/* Website Widget */}
      <Section title="Website Chat Widget">
        <p className="text-sm text-gray-600">
          Embed the chat widget on any webpage by adding this script tag:
        </p>
        <div className="bg-gray-900 rounded-lg p-4 text-xs text-green-400 font-mono overflow-x-auto">
          {`<script
  src="${process.env.NEXT_PUBLIC_API_URL || "https://your-backend.railway.app"}/widget/chat.js"
  data-bot-id="1"
  defer
></script>`}
        </div>
        <p className="text-xs text-gray-400">
          The widget connects to your backend and uses all settings configured above.
          Full standalone widget file is in <code>backend/widget/chat.js</code> (Phase 1 completion).
        </p>
      </Section>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Settings
        </button>
      </div>
    </div>
  );
}
