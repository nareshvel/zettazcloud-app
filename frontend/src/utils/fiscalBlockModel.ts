/**
 * Fiscal block model.
 *
 * ⚠️  SCOPE — READ BEFORE EXTENDING
 * ---------------------------------
 * This module **renders** fiscal data. It does **not** produce it.
 *
 * Roughly 30 countries (Austria, Portugal, Germany, Bulgaria, Italy, Greece,
 * Croatia, Poland, much of Latin America) require every receipt to carry a
 * cryptographic signature produced by *certified* software or a secure signature
 * creation device, with the signature and transaction data encoded in a QR code.
 *
 * The signature must come from a certified vendor integration (fiskaly or
 * equivalent) on the backend. Do NOT implement signing here, or anywhere in the
 * frontend:
 *
 *   * certification attaches to the signing component; a home-grown
 *     implementation is non-compliant no matter how correct the cryptography is
 *   * signing keys must never reach a browser
 *   * schemes differ per country and change with legislation
 *
 * So this module is deliberately dumb: it takes whatever the backend supplies
 * and lays it out. If the backend supplies nothing, the block renders nothing.
 *
 * FAIL-CLOSED: the block is gated on `fiscalizationEnabled` from the
 * jurisdiction profile. A store in a non-fiscalized country never sees it, and a
 * store in a fiscalized country that has no signature yet renders a visible
 * placeholder rather than a silently-missing element — a receipt that *looks*
 * complete but lacks its fiscal signature is worse than one that obviously does
 * not, because nobody notices until an audit.
 */

export interface FiscalModel {
  /** Whether this jurisdiction mandates fiscal receipts at all. */
  required: boolean;
  /** Scheme identifier, e.g. AT_RKSV, PT_ATCUD, DE_DSFINV_K. */
  scheme: string | null;
  /** Cryptographic signature supplied by the certified backend integration. */
  signature: string | null;
  /** Payload for the QR code — signature plus essential transaction data. */
  qrPayload: string | null;
  /** Country-specific document identifier (Portugal ATCUD, Bulgaria USN). */
  documentId: string | null;
  documentIdLabel: string;
  /** Certified software identifier, where the country requires it printed. */
  softwareId: string | null;
  /** Fiscal device / till serial. */
  deviceSerial: string | null;
  /** True when required but the signature is absent — must be visible. */
  isMissing: boolean;
}

/** Label for the country-specific document identifier. */
const DOCUMENT_ID_LABELS: Record<string, string> = {
  PT_ATCUD: 'ATCUD',
  BG_USN: 'USN',
  AT_RKSV: 'Signatur',
  DE_DSFINV_K: 'TSE',
  IT_RT: 'RT',
};

const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/**
 * Build the fiscal model from a document payload.
 *
 * @param data      Sale / document payload
 * @param opts.required  From the jurisdiction profile's `fiscalizationEnabled`.
 *                       When omitted, inferred from the presence of fiscal data —
 *                       so a preview fixture still renders something useful.
 */
export const buildFiscal = (
  data: any,
  opts: { required?: boolean } = {},
): FiscalModel => {
  const f = data?.fiscal || {};

  const scheme = str(f.scheme ?? data?.fiscalizationScheme);
  const signature = str(f.signature ?? data?.fiscalSignature);
  const documentId = str(f.documentId ?? f.atcud ?? data?.atcud ?? data?.fiscalDocumentId);
  const softwareId = str(f.softwareId ?? data?.fiscalSoftwareId);
  const deviceSerial = str(f.deviceSerial ?? data?.fiscalDeviceSerial);

  // QR payload: prefer an explicitly prepared payload; otherwise fall back to
  // the signature, which is what the QR primarily encodes.
  const qrPayload = str(f.qrPayload ?? data?.fiscalQrPayload) || signature;

  const hasAnyData = Boolean(signature || documentId || qrPayload || deviceSerial);

  // Explicit flag wins; otherwise infer so fixtures preview correctly.
  const required = opts.required !== undefined ? opts.required : hasAnyData;

  return {
    required,
    scheme,
    signature,
    qrPayload,
    documentId,
    documentIdLabel: (scheme && DOCUMENT_ID_LABELS[scheme]) || 'Doc ID',
    softwareId,
    deviceSerial,
    // Required by law but not supplied — surface it loudly.
    isMissing: required && !signature && !qrPayload,
  };
};

/**
 * Warning shown when a fiscalized jurisdiction has no signature.
 *
 * Deliberately blunt. Anyone seeing this on a real receipt needs to stop and
 * fix the integration, not wonder whether it matters.
 */
export const FISCAL_MISSING_NOTICE =
  'FISCAL SIGNATURE MISSING — this document is not compliant';

/** Guidance shown in the designer, where no live fiscal data exists. */
export const FISCAL_DESIGNER_HINT =
  'Fiscal signature is generated per-transaction by the certified backend '
  + 'integration. Nothing appears here in the designer.';
