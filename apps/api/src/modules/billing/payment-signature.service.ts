import { Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class PaymentSignatureService {
  createRequestSignature(params: {
    method: string;
    requestPath: string;
    appId: string;
    timestamp: string;
    rawBody: string;
    secretKey: string;
  }) {
    const bodyHash = createHash('sha256').update(params.rawBody).digest('hex');
    const stringToSign = [
      params.method.toUpperCase(),
      params.requestPath,
      params.appId,
      params.timestamp,
      bodyHash,
    ].join('\n');

    return createHmac('sha256', params.secretKey)
      .update(stringToSign)
      .digest('hex');
  }

  createCallbackSignature(rawPayload: string, secretKey: string) {
    return createHmac('sha256', secretKey).update(rawPayload).digest('hex');
  }

  isCallbackSignatureValid(params: {
    rawPayload: string;
    providedSignature: string;
    secretKey: string;
  }) {
    const expectedSignature = this.createCallbackSignature(
      params.rawPayload,
      params.secretKey,
    );

    return this.compareSignatures(
      expectedSignature,
      params.providedSignature,
    );
  }

  private compareSignatures(expectedSignature: string, providedSignature: string) {
    const expected = Buffer.from(expectedSignature, 'utf8');
    const provided = Buffer.from(providedSignature, 'utf8');

    if (expected.length !== provided.length) {
      return false;
    }

    return timingSafeEqual(expected, provided);
  }
}
