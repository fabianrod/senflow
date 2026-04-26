import { ContactRecord, MessageConfig, RenderedMessagePreview } from "@/server/common/types";

export function normalizeVariations(rawVariations: string[]): string[] {
  return rawVariations.map((item) => item.trim()).filter((item) => item.length > 0);
}

export function validateMessageConfig(config: MessageConfig): string[] {
  const errors: string[] = [];

  if (!config.template.trim()) {
    errors.push("La plantilla principal es obligatoria.");
  }

  if (config.template.length > 1024) {
    errors.push("La plantilla principal supera 1024 caracteres.");
  }

  if (!config.fallbackName.trim()) {
    errors.push("El fallback de nombre es obligatorio.");
  }

  if (config.mediaType && !config.mediaUrl?.trim()) {
    errors.push("Debes enviar mediaUrl cuando selecciones mediaType.");
  }

  if (!config.mediaType && config.mediaUrl?.trim()) {
    errors.push("Debes definir mediaType cuando envies mediaUrl.");
  }

  return errors;
}

export function renderMessageForContact(
  contact: ContactRecord,
  config: MessageConfig,
  variationIndex = 0,
): string {
  const variations = normalizeVariations(config.variations);
  const baseText =
    variations.length > 0 ? variations[variationIndex % variations.length] : config.template;

  const safeName = contact.name.trim() || config.fallbackName.trim();
  return baseText.replaceAll("{name}", safeName);
}

export function buildMessagePreview(
  contacts: ContactRecord[],
  config: MessageConfig,
  limit = 5,
): RenderedMessagePreview[] {
  const eligibleContacts = contacts.filter((contact) => contact.status === "pending").slice(0, limit);

  return eligibleContacts.map((contact, index) => ({
    contactId: contact.id,
    name: contact.name,
    phoneNormalized: contact.phoneNormalized,
    message: renderMessageForContact(contact, config, index),
    mediaType: config.mediaType,
    mediaUrl: config.mediaUrl,
  }));
}
