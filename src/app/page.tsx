"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  MoreHorizontal,
  Settings,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { ConversationsPanel } from "@/app/components/conversations-panel";

type SessionStatus =
  | "disconnected"
  | "qr_pending"
  | "connected"
  | "reconnecting"
  | "error";

type SessionState = {
  status: SessionStatus;
  qr?: string;
  lastUpdatedAt: string;
  errorMessage?: string;
  connectedPhone?: string;
};

type ContactStatus = "pending" | "sent" | "failed" | "skipped" | "invalid" | "duplicate";

type ContactRecord = {
  id: string;
  rowIndex: number;
  name: string;
  phoneRaw: string;
  phoneNormalized?: string;
  status: ContactStatus;
  error?: string;
  attempts: number;
};

type CsvSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
};

type MediaType = "image" | "video";

type MessageConfig = {
  template: string;
  variations: string;
  mediaType: "" | MediaType;
  mediaUrl: string;
  fallbackName: string;
};

type MessagePreviewItem = {
  contactId: string;
  name: string;
  phoneNormalized?: string;
  message: string;
  mediaType?: MediaType;
  mediaUrl?: string;
};

type CampaignListItem = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  startDate?: string | null;
  endDate?: string | null;
};

type CampaignStatsData = {
  campaign: CampaignListItem;
  totals: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    pending: number;
  };
  contacts: ContactRecord[];
};

type CampaignRealtimeSnapshot = {
  campaignId?: string;
  status: string;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  percentage: number;
  lastResult?: {
    contactId: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
  };
};

type ThrottleConfigForm = {
  mode: "fixed" | "range";
  fixedSeconds: number;
  minSeconds: number;
  maxSeconds: number;
  retryCount: 0 | 1;
};

type AccountItem = {
  id: string;
  name: string;
  status: SessionStatus;
  phoneNumber?: string | null;
};

type CollectionItem = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type CollectionContactItem = {
  id: string;
  name?: string | null;
  phoneRaw?: string | null;
  phoneNormalized?: string | null;
  rowIndex?: number | null;
};

type MenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type SuperAdminColumn = {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
};

type SuperAdminTable = {
  name: string;
  columns: SuperAdminColumn[];
};

type SuperAdminEditableCell = {
  value: string;
  setNull: boolean;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const cardClass = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

export default function HomePage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [renamingAccountName, setRenamingAccountName] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    "connect" | "disconnect" | "delete-account" | null
  >(null);
  const [csvSummary, setCsvSummary] = useState<CsvSummary | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [openCollectionMenuId, setOpenCollectionMenuId] = useState<string | null>(null);
  const [collectionMenuPosition, setCollectionMenuPosition] = useState<{ top: number; right: number } | null>(
    null,
  );
  const [openContactMenuId, setOpenContactMenuId] = useState<string | null>(null);
  const [contactMenuPosition, setContactMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [editingContact, setEditingContact] = useState<CollectionContactItem | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPhoneRaw, setEditingPhoneRaw] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [deletingContacts, setDeletingContacts] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [pendingDeleteContactIds, setPendingDeleteContactIds] = useState<string[]>([]);
  const [collectionContacts, setCollectionContacts] = useState<CollectionContactItem[]>([]);
  const [loadingCollectionContacts, setLoadingCollectionContacts] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCollectionId, setUploadCollectionId] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showCreateCollectionForm, setShowCreateCollectionForm] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [messageConfig, setMessageConfig] = useState<MessageConfig>({
    template: "Hola {name}, te comparto nuestra propuesta para tu marca.",
    variations: "",
    mediaType: "",
    mediaUrl: "",
    fallbackName: "cliente",
  });
  const [savingMessage, setSavingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messagePreview, setMessagePreview] = useState<MessagePreviewItem[]>([]);
  const [showMessagePreviewModal, setShowMessagePreviewModal] = useState(false);
  const [throttle, setThrottle] = useState<ThrottleConfigForm>({
    mode: "range",
    fixedSeconds: 5,
    minSeconds: 4,
    maxSeconds: 8,
    retryCount: 1,
  });
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [selectedCampaignCollectionId, setSelectedCampaignCollectionId] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [openCampaignMenuId, setOpenCampaignMenuId] = useState<string | null>(null);
  const [campaignMenuPosition, setCampaignMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [selectedCampaignStats, setSelectedCampaignStats] = useState<CampaignStatsData | null>(null);
  const [loadingCampaignStats, setLoadingCampaignStats] = useState(false);
  const [showDeleteCampaignModal, setShowDeleteCampaignModal] = useState(false);
  const [campaignDeleteConfirmText, setCampaignDeleteConfirmText] = useState("");
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignListItem | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [isAddingNewNumber, setIsAddingNewNumber] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [activeSection, setActiveSection] = useState("campanas");
  const [superAdminTables, setSuperAdminTables] = useState<SuperAdminTable[]>([]);
  const [loadingSuperAdminTables, setLoadingSuperAdminTables] = useState(false);
  const [superAdminError, setSuperAdminError] = useState<string | null>(null);
  const [selectedSuperAdminTable, setSelectedSuperAdminTable] = useState("");
  const [superAdminRows, setSuperAdminRows] = useState<Record<string, unknown>[]>([]);
  const [superAdminDatabasePath, setSuperAdminDatabasePath] = useState<string | null>(null);
  const [loadingSuperAdminRows, setLoadingSuperAdminRows] = useState(false);
  const [cleaningDatabase, setCleaningDatabase] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editableRowDraft, setEditableRowDraft] = useState<Record<string, SuperAdminEditableCell>>({});
  const [savingSuperAdminRow, setSavingSuperAdminRow] = useState(false);
  const previousSessionStatusRef = useRef<SessionStatus | null>(null);

  const canConnect = useMemo(() => {
    return Boolean(selectedAccountId) && session?.status !== "connected" && loadingAction === null;
  }, [selectedAccountId, session?.status, loadingAction]);

  useEffect(() => {
    const selected = accounts.find((account) => account.id === selectedAccountId);
    setRenamingAccountName(selected?.name ?? "");
  }, [accounts, selectedAccountId]);

  async function loadAccounts() {
    const response = await fetch("/api/account");
    let data: { ok: boolean; data?: AccountItem[] } | null = null;
    try {
      data = (await response.json()) as { ok: boolean; data?: AccountItem[] };
    } catch {
      return;
    }
    if (!response.ok || !data?.ok) {
      return;
    }
    const nextAccounts = data.data ?? [];
    setAccounts(nextAccounts);
    if (nextAccounts.length === 0) {
      setSelectedAccountId("");
      return;
    }
    if (!nextAccounts.some((account) => account.id === selectedAccountId)) {
      const savedAccountId =
        typeof window !== "undefined" ? window.localStorage.getItem("bw-selected-account-id") : null;
      const preferred =
        savedAccountId && nextAccounts.some((account) => account.id === savedAccountId)
          ? savedAccountId
          : nextAccounts[0]?.id ?? "default";
      setSelectedAccountId(preferred);
    }
  }

  async function loadCampaigns(accountId?: string) {
    setLoadingCampaigns(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      const resolvedAccountId = accountId ?? selectedAccountId;
      if (resolvedAccountId) {
        params.set("accountId", resolvedAccountId);
      }
      const response = await fetch(`/api/campaign/list?${params.toString()}`);
      const data =
        (await readApiJsonSafe<{ ok: boolean; data?: CampaignListItem[] }>(response)) ??
        ({ ok: false } as const);
      if (!response.ok || !data.ok) {
        return;
      }
      setCampaigns(data.data ?? []);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  async function loadCollections() {
    setLoadingCollections(true);
    setCollectionsError(null);
    try {
      const response = await fetch("/api/collection");
      const data = (await readApiJsonSafe<{
        ok: boolean;
        error?: string;
        data?: CollectionItem[];
      }>(response)) ?? { ok: false, error: "Respuesta inválida del servidor." };
      if (!response.ok || !data.ok) {
        setCollectionsError(data.error ?? "No se pudieron cargar las colecciones.");
        setCollections([]);
        setSelectedCollectionId("");
        return;
      }
      const nextCollections = data.data ?? [];
      setCollections(nextCollections);
      if (!nextCollections.some((item) => item.id === selectedCollectionId)) {
        setSelectedCollectionId("");
      }
    } finally {
      setLoadingCollections(false);
    }
  }

  async function loadSessionStatus(accountId: string) {
    const response = await fetch(`/api/session/status?accountId=${encodeURIComponent(accountId)}`);
    const data =
      (await readApiJsonSafe<{ ok: boolean; data?: SessionState }>(response)) ?? ({ ok: false } as const);
    if (!response.ok || !data.ok || !data.data) {
      return;
    }
    setSession(data.data);
  }

  async function loadCollectionContacts(collectionId: string) {
    if (!collectionId) {
      setCollectionContacts([]);
      return;
    }
    setLoadingCollectionContacts(true);
    setCollectionsError(null);
    try {
      const response = await fetch(`/api/collection/${encodeURIComponent(collectionId)}/contacts`);
      const data = (await readApiJsonSafe<{
        ok: boolean;
        error?: string;
        data?: CollectionContactItem[];
      }>(response)) ?? { ok: false, error: "Respuesta inválida del servidor." };
      if (!response.ok || !data.ok) {
        setCollectionsError(data.error ?? "No se pudieron cargar los contactos de la coleccion.");
        setCollectionContacts([]);
        return;
      }
      setCollectionContacts(data.data ?? []);
    } finally {
      setLoadingCollectionContacts(false);
    }
  }

  function formatSuperAdminCellValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  async function readApiJsonSafe<T>(response: Response): Promise<T | null> {
    const raw = await response.text();
    if (!raw.trim()) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async function loadSuperAdminTables() {
    setLoadingSuperAdminTables(true);
    setSuperAdminError(null);
    try {
      const response = await fetch("/api/super-admin/tables");
      const data = (await readApiJsonSafe<{
        ok: boolean;
        error?: string;
        data?: SuperAdminTable[];
        databasePath?: string | null;
      }>(response)) ?? { ok: false, error: "Respuesta inválida del servidor." };
      if (!response.ok || !data.ok) {
        setSuperAdminError(data.error ?? "No se pudieron cargar las tablas.");
        setSuperAdminTables([]);
        setSelectedSuperAdminTable("");
        setSuperAdminDatabasePath(null);
        return;
      }
      const nextTables = data.data ?? [];
      setSuperAdminTables(nextTables);
      setSuperAdminDatabasePath(data.databasePath ?? null);
      setSelectedSuperAdminTable((prev) =>
        nextTables.some((table) => table.name === prev) ? prev : (nextTables[0]?.name ?? ""),
      );
    } finally {
      setLoadingSuperAdminTables(false);
    }
  }

  async function loadSuperAdminRows(tableName: string) {
    if (!tableName) {
      setSuperAdminRows([]);
      return;
    }
    setLoadingSuperAdminRows(true);
    setSuperAdminError(null);
    try {
      const response = await fetch(`/api/super-admin/tables/${encodeURIComponent(tableName)}/rows?limit=100`);
      const data = (await readApiJsonSafe<{
        ok: boolean;
        error?: string;
        data?: Record<string, unknown>[];
      }>(response)) ?? { ok: false, error: "Respuesta inválida del servidor." };
      if (!response.ok || !data.ok) {
        setSuperAdminError(data.error ?? "No se pudieron cargar los registros.");
        setSuperAdminRows([]);
        return;
      }
      setSuperAdminRows(data.data ?? []);
    } finally {
      setLoadingSuperAdminRows(false);
    }
  }

  function openSuperAdminRowEditor(row: Record<string, unknown>, rowIndex: number) {
    const draft: Record<string, SuperAdminEditableCell> = {};
    for (const [column, value] of Object.entries(row)) {
      draft[column] = {
        value: formatSuperAdminCellValue(value),
        setNull: value === null,
      };
    }
    setEditableRowDraft(draft);
    setEditingRowIndex(rowIndex);
  }

  function closeSuperAdminRowEditor() {
    setEditingRowIndex(null);
    setEditableRowDraft({});
  }

  async function saveSuperAdminRow() {
    if (editingRowIndex === null || !selectedSuperAdminTable) {
      return;
    }
    const originalRow = superAdminRows[editingRowIndex];
    if (!originalRow) {
      return;
    }
    const changes: Record<string, unknown> = {};
    for (const [column, draft] of Object.entries(editableRowDraft)) {
      const nextValue = draft.setNull ? null : draft.value;
      const originalValue = (originalRow as Record<string, unknown>)[column] ?? null;
      if (originalValue === nextValue) {
        continue;
      }
      changes[column] = nextValue;
    }
    if (Object.keys(changes).length === 0) {
      closeSuperAdminRowEditor();
      return;
    }

    setSavingSuperAdminRow(true);
    setSuperAdminError(null);
    try {
      const response = await fetch(`/api/super-admin/tables/${encodeURIComponent(selectedSuperAdminTable)}/rows`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match: originalRow,
          changes,
        }),
      });
      const data =
        (await readApiJsonSafe<{ ok: boolean; error?: string }>(response)) ??
        ({ ok: false, error: "Respuesta inválida del servidor." } as const);
      if (!response.ok || !data.ok) {
        setSuperAdminError(data.error ?? "No se pudo guardar el registro.");
        return;
      }
      closeSuperAdminRowEditor();
      await loadSuperAdminRows(selectedSuperAdminTable);
    } finally {
      setSavingSuperAdminRow(false);
    }
  }

  async function cleanupDatabase() {
    const confirmed = window.confirm(
      "Esto eliminará campañas, colecciones, contactos, chats y tablas relacionadas. ¿Deseas continuar?",
    );
    if (!confirmed) {
      return;
    }
    const confirmedAgain = window.confirm("Última confirmación: esta acción no se puede deshacer. ¿Limpiar ahora?");
    if (!confirmedAgain) {
      return;
    }

    setCleaningDatabase(true);
    setSuperAdminError(null);
    try {
      const response = await fetch("/api/super-admin/cleanup", { method: "POST" });
      const data =
        (await readApiJsonSafe<{ ok: boolean; error?: string }>(response)) ??
        ({ ok: false, error: "Respuesta inválida del servidor." } as const);
      if (!response.ok || !data.ok) {
        setSuperAdminError(data.error ?? "No se pudo limpiar la base de datos.");
        return;
      }

      await Promise.all([loadCollections(), loadCampaigns(), loadSuperAdminTables()]);
      await loadSuperAdminRows(selectedSuperAdminTable);
    } finally {
      setCleaningDatabase(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
    void loadCollections();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && selectedAccountId) {
      window.localStorage.setItem("bw-selected-account-id", selectedAccountId);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (activeSection === "contacts") {
      setSelectedCollectionId("");
      setCollectionContacts([]);
      setOpenCollectionMenuId(null);
      setCollectionMenuPosition(null);
      setOpenContactMenuId(null);
      setContactMenuPosition(null);
      setSelectedContactIds([]);
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "super-admin") {
      return;
    }
    void loadSuperAdminTables();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "super-admin") {
      return;
    }
    setEditingRowIndex(null);
    setEditableRowDraft({});
    void loadSuperAdminRows(selectedSuperAdminTable);
  }, [activeSection, selectedSuperAdminTable]);

  useEffect(() => {
    function closeMenuOnOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-collection-menu]") && !target.closest("[data-collection-menu-trigger]")) {
        setOpenCollectionMenuId(null);
        setCollectionMenuPosition(null);
      }
      if (!target.closest("[data-contact-menu]") && !target.closest("[data-contact-menu-trigger]")) {
        setOpenContactMenuId(null);
        setContactMenuPosition(null);
      }
      if (!target.closest("[data-campaign-menu]") && !target.closest("[data-campaign-menu-trigger]")) {
        setOpenCampaignMenuId(null);
        setCampaignMenuPosition(null);
      }
    }
    document.addEventListener("click", closeMenuOnOutsideClick);
    return () => document.removeEventListener("click", closeMenuOnOutsideClick);
  }, []);

  useEffect(() => {
    void loadCollectionContacts(selectedCollectionId);
  }, [selectedCollectionId]);

  const canDisconnect = useMemo(() => {
    return Boolean(selectedAccountId) && session?.status === "connected" && loadingAction === null;
  }, [selectedAccountId, session?.status, loadingAction]);

  const statusBadgeClassByAccount: Record<SessionStatus, string> = {
    connected: "bg-emerald-100 text-emerald-700",
    qr_pending: "bg-amber-100 text-amber-700",
    reconnecting: "bg-blue-100 text-blue-700",
    disconnected: "bg-slate-100 text-slate-700",
    error: "bg-rose-100 text-rose-700",
  };

  const sessionStatusLabel: Record<SessionStatus, string> = {
    disconnected: "Desconectado",
    qr_pending: "QR listo para escanear",
    reconnecting: "Generando QR...",
    connected: "Conectado",
    error: "Error de conexion",
  };

  useEffect(() => {
    if (!selectedAccountId) {
      setSession(null);
      return;
    }
    const source = new EventSource(
      `/api/session/events?accountId=${encodeURIComponent(selectedAccountId)}`,
    );

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { state?: SessionState };
      if (data.state) {
        setSession(data.state);
        setAccounts((prev) =>
          prev.map((account) =>
            account.id === selectedAccountId
              ? {
                  ...account,
                  status: data.state?.status ?? account.status,
                  phoneNumber:
                    data.state?.status === "connected"
                      ? (data.state.connectedPhone ?? account.phoneNumber ?? null)
                      : account.phoneNumber,
                }
              : account,
          ),
        );
      }
    };

    source.onerror = () => {
      // Permitimos reconexion automatica de EventSource para no perder eventos de QR.
    };

    return () => {
      source.close();
    };
  }, [selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) {
      return;
    }
    void loadSessionStatus(selectedAccountId);
  }, [selectedAccountId]);

  useEffect(() => {
    void loadCampaigns(selectedAccountId);
  }, [selectedAccountId]);

  useEffect(() => {
    const previous = previousSessionStatusRef.current;
    const current = session?.status ?? null;

    if (
      activeSection === "connect-number" &&
      current === "connected" &&
      previous !== "connected"
    ) {
      setActiveSection("numbers");
    }

    previousSessionStatusRef.current = current;
  }, [activeSection, session?.status]);

  async function connectSession(accountId?: string, forceNewLogin = false) {
    try {
      setLoadingAction("connect");
      await fetch("/api/session/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: accountId ?? selectedAccountId,
          forceNewLogin,
        }),
      });
      await loadAccounts();
    } finally {
      setLoadingAction(null);
    }
  }

  async function disconnectSession(accountId?: string) {
    try {
      setLoadingAction("disconnect");
      await fetch("/api/session/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accountId ?? selectedAccountId }),
      });
      await loadAccounts();
    } finally {
      setLoadingAction(null);
    }
  }

  async function deleteAccount(accountId: string) {
    try {
      setLoadingAction("delete-account");
      setAccountError(null);
      const response = await fetch(`/api/account/${encodeURIComponent(accountId)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setAccountError(data.error ?? "No se pudo eliminar la cuenta.");
        return;
      }

      const remainingAccounts = accounts.filter((account) => account.id !== accountId);
      const nextSelectedId = remainingAccounts[0]?.id ?? "";
      setSelectedAccountId(nextSelectedId);
      if (!nextSelectedId) {
        setSession(null);
      }
      await loadAccounts();
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setCsvError(null);
    setUploadingCsv(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("accountId", selectedAccountId);
      formData.append("collectionId", uploadCollectionId);

      const response = await fetch("/api/campaign/upload-csv", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          summary?: CsvSummary;
          preview?: ContactRecord[];
        };
      };

      if (!response.ok || !data.ok) {
        setCsvError(data.error ?? "No se pudo procesar el CSV.");
        setCsvSummary(null);
        return;
      }

      setCsvSummary(data.data?.summary ?? null);
      setShowUploadModal(false);
      setSelectedCollectionId(uploadCollectionId);
      setUploadCollectionId("");
      setShowCreateCollectionForm(false);
      await loadCampaigns();
      await loadCollections();
      await loadCollectionContacts(uploadCollectionId);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "Error inesperado al cargar CSV.");
      setCsvSummary(null);
    } finally {
      setUploadingCsv(false);
      event.target.value = "";
    }
  }

  async function createCollectionForUpload() {
    const safeName = newCollectionName.trim();
    if (!safeName) {
      setCollectionsError("Debes escribir un nombre para la coleccion.");
      return;
    }
    setCollectionsError(null);
    setCreatingCollection(true);
    try {
      const response = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: safeName }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: CollectionItem;
      };
      if (!response.ok || !data.ok || !data.data) {
        setCollectionsError(data.error ?? "No se pudo crear la coleccion.");
        return;
      }
      const created = data.data;
      setCollections((prev) => [created, ...prev]);
      setUploadCollectionId(created.id);
      setNewCollectionName("");
      setShowCreateCollectionForm(false);
    } finally {
      setCreatingCollection(false);
    }
  }

  async function deleteCollection(collectionId: string) {
    setCollectionsError(null);
    const confirmed = window.confirm("¿Seguro que quieres eliminar esta colección?");
    if (!confirmed) {
      return;
    }
    const response = await fetch(`/api/collection/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setCollectionsError(data.error ?? "No se pudo eliminar la colección.");
      return;
    }
    setOpenCollectionMenuId(null);
    if (selectedCollectionId === collectionId) {
      setSelectedCollectionId("");
      setCollectionContacts([]);
    }
    await loadCollections();
  }

  function openEditContactModal(contact: CollectionContactItem) {
    setEditingContact(contact);
    setEditingName(contact.name ?? "");
    setEditingPhoneRaw(contact.phoneRaw ?? "");
    setOpenContactMenuId(null);
    setContactMenuPosition(null);
  }

  function openDeleteContactsModal(contactIds: string[]) {
    if (contactIds.length === 0) {
      return;
    }
    setPendingDeleteContactIds(contactIds);
    setDeleteConfirmText("");
    setShowDeleteModal(true);
    setOpenContactMenuId(null);
    setContactMenuPosition(null);
  }

  async function saveContactEdit() {
    if (!editingContact) {
      return;
    }
    setSavingContact(true);
    setCollectionsError(null);
    try {
      const response = await fetch(`/api/contact/${encodeURIComponent(editingContact.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingName.trim(),
          phoneRaw: editingPhoneRaw.trim(),
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setCollectionsError(data.error ?? "No se pudo editar el contacto.");
        return;
      }
      setEditingContact(null);
      await loadCollectionContacts(selectedCollectionId);
    } finally {
      setSavingContact(false);
    }
  }

  async function confirmDeleteContacts() {
    if (deleteConfirmText.trim().toLowerCase() !== "eliminar") {
      setCollectionsError('Debes escribir "eliminar" para confirmar.');
      return;
    }
    setDeletingContacts(true);
    setCollectionsError(null);
    try {
      const results = await Promise.all(
        pendingDeleteContactIds.map(async (contactId) => {
          const response = await fetch(`/api/contact/${encodeURIComponent(contactId)}`, {
            method: "DELETE",
          });
          const data = (await response.json()) as { ok: boolean; error?: string };
          return { ok: response.ok && data.ok, error: data.error };
        }),
      );
      const failed = results.find((item) => !item.ok);
      if (failed) {
        setCollectionsError(failed.error ?? "No se pudieron eliminar todos los contactos.");
        return;
      }
      setShowDeleteModal(false);
      setPendingDeleteContactIds([]);
      setDeleteConfirmText("");
      setSelectedContactIds([]);
      await loadCollectionContacts(selectedCollectionId);
    } finally {
      setDeletingContacts(false);
    }
  }

  async function loadMessagePreview() {
    setMessageError(null);
    setSavingMessage(true);
    try {
      const variations = messageConfig.variations
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch("/api/campaign/message-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          collectionId: selectedCampaignCollectionId,
          limit: 5,
          messageConfig: {
            template: messageConfig.template,
            variations,
            mediaType: messageConfig.mediaType || undefined,
            mediaUrl: messageConfig.mediaUrl || undefined,
            fallbackName: messageConfig.fallbackName,
          },
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          preview?: MessagePreviewItem[];
        };
      };

      if (!response.ok || !data.ok) {
        setMessageError(data.error ?? "No se pudo generar el preview de mensajes.");
        setMessagePreview([]);
        return;
      }

      setMessagePreview(data.data?.preview ?? []);
      setShowMessagePreviewModal(true);
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : "Error inesperado al cargar preview de mensajes.",
      );
      setMessagePreview([]);
    } finally {
      setSavingMessage(false);
    }
  }

  async function startCampaign() {
    setCampaignError(null);
    try {
      const variations = messageConfig.variations
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch("/api/campaign/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          campaignName,
          collectionId: selectedCampaignCollectionId,
          messageConfig: {
            template: messageConfig.template,
            variations,
            mediaType: messageConfig.mediaType || undefined,
            mediaUrl: messageConfig.mediaUrl || undefined,
            fallbackName: messageConfig.fallbackName,
          },
          throttleConfig:
            throttle.mode === "fixed"
              ? {
                  mode: "fixed",
                  fixedSeconds: Number(throttle.fixedSeconds),
                  retryCount: throttle.retryCount,
                }
              : {
                  mode: "range",
                  minSeconds: Number(throttle.minSeconds),
                  maxSeconds: Number(throttle.maxSeconds),
                  retryCount: throttle.retryCount,
                },
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { campaignId?: string };
      };
      if (!response.ok || !data.ok) {
        setCampaignError(data.error ?? "No se pudo ejecutar la accion de campana.");
      } else {
        await loadCampaigns();
        if (data.data?.campaignId) {
          setShowCreateCampaign(false);
          await loadCampaignStats(data.data.campaignId);
        }
      }
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Error inesperado.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function createAccount(): Promise<string | null> {
    setAccountError(null);
    if (!newAccountName.trim()) {
      setAccountError("Debes escribir un nombre para la cuenta.");
      return null;
    }
    const response = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAccountName.trim() }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string; data?: AccountItem };
    if (!response.ok || !data.ok || !data.data) {
      setAccountError(data.error ?? "No se pudo crear la cuenta.");
      return null;
    }
    setNewAccountName("");
    await loadAccounts();
    setSelectedAccountId(data.data.id);
    return data.data.id;
  }

  async function renameAccount() {
    setAccountError(null);
    if (!renamingAccountName.trim()) {
      setAccountError("Debes escribir un nuevo nombre.");
      return;
    }
    const response = await fetch(`/api/account/${encodeURIComponent(selectedAccountId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renamingAccountName.trim() }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setAccountError(data.error ?? "No se pudo renombrar la cuenta.");
      return;
    }
    await loadAccounts();
  }

  const menuItems: MenuItem[] = [
    { id: "campanas", label: "Campañas", icon: LayoutDashboard },
    { id: "conversaciones", label: "Conversaciones", icon: MessageSquareText },
    { id: "contacts", label: "Contactos", icon: CircleUserRound },
    { id: "numbers", label: "Numeros conectados", icon: Smartphone },
  ];

  const campaignStatusBadgeClass: Record<string, string> = {
    running: "bg-blue-100 text-blue-700",
    ready: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
    cancelled: "bg-slate-200 text-slate-700",
    paused: "bg-violet-100 text-violet-700",
    idle: "bg-slate-100 text-slate-700",
  };

  const contactStatusBadgeClass: Record<ContactStatus, string> = {
    sent: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-rose-100 text-rose-700",
    skipped: "bg-slate-200 text-slate-700",
    invalid: "bg-orange-100 text-orange-700",
    duplicate: "bg-purple-100 text-purple-700",
  };

  const campaignStatusLabel: Record<string, string> = {
    idle: "Idle",
    ready: "Ready",
    running: "In progress",
    paused: "Paused",
    completed: "Finished",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  useEffect(() => {
    const source = new EventSource("/api/campaign/events");
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        type?: string;
        payload?: unknown;
      };

      if (data.type === "campaign.progress" && data.payload) {
        const progress = data.payload as CampaignRealtimeSnapshot;
        if (!progress.campaignId) {
          return;
        }

        setCampaigns((prev) =>
          prev.map((campaign) =>
            campaign.id === progress.campaignId ? { ...campaign, status: progress.status } : campaign,
          ),
        );

        setSelectedCampaignStats((prev) => {
          if (!prev || prev.campaign.id !== progress.campaignId) {
            return prev;
          }

          const nextContacts =
            progress.lastResult
              ? prev.contacts.map((contact) =>
                  contact.id === progress.lastResult?.contactId
                    ? {
                        ...contact,
                        status: progress.lastResult.status,
                        error: progress.lastResult.error,
                      }
                    : contact,
                )
              : prev.contacts;

          return {
            ...prev,
            campaign: {
              ...prev.campaign,
              status: progress.status,
            },
            totals: {
              ...prev.totals,
              total: progress.total,
              sent: progress.sent,
              failed: progress.failed,
              skipped: progress.skipped,
              pending: progress.remaining,
            },
            contacts: nextContacts,
          };
        });
      }

      if (data.type === "campaign.state.changed" && data.payload) {
        const payload = data.payload as { campaignId?: string; status?: string };
        if (!payload.campaignId || !payload.status) {
          return;
        }
        setCampaigns((prev) =>
          prev.map((campaign) =>
            campaign.id === payload.campaignId ? { ...campaign, status: payload.status ?? campaign.status } : campaign,
          ),
        );
        setSelectedCampaignStats((prev) => {
          if (!prev || prev.campaign.id !== payload.campaignId) {
            return prev;
          }
          return {
            ...prev,
            campaign: {
              ...prev.campaign,
              status: payload.status ?? prev.campaign.status,
            },
          };
        });
      }
    };

    return () => {
      source.close();
    };
  }, []);

  async function loadCampaignStats(campaignId: string) {
    setCampaignError(null);
    setLoadingCampaignStats(true);
    try {
      const response = await fetch(`/api/campaign/${encodeURIComponent(campaignId)}`);
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: CampaignStatsData;
      };
      if (!response.ok || !data.ok || !data.data) {
        setCampaignError(data.error ?? "No se pudieron cargar las estadisticas de la campaña.");
        return;
      }
      setSelectedCampaignStats(data.data);
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setLoadingCampaignStats(false);
    }
  }

  function openDeleteCampaignModal(campaign: CampaignListItem) {
    setCampaignToDelete(campaign);
    setCampaignDeleteConfirmText("");
    setShowDeleteCampaignModal(true);
    setOpenCampaignMenuId(null);
    setCampaignMenuPosition(null);
  }

  async function confirmDeleteCampaign() {
    if (!campaignToDelete) {
      return;
    }
    if (campaignDeleteConfirmText.trim().toLowerCase() !== "eliminar") {
      setCampaignError('Debes escribir "eliminar" para confirmar.');
      return;
    }

    setDeletingCampaign(true);
    setCampaignError(null);
    try {
      const response = await fetch(`/api/campaign/${encodeURIComponent(campaignToDelete.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setCampaignError(data.error ?? "No se pudo eliminar la campaña.");
        return;
      }

      if (selectedCampaignStats?.campaign.id === campaignToDelete.id) {
        setSelectedCampaignStats(null);
      }
      setShowDeleteCampaignModal(false);
      setCampaignToDelete(null);
      setCampaignDeleteConfirmText("");
      await loadCampaigns();
    } finally {
      setDeletingCampaign(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto flex max-w-[1400px] gap-6 p-6">
        <aside className="sticky top-6 shrink-0 flex h-[calc(100vh-3rem)] w-72 flex-col rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-slate-200/50 backdrop-blur">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">SenFlow</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Crea agentes de IA{" "}
                  <a
                    href="https://www.socratess.co/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    aquí
                  </a>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection("super-admin")}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
                  activeSection === "super-admin"
                    ? "border-slate-400 bg-transparent text-slate-700"
                    : "border-slate-300 bg-transparent text-slate-500 hover:text-slate-700"
                }`}
                aria-label="Abrir super admin"
                title="Super admin"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-500 group-hover:text-slate-700"
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <span>{item.label}</span>
                  <span
                    className={`ml-auto h-2 w-2 rounded-full transition ${
                      isActive ? "bg-white/90" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-slate-200 pt-4">
            <label className="mb-3 grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Numero activo
              </span>
              <select
                className={inputClass}
                value={selectedAccountId}
                disabled={accounts.length === 0}
                onChange={(event) => setSelectedAccountId(event.target.value)}
              >
                {accounts.length === 0 ? (
                  <option value="">Sin numeros</option>
                ) : null}
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.status})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut size={16} />
              Cerrar sesion
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <section id="numbers" className={`${cardClass} ${activeSection === "numbers" ? "" : "hidden"}`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Numeros conectados</h3>
                <p className="text-sm text-slate-500">
                  Lista de numeros disponibles y administracion de conexion WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddingNewNumber(true);
                  setNewAccountName("");
                  setAccountError(null);
                  setActiveSection("connect-number");
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Agregar número
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/90">
                  <tr>
                    {["Cuenta", "Estado", "Numero", "Cuenta activa", "Acciones"].map((head) => (
                      <th
                        key={head}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-5 text-sm text-slate-500">
                        No hay numeros disponibles todavia.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((account) => {
                      const isSelected = account.id === selectedAccountId;
                      return (
                        <tr key={account.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium text-slate-800">{account.name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                                statusBadgeClassByAccount[account.status]
                              }`}
                            >
                              {account.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {account.phoneNumber || (isSelected ? session?.connectedPhone : null) || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedAccountId(account.id)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                isSelected
                                  ? "bg-blue-100 text-blue-700"
                                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {isSelected ? "Seleccionada" : "Seleccionar"}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  setSelectedAccountId(account.id);
                                  setActiveSection("connect-number");
                                  await connectSession(account.id, true);
                                }}
                                disabled={loadingAction !== null || account.status === "connected"}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Conectar
                              </button>
                              <button
                                type="button"
                                onClick={() => void disconnectSession(account.id)}
                                disabled={loadingAction !== null || account.status !== "connected"}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Desconectar
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteAccount(account.id)}
                                disabled={loadingAction !== null}
                                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {accountError ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{accountError}</p>
            ) : null}
          </section>

          <section
            id="connect-number"
            className={`${cardClass} ${activeSection === "connect-number" ? "" : "hidden"}`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Agregar número de WhatsApp</h3>
                <p className="text-sm text-slate-500">
                  Configura una cuenta y completa la conexión WhatsApp en una vista dedicada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection("numbers")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Volver a números
              </button>
            </div>

            {accounts.length === 0 || isAddingNewNumber ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">
                  {accounts.length === 0
                    ? "No hay numeros guardados. Agrega un numero para empezar y luego conectarlo."
                    : "Estas agregando un numero nuevo. Crea la cuenta para abrir un QR limpio."}
                </p>
                <div className="mt-3 grid gap-1.5">
                  <span className="text-sm font-medium">Nombre de la cuenta de WhatsApp</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className={`${inputClass} sm:flex-1`}
                      value={newAccountName}
                      onChange={(event) => setNewAccountName(event.target.value)}
                      placeholder="Ej: Ventas Colombia"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const createdId = await createAccount();
                        if (createdId) {
                          setIsAddingNewNumber(false);
                          setSelectedAccountId(createdId);
                          await connectSession(createdId, true);
                        }
                      }}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
                    >
                      Guardar y mostrar QR
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {!isAddingNewNumber ? (
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewNumber(true);
                        setNewAccountName("");
                        setAccountError(null);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Crear otra cuenta nueva
                    </button>
                  </div>
                ) : null}
                {isAddingNewNumber ? (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      Crea una cuenta adicional para conectar otro numero de WhatsApp.
                    </p>
                    <div className="mt-3 grid gap-1.5">
                      <span className="text-sm font-medium">Nombre de la nueva cuenta</span>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          className={`${inputClass} sm:flex-1`}
                          value={newAccountName}
                          onChange={(event) => setNewAccountName(event.target.value)}
                          placeholder="Ej: Soporte México"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const createdId = await createAccount();
                            if (createdId) {
                              setIsAddingNewNumber(false);
                              setSelectedAccountId(createdId);
                              await connectSession(createdId, true);
                            }
                          }}
                          disabled={loadingAction !== null}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Crear cuenta y mostrar QR
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">Numero seleccionado</span>
                    <select
                      className={inputClass}
                      value={selectedAccountId}
                      onChange={(event) => {
                        setSelectedAccountId(event.target.value);
                        setIsAddingNewNumber(false);
                      }}
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.status})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-1.5">
                    <span className="text-sm font-medium">Estado actual</span>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {session ? sessionStatusLabel[session.status] : "Sin estado"}
                    </div>
                  </div>
                </div>

                {session?.status === "reconnecting" ? (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    Procesando conexion de WhatsApp. Si hace falta, en breve aparecera un nuevo QR.
                  </div>
                ) : null}
                {session?.status === "qr_pending" ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    QR listo. Escanealo desde WhatsApp para completar la conexion.
                  </div>
                ) : null}
                {session?.status === "connected" ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Conexion completada correctamente.
                  </div>
                ) : null}
                {session?.status === "error" ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    Ocurrio un error al conectar. Intenta de nuevo para generar otro QR.
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void connectSession(undefined, true)}
                    disabled={!canConnect}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingAction === "connect" ? "Conectando..." : "Conectar y mostrar QR"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void disconnectSession()}
                    disabled={!canDisconnect}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingAction === "disconnect" ? "Cerrando..." : "Desconectar"}
                  </button>
                </div>
              </>
            )}

            {accounts.length > 0 && session?.connectedPhone && !isAddingNewNumber ? (
              <p className="mt-3 text-sm text-slate-600">Numero conectado: {session.connectedPhone}</p>
            ) : null}
            {accountError ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{accountError}</p>
            ) : null}
            {session?.errorMessage ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{session.errorMessage}</p>
            ) : null}

            {session?.status === "qr_pending" && session.qr ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm text-slate-600">Escanea este QR desde WhatsApp.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={session.qr}
                  alt="QR de autenticacion WhatsApp"
                  className="h-64 w-64 rounded-lg border border-slate-300 bg-white p-2"
                />
              </div>
            ) : null}
          </section>

          <section
            id="conversaciones"
            className={`${cardClass} ${activeSection === "conversaciones" ? "" : "hidden"}`}
          >
            <ConversationsPanel
              selectedAccountId={selectedAccountId}
              isConnected={session?.status === "connected"}
            />
          </section>

          <section id="contacts" className={`${cardClass} ${activeSection === "contacts" ? "" : "hidden"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Contactos y colecciones</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Organiza tus contactos por colecciones y carga CSV en la coleccion deseada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(true);
                  setUploadCollectionId("");
                  setShowCreateCollectionForm(false);
                  setNewCollectionName("");
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Cargar contactos
              </button>
            </div>
            {uploadingCsv ? <p className="mt-3 text-sm text-slate-500">Procesando CSV...</p> : null}
            {csvError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{csvError}</p> : null}
            {collectionsError ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{collectionsError}</p>
            ) : null}

            {selectedCollectionId && csvSummary ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Total", value: csvSummary.totalRows },
                  { label: "Validos", value: csvSummary.validRows },
                  { label: "Invalidos", value: csvSummary.invalidRows },
                  { label: "Duplicados", value: csvSummary.duplicateRows },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase text-slate-500">{item.label}</p>
                    <p className="mt-1 text-xl font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {!selectedCollectionId ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto overflow-y-visible">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Colección", "Creada", "Actualizada", "Acciones"].map((head) => (
                        <th
                          key={head}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loadingCollections ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-slate-500">
                          Cargando colecciones...
                        </td>
                      </tr>
                    ) : collections.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-slate-500">
                          Aún no tienes colecciones. Crea una desde "Cargar contactos".
                        </td>
                      </tr>
                    ) : (
                      collections.map((collection) => (
                        <tr key={collection.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{collection.name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {new Date(collection.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {new Date(collection.updatedAt).toLocaleString()}
                          </td>
                          <td className="relative px-4 py-3">
                            <button
                              type="button"
                              data-collection-menu-trigger
                              onClick={(event) => {
                                const buttonRect = event.currentTarget.getBoundingClientRect();
                                setOpenCollectionMenuId((prev) =>
                                  prev === collection.id ? null : collection.id,
                                );
                                if (openCollectionMenuId !== collection.id) {
                                  setCollectionMenuPosition({
                                    top: buttonRect.bottom + 8,
                                    right: window.innerWidth - buttonRect.right,
                                  });
                                } else {
                                  setCollectionMenuPosition(null);
                                }
                              }}
                              className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
                              aria-label={`Acciones para ${collection.name}`}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {openCollectionMenuId === collection.id && collectionMenuPosition ? (
                              <div
                                data-collection-menu
                                className="fixed z-[100] w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                                style={{
                                  top: `${collectionMenuPosition.top}px`,
                                  right: `${collectionMenuPosition.right}px`,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCollectionId(collection.id);
                                    setOpenCollectionMenuId(null);
                                    setCollectionMenuPosition(null);
                                  }}
                                  className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteCollection(collection.id)}
                                  className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                                >
                                  Eliminar colección
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {selectedCollectionId ? (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-700">
                  Detalle de colección:{" "}
                  {collections.find((collection) => collection.id === selectedCollectionId)?.name ??
                    "Colección seleccionada"}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollectionId("");
                      setCollectionContacts([]);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Volver a colecciones
                  </button>
                </div>
                {collectionContacts.length > 0 ? (
                  <div className="mb-3 flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={
                          collectionContacts.length > 0 &&
                          selectedContactIds.length === collectionContacts.length
                        }
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedContactIds(collectionContacts.map((contact) => contact.id));
                          } else {
                            setSelectedContactIds([]);
                          }
                        }}
                      />
                      Seleccionar todos
                    </label>
                    {selectedContactIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => openDeleteContactsModal(selectedContactIds)}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
                      >
                        Eliminar seleccionados ({selectedContactIds.length})
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedCollectionId && loadingCollectionContacts ? (
              <p className="mt-3 text-sm text-slate-500">Cargando contactos de la colección...</p>
            ) : null}

            {selectedCollectionId && !loadingCollectionContacts && collectionContacts.length > 0 ? (
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["", "Fila", "Nombre", "Telefono", "Normalizado", "Acciones"].map((head) => (
                        <th key={head} className="px-3 py-2 text-left font-semibold text-slate-600">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {collectionContacts.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedContactIds.includes(item.id)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedContactIds((prev) => [...new Set([...prev, item.id])]);
                              } else {
                                setSelectedContactIds((prev) => prev.filter((id) => id !== item.id));
                              }
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">{item.rowIndex ?? "-"}</td>
                        <td className="px-3 py-2">{item.name || "-"}</td>
                        <td className="px-3 py-2">{item.phoneRaw || "-"}</td>
                        <td className="px-3 py-2">{item.phoneNormalized ?? "-"}</td>
                        <td className="relative px-3 py-2">
                          <button
                            type="button"
                            data-contact-menu-trigger
                            onClick={(event) => {
                              const buttonRect = event.currentTarget.getBoundingClientRect();
                              setOpenContactMenuId((prev) => (prev === item.id ? null : item.id));
                              if (openContactMenuId !== item.id) {
                                setContactMenuPosition({
                                  top: buttonRect.bottom + 8,
                                  right: window.innerWidth - buttonRect.right,
                                });
                              } else {
                                setContactMenuPosition(null);
                              }
                            }}
                            className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
                            aria-label={`Acciones para ${item.name ?? "contacto"}`}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openContactMenuId === item.id && contactMenuPosition ? (
                            <div
                              data-contact-menu
                              className="fixed z-[110] w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                              style={{
                                top: `${contactMenuPosition.top}px`,
                                right: `${contactMenuPosition.right}px`,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => openEditContactModal(item)}
                                className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteContactsModal([item.id])}
                                className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {selectedCollectionId &&
            !loadingCollectionContacts &&
            collectionContacts.length === 0 &&
            collections.length > 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                Esta colección no tiene contactos todavía.
              </div>
            ) : null}

            {showUploadModal ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold">Cargar contactos por CSV</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadCollectionId("");
                        setShowCreateCollectionForm(false);
                        setNewCollectionName("");
                      }}
                      disabled={uploadingCsv}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cerrar
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Formato requerido: <code className="rounded bg-slate-100 px-1 py-0.5">name,phone</code>
                  </p>

                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-sm font-medium">Coleccion destino</span>
                      <select
                        className={inputClass}
                        value={uploadCollectionId}
                        disabled={collections.length === 0}
                        onChange={(event) => setUploadCollectionId(event.target.value)}
                      >
                        <option value="">
                          {collections.length === 0
                            ? "No hay colecciones"
                            : "Selecciona una colección"}
                        </option>
                        {collections.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowCreateCollectionForm((prev) => !prev)}
                      className="w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {showCreateCollectionForm ? "Ocultar crear colección" : "Crear nueva colección"}
                    </button>

                    {showCreateCollectionForm ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-700">Nueva colección</p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input
                            value={newCollectionName}
                            onChange={(event) => setNewCollectionName(event.target.value)}
                            placeholder="Ej: Leads Abril"
                            className={`${inputClass} sm:flex-1`}
                          />
                          <button
                            type="button"
                            onClick={createCollectionForUpload}
                            disabled={creatingCollection}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {creatingCollection ? "Creando..." : "Crear"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvUpload}
                      disabled={uploadingCsv || !uploadCollectionId}
                      className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {!uploadCollectionId ? (
                      <p className="text-xs text-amber-700">
                        Debes seleccionar o crear una coleccion antes de cargar el CSV.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {editingContact ? (
              <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
                <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold">Editar contacto</h4>
                    <button
                      type="button"
                      onClick={() => setEditingContact(null)}
                      disabled={savingContact}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-sm font-medium">Nombre</span>
                      <input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-sm font-medium">Teléfono</span>
                      <input
                        value={editingPhoneRaw}
                        onChange={(event) => setEditingPhoneRaw(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={saveContactEdit}
                      disabled={savingContact}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingContact ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {showDeleteModal ? (
              <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
                <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                  <h4 className="text-lg font-semibold">Confirmar eliminación</h4>
                  <p className="mt-2 text-sm text-slate-600">
                    Escribe <span className="font-semibold">eliminar</span> para confirmar.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Se eliminarán {pendingDeleteContactIds.length} contacto(s).
                  </p>
                  <input
                    value={deleteConfirmText}
                    onChange={(event) => setDeleteConfirmText(event.target.value)}
                    className={`${inputClass} mt-3`}
                    placeholder='Escribe "eliminar"'
                  />
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setPendingDeleteContactIds([]);
                        setDeleteConfirmText("");
                      }}
                      disabled={deletingContacts}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteContacts}
                      disabled={deletingContacts}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingContacts ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section id="super-admin" className={`${cardClass} ${activeSection === "super-admin" ? "" : "hidden"}`}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Super admin</h3>
                <p className="text-sm text-slate-500">
                  Visualiza y edita registros directamente en tablas de la base de datos.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Base activa: {superAdminDatabasePath ?? "No disponible"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void cleanupDatabase()}
                  disabled={cleaningDatabase}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cleaningDatabase ? "Limpiando..." : "Limpiar BD"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void loadSuperAdminTables();
                    if (selectedSuperAdminTable) {
                      void loadSuperAdminRows(selectedSuperAdminTable);
                    }
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Recargar
                </button>
              </div>
            </div>

            {superAdminError ? (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{superAdminError}</p>
            ) : null}

            <div className="mb-4 grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tabla</span>
              <select
                className={inputClass}
                value={selectedSuperAdminTable}
                disabled={loadingSuperAdminTables || superAdminTables.length === 0}
                onChange={(event) => setSelectedSuperAdminTable(event.target.value)}
              >
                {superAdminTables.length === 0 ? <option value="">Sin tablas disponibles</option> : null}
                {superAdminTables.map((table) => (
                  <option key={table.name} value={table.name}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>

            {loadingSuperAdminTables ? <p className="text-sm text-slate-500">Cargando tablas...</p> : null}
            {!loadingSuperAdminTables && selectedSuperAdminTable ? (
              <div className="w-full max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="w-full max-w-full overflow-x-auto">
                  <div className="max-h-[62vh] overflow-y-auto">
                    <table className="min-w-[920px] border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">
                      <tr>
                        {(superAdminTables.find((table) => table.name === selectedSuperAdminTable)?.columns ?? []).map(
                          (column) => (
                            <th
                              key={column.name}
                              className="whitespace-nowrap border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                            >
                              {column.name}
                            </th>
                          ),
                        )}
                        <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Acciones
                        </th>
                      </tr>
                      </thead>
                      <tbody className="bg-white">
                        {loadingSuperAdminRows ? (
                          <tr>
                            <td className="px-3 py-3 text-slate-500" colSpan={99}>
                              Cargando registros...
                            </td>
                          </tr>
                        ) : superAdminRows.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-slate-500" colSpan={99}>
                              Sin registros para esta tabla.
                            </td>
                          </tr>
                        ) : (
                          superAdminRows.map((row, rowIndex) => (
                            <tr
                              key={`${selectedSuperAdminTable}-${rowIndex}`}
                              className={`border-b border-slate-100 hover:bg-slate-50 ${
                                rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                              }`}
                            >
                              {(superAdminTables.find((table) => table.name === selectedSuperAdminTable)?.columns ?? []).map(
                                (column) => (
                                  <td
                                    key={`${rowIndex}-${column.name}`}
                                    className="max-w-[260px] px-3 py-2 text-slate-700"
                                  >
                                    <span className="line-clamp-2 break-words">
                                      {row[column.name] === null || row[column.name] === undefined
                                        ? "NULL"
                                        : formatSuperAdminCellValue(row[column.name])}
                                    </span>
                                  </td>
                                ),
                              )}
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => openSuperAdminRowEditor(row, rowIndex)}
                                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {editingRowIndex !== null ? (
              <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/50 p-4">
                <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                  <h4 className="text-base font-semibold">Editar registro</h4>
                  <p className="mt-1 text-xs text-slate-500">Tabla: {selectedSuperAdminTable}</p>
                  <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                    {Object.entries(editableRowDraft).map(([column, draft]) => (
                      <div key={column} className="rounded-lg border border-slate-200 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{column}</p>
                        <textarea
                          value={draft.value}
                          disabled={draft.setNull}
                          onChange={(event) =>
                            setEditableRowDraft((prev) => ({
                              ...prev,
                              [column]: {
                                ...prev[column],
                                value: event.target.value,
                              },
                            }))
                          }
                          rows={3}
                          className={`${inputClass} resize-y disabled:bg-slate-100`}
                        />
                        <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={draft.setNull}
                            onChange={(event) =>
                              setEditableRowDraft((prev) => ({
                                ...prev,
                                [column]: {
                                  ...prev[column],
                                  setNull: event.target.checked,
                                },
                              }))
                            }
                          />
                          Guardar como NULL
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeSuperAdminRowEditor}
                      disabled={savingSuperAdminRow}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveSuperAdminRow()}
                      disabled={savingSuperAdminRow}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingSuperAdminRow ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section id="message" className={`${cardClass} ${activeSection === "campanas" ? "" : "hidden"}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{showCreateCampaign ? "Crear campañas" : "Campañas"}</h3>
                <p className="text-sm text-slate-500">
                  {showCreateCampaign
                    ? "Configura y ejecuta una nueva campaña."
                    : "Visualiza historial y crea una nueva campaña."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateCampaign((prev) => !prev);
                  setSelectedCampaignStats(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {showCreateCampaign ? "Volver al listado" : "Crear campañas"}
              </button>
            </div>

            {showCreateCampaign || selectedCampaignStats ? null : (
            <div className="mb-5 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Nombre", "Estado", "Creada", "Inicio", "Fin", "Acciones"].map((head) => (
                      <th key={head} className="px-3 py-2 text-left font-semibold text-slate-600">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loadingCampaigns ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={6}>
                        Cargando campanas...
                      </td>
                    </tr>
                  ) : campaigns.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={6}>
                        Aun no hay campanas creadas.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2">{item.status}</td>
                        <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2">{item.startDate ? new Date(item.startDate).toLocaleString() : "-"}</td>
                        <td className="px-3 py-2">{item.endDate ? new Date(item.endDate).toLocaleString() : "-"}</td>
                        <td className="relative px-3 py-2">
                          <button
                            type="button"
                            data-campaign-menu-trigger
                            onClick={(event) => {
                              const buttonRect = event.currentTarget.getBoundingClientRect();
                              setOpenCampaignMenuId((prev) => (prev === item.id ? null : item.id));
                              if (openCampaignMenuId !== item.id) {
                                setCampaignMenuPosition({
                                  top: buttonRect.bottom + 8,
                                  right: window.innerWidth - buttonRect.right,
                                });
                              } else {
                                setCampaignMenuPosition(null);
                              }
                            }}
                            className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
                            aria-label={`Acciones para ${item.name}`}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openCampaignMenuId === item.id && campaignMenuPosition ? (
                            <div
                              data-campaign-menu
                              className="fixed z-[110] w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                              style={{
                                top: `${campaignMenuPosition.top}px`,
                                right: `${campaignMenuPosition.right}px`,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  void loadCampaignStats(item.id);
                                  setOpenCampaignMenuId(null);
                                  setCampaignMenuPosition(null);
                                }}
                                className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                              >
                                Ver
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteCampaignModal(item)}
                                className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            )}

            {!showCreateCampaign && loadingCampaignStats && !selectedCampaignStats ? (
              <p className="mb-4 text-sm text-slate-500">Cargando estadisticas de la campaña...</p>
            ) : null}
            {!showCreateCampaign && selectedCampaignStats ? (
              <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold">{selectedCampaignStats.campaign.name}</h4>
                    <div className="mt-1">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                          campaignStatusBadgeClass[selectedCampaignStats.campaign.status] ??
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {campaignStatusLabel[selectedCampaignStats.campaign.status] ??
                          selectedCampaignStats.campaign.status}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignStats(null)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Volver al listado
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    { label: "Total", value: selectedCampaignStats.totals.total },
                    { label: "Enviados", value: selectedCampaignStats.totals.sent },
                    { label: "Fallidos", value: selectedCampaignStats.totals.failed },
                    { label: "Omitidos", value: selectedCampaignStats.totals.skipped },
                    { label: "Pendientes", value: selectedCampaignStats.totals.pending },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">{item.label}</p>
                      <p className="mt-1 text-xl font-semibold">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Nombre", "Telefono", "Estado", "Intentos", "Error"].map((head) => (
                          <th key={head} className="px-3 py-2 text-left font-semibold text-slate-600">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedCampaignStats.contacts.map((contact) => (
                        <tr key={contact.id}>
                          <td className="px-3 py-2">{contact.name}</td>
                          <td className="px-3 py-2">{contact.phoneNormalized ?? contact.phoneRaw}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                                contactStatusBadgeClass[contact.status]
                              }`}
                            >
                              {contact.status === "sent"
                                ? "Sent"
                                : contact.status === "pending"
                                  ? "Pending"
                                  : contact.status === "failed"
                                    ? "Failed"
                                    : contact.status === "skipped"
                                      ? "Skipped"
                                      : contact.status === "invalid"
                                        ? "Invalid"
                                        : "Duplicate"}
                            </span>
                          </td>
                          <td className="px-3 py-2">{contact.attempts}</td>
                          <td className="px-3 py-2">{contact.error ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {!showCreateCampaign ? null : (
              <>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Nombre de la campaña</span>
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="Ej: Campaña clientes abril"
                className={inputClass}
              />
            </label>
            <h3 className="text-lg font-semibold">Configuracion de mensaje</h3>
            <p className="mt-1 text-sm text-slate-500">Variables disponibles: {"{name}"}</p>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Plantilla principal</span>
                <textarea
                  value={messageConfig.template}
                  onChange={(event) => setMessageConfig((prev) => ({ ...prev, template: event.target.value }))}
                  rows={4}
                  className={inputClass}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Variaciones (una por linea)</span>
                <textarea
                  value={messageConfig.variations}
                  onChange={(event) => setMessageConfig((prev) => ({ ...prev, variations: event.target.value }))}
                  rows={4}
                  placeholder={"Hola {name}, ...\nQue tal {name}, ..."}
                  className={inputClass}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium">Fallback de nombre</span>
                  <input
                    value={messageConfig.fallbackName}
                    onChange={(event) => setMessageConfig((prev) => ({ ...prev, fallbackName: event.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium">Tipo de media</span>
                  <select
                    value={messageConfig.mediaType}
                    onChange={(event) =>
                      setMessageConfig((prev) => ({
                        ...prev,
                        mediaType: event.target.value as MessageConfig["mediaType"],
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Sin media</option>
                    <option value="image">Imagen</option>
                    <option value="video">Video</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium">URL de media</span>
                <input
                  value={messageConfig.mediaUrl}
                  onChange={(event) => setMessageConfig((prev) => ({ ...prev, mediaUrl: event.target.value }))}
                  placeholder="https://..."
                  className={inputClass}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={loadMessagePreview}
                  disabled={savingMessage || !selectedCampaignCollectionId}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previsualizar mensajes
                </button>
              </div>
            </div>

            {messageError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{messageError}</p> : null}
              </>
            )}
          </section>

          <section
            id="campaign"
            className={`${cardClass} ${activeSection === "campanas" && showCreateCampaign ? "" : "hidden"}`}
          >
            <h3 className="text-lg font-semibold">Ejecucion de campana</h3>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona colección y define el ritmo para iniciar la campaña.
            </p>

            <div className="mt-4 grid gap-1.5">
              <span className="text-sm font-medium">Colección de contactos</span>
              <select
                value={selectedCampaignCollectionId}
                onChange={(event) => setSelectedCampaignCollectionId(event.target.value)}
                className={inputClass}
              >
                <option value="">Selecciona una colección</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Modo</span>
                <select
                  value={throttle.mode}
                  onChange={(event) =>
                    setThrottle((prev) => ({ ...prev, mode: event.target.value as "fixed" | "range" }))
                  }
                  className={inputClass}
                >
                  <option value="fixed">Fijo</option>
                  <option value="range">Rango</option>
                </select>
              </label>

              {throttle.mode === "fixed" ? (
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium">Segundos fijos</span>
                  <input
                    type="number"
                    min={3}
                    value={throttle.fixedSeconds}
                    onChange={(event) => setThrottle((prev) => ({ ...prev, fixedSeconds: Number(event.target.value) }))}
                    className={inputClass}
                  />
                </label>
              ) : (
                <>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">Min segundos</span>
                    <input
                      type="number"
                      min={3}
                      value={throttle.minSeconds}
                      onChange={(event) => setThrottle((prev) => ({ ...prev, minSeconds: Number(event.target.value) }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-medium">Max segundos</span>
                    <input
                      type="number"
                      min={3}
                      value={throttle.maxSeconds}
                      onChange={(event) => setThrottle((prev) => ({ ...prev, maxSeconds: Number(event.target.value) }))}
                      className={inputClass}
                    />
                  </label>
                </>
              )}

              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Reintentos</span>
                <select
                  value={throttle.retryCount}
                  onChange={(event) =>
                    setThrottle((prev) => ({ ...prev, retryCount: Number(event.target.value) as 0 | 1 }))
                  }
                  className={inputClass}
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startCampaign}
                disabled={!selectedCampaignCollectionId || !campaignName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Iniciar campaña
              </button>
            </div>

            {campaignError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{campaignError}</p> : null}
          </section>

          {showMessagePreviewModal ? (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
              <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold">Previsualización de mensajes</h4>
                  <button
                    type="button"
                    onClick={() => setShowMessagePreviewModal(false)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                </div>
                {messagePreview.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">No hay contactos elegibles para previsualizar.</p>
                ) : (
                  <div className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
                    {messagePreview.map((item) => (
                      <article key={item.contactId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">
                          {item.name} - {item.phoneNormalized ?? "sin numero normalizado"}
                        </p>
                        <p className="mt-1 text-sm">{item.message}</p>
                        {item.mediaType && item.mediaUrl ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Media: {item.mediaType} - {item.mediaUrl}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {showDeleteCampaignModal ? (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
              <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                <h4 className="text-lg font-semibold">Confirmar eliminación de campaña</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Escribe <span className="font-semibold">eliminar</span> para confirmar.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Se eliminará la campaña: {campaignToDelete?.name ?? "-"}.
                </p>
                <input
                  value={campaignDeleteConfirmText}
                  onChange={(event) => setCampaignDeleteConfirmText(event.target.value)}
                  className={`${inputClass} mt-3`}
                  placeholder='Escribe "eliminar"'
                />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteCampaignModal(false);
                      setCampaignToDelete(null);
                      setCampaignDeleteConfirmText("");
                    }}
                    disabled={deletingCampaign}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteCampaign}
                    disabled={deletingCampaign}
                    className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingCampaign ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
