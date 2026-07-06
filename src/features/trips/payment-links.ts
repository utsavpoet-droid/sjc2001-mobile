export type PaymentApp = 'venmo' | 'zelle' | 'paypal' | 'upi';

export interface PaymentHandles {
  venmo: string | null;
  zelle: string | null;
  paypal: string | null;
  upi: string | null;
}

export interface PaymentOption {
  app: PaymentApp;
  label: string;
  handle: string;
  url: string;
  fallbackUrl?: string;
}

function stripVenmo(handle: string): string {
  return handle.replace(/^@+/, '').trim();
}

function stripPaypal(handle: string): string {
  return handle
    .replace(/^@+/, '')
    .replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')
    .trim();
}

function buildVenmo(handle: string, amount: number, note: string): PaymentOption {
  const recipient = encodeURIComponent(stripVenmo(handle));
  const amt = amount.toFixed(2);
  const noteEnc = encodeURIComponent(note);
  return {
    app: 'venmo',
    label: 'Venmo',
    handle: '@' + stripVenmo(handle),
    url: `venmo://paycharge?txn=pay&recipients=${recipient}&amount=${amt}&note=${noteEnc}`,
    fallbackUrl: `https://venmo.com/${recipient}?txn=pay&amount=${amt}&note=${noteEnc}`,
  };
}

function buildPaypal(handle: string, amount: number): PaymentOption {
  const recipient = encodeURIComponent(stripPaypal(handle));
  const amt = amount.toFixed(2);
  return {
    app: 'paypal',
    label: 'PayPal',
    handle: stripPaypal(handle),
    url: `https://paypal.me/${recipient}/${amt}`,
  };
}

function buildZelle(handle: string): PaymentOption {
  return {
    app: 'zelle',
    label: 'Zelle',
    handle,
    url: `https://enroll.zellepay.com/qr-codes?data=${encodeURIComponent(handle)}`,
  };
}

function buildUpi(handle: string, amount: number, note: string): PaymentOption {
  const amt = amount.toFixed(2);
  const noteEnc = encodeURIComponent(note);
  return {
    app: 'upi',
    label: 'UPI',
    handle,
    url: `upi://pay?pa=${encodeURIComponent(handle)}&am=${amt}&tn=${noteEnc}&cu=INR`,
  };
}

export function buildPaymentOptions(
  handles: PaymentHandles | undefined | null,
  amount: number,
  note: string,
): PaymentOption[] {
  if (!handles) return [];
  const opts: PaymentOption[] = [];
  if (handles.venmo) opts.push(buildVenmo(handles.venmo, amount, note));
  if (handles.zelle) opts.push(buildZelle(handles.zelle));
  if (handles.paypal) opts.push(buildPaypal(handles.paypal, amount));
  if (handles.upi) opts.push(buildUpi(handles.upi, amount, note));
  return opts;
}
