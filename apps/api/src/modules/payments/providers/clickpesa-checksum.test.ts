import { describe, expect, it } from 'vitest';

import {
  createClickPesaPayloadChecksum,
  verifyClickPesaPayloadChecksum,
} from './clickpesa-checksum.js';

describe('clickpesa-checksum', () => {
  it('verifies HMAC-SHA256 after excluding checksum fields', () => {
    const key = 'secret-key';
    const payload = {
      event: 'PAYMENT RECEIVED',
      data: {
        id: 'ORD1',
        status: 'SUCCESS',
        orderReference: '01900000-0000-7000-8000-0000000000d1',
        collectedAmount: '100',
      },
    };
    const checksum = createClickPesaPayloadChecksum(key, payload);
    expect(
      verifyClickPesaPayloadChecksum(
        key,
        { ...payload, checksum, checksumMethod: 'HMAC-SHA256' },
        checksum,
      ),
    ).toBe(true);
    expect(
      verifyClickPesaPayloadChecksum(key, { ...payload, checksum: 'deadbeef' }, 'deadbeef'),
    ).toBe(false);
  });

  it('is order-independent for object keys', () => {
    const key = 'k';
    const a = createClickPesaPayloadChecksum(key, { b: 1, a: 2 });
    const b = createClickPesaPayloadChecksum(key, { a: 2, b: 1 });
    expect(a).toBe(b);
  });
});
