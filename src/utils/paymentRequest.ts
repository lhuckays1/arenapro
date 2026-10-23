export function paymentRequestKey(scope: string, payload: unknown): string {
  const storageKey = `arenapro_payment_request:${scope}`;
  const signature = JSON.stringify(payload);
  const stored = sessionStorage.getItem(storageKey);
  if (stored) {
    const previous = JSON.parse(stored);
    if (previous.signature === signature) return previous.key;
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  const key = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  sessionStorage.setItem(storageKey, JSON.stringify({ signature, key }));
  return key;
}

export function completePaymentRequest(scope: string): void {
  sessionStorage.removeItem(`arenapro_payment_request:${scope}`);
}
