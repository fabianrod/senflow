"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type ConversationTab = "active" | "quiet" | "all";

type ConversationSummary = {
  id: string;
  remoteJid: string;
  updatedAt: string;
  contactName?: string | null;
  contactPhone?: string | null;
  lastMessage?: {
    id: string;
    direction: string;
    content?: string | null;
    createdAt: string;
  };
};

type ChatMessage = {
  id: string;
  chatId: string;
  direction: string;
  content?: string | null;
  createdAt: string;
};

type ChatEvent = {
  type: "chat.message.created";
  accountId: string;
  payload: {
    chatId: string;
    remoteJid: string;
    direction: "incoming" | "outgoing";
    content?: string | null;
    createdAt: string;
  };
};

type Props = {
  selectedAccountId: string;
  isConnected: boolean;
};

type CollectionItem = {
  id: string;
  name: string;
};

type ContactOption = {
  id: string;
  name?: string | null;
  phoneNormalized?: string | null;
  phoneRaw?: string | null;
};

const CONVERSATIONS_TAB_STORAGE_KEY = "conversations.activeTab";

function displayName(conversation: ConversationSummary): string {
  return (
    conversation.contactName?.trim() ||
    conversation.contactPhone?.trim() ||
    conversation.remoteJid.replace("@s.whatsapp.net", "")
  );
}

function displayPreview(content?: string | null): string {
  if (!content?.trim()) {
    return "Mensaje multimedia";
  }
  return content;
}

function formatMessageDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessageTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isLidJid(remoteJid?: string | null): boolean {
  return Boolean(remoteJid && remoteJid.includes("@lid"));
}

export function ConversationsPanel({ selectedAccountId, isConnected }: Props) {
  const [activeTab, setActiveTab] = useState<ConversationTab>("active");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [collectionContacts, setCollectionContacts] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [startingConversation, setStartingConversation] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [deletingChats, setDeletingChats] = useState(false);

  async function loadConversations(tab: ConversationTab) {
    if (!selectedAccountId) {
      setConversations([]);
      return;
    }
    setLoadingConversations(true);
    setConversationsError(null);
    try {
      const params = new URLSearchParams({
        accountId: selectedAccountId,
        tab,
        limit: "50",
      });
      const response = await fetch(`/api/chat/conversations?${params.toString()}`);
      const data = (await response.json()) as { ok: boolean; error?: string; data?: ConversationSummary[] };
      if (!response.ok || !data.ok) {
        setConversationsError(data.error ?? "No se pudieron cargar las conversaciones.");
        setConversations([]);
        return;
      }
      const next = data.data ?? [];
      const visible = next.filter((conversation) => !isLidJid(conversation.remoteJid));
      setConversations(visible);
      if (!selectedChatId) {
        setSelectedChatId(visible[0]?.id ?? "");
      }
    } finally {
      setLoadingConversations(false);
    }
  }

  async function loadCollections() {
    const response = await fetch("/api/collection");
    const data = (await response.json()) as { ok: boolean; data?: CollectionItem[] };
    if (!response.ok || !data.ok) {
      setCollections([]);
      return;
    }
    const next = data.data ?? [];
    setCollections(next);
    if (!next.some((item) => item.id === selectedCollectionId)) {
      setSelectedCollectionId(next[0]?.id ?? "");
    }
  }

  async function loadCollectionContacts(collectionId: string) {
    if (!collectionId) {
      setCollectionContacts([]);
      setSelectedContactId("");
      return;
    }
    const response = await fetch(`/api/collection/${encodeURIComponent(collectionId)}/contacts`);
    const data = (await response.json()) as { ok: boolean; data?: ContactOption[] };
    if (!response.ok || !data.ok) {
      setCollectionContacts([]);
      setSelectedContactId("");
      return;
    }
    const next = (data.data ?? []).filter((contact) => contact.phoneNormalized);
    setCollectionContacts(next);
    if (!next.some((item) => item.id === selectedContactId)) {
      setSelectedContactId(next[0]?.id ?? "");
    }
  }

  async function startConversation() {
    if (!selectedAccountId || !selectedContactId) {
      return;
    }
    setStartingConversation(true);
    setConversationsError(null);
    try {
      const response = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          contactId: selectedContactId,
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string; data?: { chatId?: string } };
      if (!response.ok || !data.ok) {
        setConversationsError(data.error ?? "No se pudo iniciar la conversacion.");
        return;
      }
      setActiveTab("all");
      await loadConversations("all");
      if (data.data?.chatId) {
        setSelectedChatId(data.data.chatId);
        await loadMessages(data.data.chatId);
      }
      setShowStartModal(false);
    } finally {
      setStartingConversation(false);
    }
  }

  async function loadMessages(chatId: string) {
    if (!selectedAccountId || !chatId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    try {
      const params = new URLSearchParams({
        accountId: selectedAccountId,
        limit: "200",
      });
      const response = await fetch(`/api/chat/${encodeURIComponent(chatId)}/messages?${params.toString()}`);
      const data = (await response.json()) as { ok: boolean; error?: string; data?: ChatMessage[] };
      if (!response.ok || !data.ok) {
        return;
      }
      setMessages(data.data ?? []);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function deleteSingleConversation(chatId: string) {
    if (!selectedAccountId) {
      return;
    }
    const confirmed = window.confirm("¿Eliminar esta conversación?");
    if (!confirmed) {
      return;
    }
    setDeletingChats(true);
    setConversationsError(null);
    try {
      const response = await fetch(`/api/chat/${encodeURIComponent(chatId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setConversationsError(data.error ?? "No se pudo eliminar la conversación.");
        return;
      }
      setSelectedChatIds((prev) => prev.filter((id) => id !== chatId));
      if (selectedChatId === chatId) {
        setSelectedChatId("");
        setMessages([]);
      }
      await loadConversations(activeTab);
    } finally {
      setDeletingChats(false);
    }
  }

  async function deleteSelectedConversations() {
    if (!selectedAccountId || selectedChatIds.length === 0) {
      return;
    }
    const confirmed = window.confirm(`¿Eliminar ${selectedChatIds.length} conversaciones seleccionadas?`);
    if (!confirmed) {
      return;
    }
    setDeletingChats(true);
    setConversationsError(null);
    try {
      const response = await fetch("/api/chat/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          chatIds: selectedChatIds,
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setConversationsError(data.error ?? "No se pudieron eliminar las conversaciones.");
        return;
      }
      if (selectedChatId && selectedChatIds.includes(selectedChatId)) {
        setSelectedChatId("");
        setMessages([]);
      }
      setSelectedChatIds([]);
      await loadConversations(activeTab);
    } finally {
      setDeletingChats(false);
    }
  }

  useEffect(() => {
    const storedTab = window.localStorage.getItem(CONVERSATIONS_TAB_STORAGE_KEY);
    if (storedTab === "active" || storedTab === "quiet" || storedTab === "all") {
      setActiveTab(storedTab);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CONVERSATIONS_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    setSelectedChatId("");
    setMessages([]);
    setSelectedChatIds([]);
    void loadConversations(activeTab);
  }, [selectedAccountId, activeTab]);

  useEffect(() => {
    if (!showStartModal) {
      return;
    }
    void loadCollections();
  }, [showStartModal]);

  useEffect(() => {
    if (!showStartModal) {
      return;
    }
    void loadCollectionContacts(selectedCollectionId);
  }, [showStartModal, selectedCollectionId]);

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedChatId);
  }, [selectedChatId, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) {
      return;
    }
    const source = new EventSource(`/api/chat/events?accountId=${encodeURIComponent(selectedAccountId)}`);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as ChatEvent;
      if (payload.type !== "chat.message.created") {
        return;
      }
      if (isLidJid(payload.payload.remoteJid)) {
        return;
      }

      setConversations((prev) => {
        const existing = prev.find((item) => item.id === payload.payload.chatId);
        if (!existing) {
          void loadConversations(activeTab);
          return prev;
        }

        const updated: ConversationSummary = {
          ...existing,
          updatedAt: payload.payload.createdAt,
          lastMessage: {
            id: payload.payload.chatId + payload.payload.createdAt,
            direction: payload.payload.direction,
            content: payload.payload.content,
            createdAt: payload.payload.createdAt,
          },
        };

        const next = [updated, ...prev.filter((item) => item.id !== existing.id)];
        if (activeTab === "all") {
          return next;
        }
        if (activeTab === "active") {
          return next.filter((item) => item.lastMessage?.direction === "incoming");
        }
        return next.filter((item) => item.lastMessage?.direction === "outgoing");
      });

      if (payload.payload.chatId === selectedChatId) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${payload.payload.chatId}-${payload.payload.createdAt}`,
            chatId: payload.payload.chatId,
            direction: payload.payload.direction,
            content: payload.payload.content,
            createdAt: payload.payload.createdAt,
          },
        ]);
      }
    };
    return () => source.close();
  }, [selectedAccountId, selectedChatId, activeTab]);

  async function sendMessage() {
    if (!selectedAccountId || !selectedChatId || !draft.trim()) {
      return;
    }
    setSending(true);
    const targetChatId = selectedChatId;
    try {
      const response = await fetch(`/api/chat/${encodeURIComponent(selectedChatId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          text: draft.trim(),
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setConversationsError(data.error ?? "No se pudo enviar el mensaje.");
        return;
      }
      setDraft("");
      // Refresco inmediato para que el usuario vea el mensaje aunque el SSE llegue tarde.
      await loadMessages(targetChatId);
      await loadConversations(activeTab);
    } finally {
      setSending(false);
    }
  }

  const selectedConversation = conversations.find((item) => item.id === selectedChatId) ?? null;

  return (
    <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Conversaciones</h3>
              <p className="text-sm text-slate-500">Inbox en tiempo real por numero activo.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowStartModal(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
              aria-label="Iniciar conversación"
              title="Iniciar conversación"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            {[
              { id: "active", label: "Activas" },
              { id: "quiet", label: "Sin novedad" },
              { id: "all", label: "Todas" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ConversationTab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  activeTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {selectedChatIds.length > 0 ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void deleteSelectedConversations()}
                disabled={deletingChats}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Eliminar ${selectedChatIds.length} conversaciones seleccionadas`}
                title={`Eliminar ${selectedChatIds.length} conversaciones seleccionadas`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : null}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loadingConversations ? <p className="p-3 text-sm text-slate-500">Cargando conversaciones...</p> : null}
          {!loadingConversations && conversations.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No hay conversaciones en esta pestaña.</p>
          ) : null}
          {conversations.map((conversation) => {
            const isSelected = selectedChatId === conversation.id;
            const isChecked = selectedChatIds.includes(conversation.id);
            return (
              <div
                key={conversation.id}
                className={`w-full border-b border-slate-100 px-3 py-3 text-left transition ${
                  isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedChatIds((prev) =>
                        checked ? [...new Set([...prev, conversation.id])] : prev.filter((id) => id !== conversation.id),
                      );
                    }}
                    className="mt-1"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedChatId(conversation.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-semibold text-slate-800">{displayName(conversation)}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                      {!conversation.lastMessage
                        ? "Conversación iniciada. Aún sin mensajes."
                        : `${conversation.lastMessage.direction === "incoming" ? "Contacto: " : "Nosotros: "}${displayPreview(conversation.lastMessage.content)}`}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatMessageDateTime(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}
                    </p>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-base font-semibold">
              {selectedConversation ? displayName(selectedConversation) : "Selecciona una conversacion"}
            </h4>
            {selectedConversation ? (
              <button
                type="button"
                onClick={() => void deleteSingleConversation(selectedConversation.id)}
                disabled={deletingChats}
                className="rounded-md border border-rose-300 bg-white p-1.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Eliminar conversación"
                title="Eliminar conversación"
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
          {!isConnected ? (
            <p className="text-xs text-amber-700">Conecta el numero activo para enviar mensajes desde esta vista.</p>
          ) : null}
        </div>
        <div className="h-[50vh] overflow-y-auto bg-slate-50 p-3">
          {loadingMessages ? <p className="text-sm text-slate-500">Cargando mensajes...</p> : null}
          {!loadingMessages && messages.length === 0 ? (
            <p className="text-sm text-slate-500">Sin mensajes en esta conversacion.</p>
          ) : null}
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.direction === "outgoing" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`inline-block w-fit max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    message.direction === "outgoing"
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {displayPreview(message.content)}
                  <p
                    className={`mt-1 text-[11px] ${
                      message.direction === "outgoing" ? "text-blue-100" : "text-slate-500"
                    }`}
                  >
                    {formatMessageTime(message.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-slate-200 p-3">
          {conversationsError ? <p className="mb-2 text-xs text-red-600">{conversationsError}</p> : null}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!selectedChatId || !isConnected || sending}
              placeholder="Escribe un mensaje..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!selectedChatId || !draft.trim() || !isConnected || sending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>

      {showStartModal ? (
        <div className="fixed inset-0 z-[120] bg-black/35 p-4">
          <div className="mx-auto mt-16 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <h5 className="text-base font-semibold">Iniciar conversación</h5>
            <p className="mt-1 text-sm text-slate-500">
              Elige una colección y un contacto para abrir el chat en el número activo.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colección</span>
                <select
                  value={selectedCollectionId}
                  onChange={(event) => setSelectedCollectionId(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contacto</span>
                <select
                  value={selectedContactId}
                  onChange={(event) => setSelectedContactId(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {collectionContacts.length === 0 ? (
                    <option value="">Sin contactos con telefono normalizado</option>
                  ) : null}
                  {collectionContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {(contact.name?.trim() || "Sin nombre") +
                        " - " +
                        (contact.phoneNormalized || contact.phoneRaw || "Sin telefono")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void startConversation()}
                disabled={!selectedContactId || startingConversation}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {startingConversation ? "Iniciando..." : "Iniciar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
