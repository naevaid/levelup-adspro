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

  createCallbackRequestSignature(params: {
    appId: string;
    requestPath: string;
    timestamp: string;
    rawBody: string;
    secretKey: string;
  }) {
    return this.createRequestSignature({
      method: 'POST',
      requestPath: params.requestPath,
      appId: params.appId,
      timestamp: params.timestamp,
      rawBody: params.rawBody,
      secretKey: params.secretKey,
    });
  }

  isCallbackSignatureValid(params: {
    rawPayload: string;
    providedSignature: string;
    secretKey: string;
    appId?: string;
    timestamp?: string;
    requestPath?: string;
  }) {
    const candidateSignatures = [
      this.createCallbackSignature(params.rawPayload, params.secretKey),
    ];

    if (params.appId && params.timestamp && params.requestPath) {
      candidateSignatures.push(
        this.createCallbackRequestSignature({
          appId: params.appId,
          requestPath: params.requestPath,
          timestamp: params.timestamp,
          rawBody: params.rawPayload,
          secretKey: params.secretKey,
        }),
      );
    }

    return candidateSignatures.some((expectedSignature) =>
      this.compareSignatureVariants(expectedSignature, params.providedSignature),
    );
  }

  private compareSignatureVariants(expectedHex: string, providedSignature: string) {
    const normalizedProvided = providedSignature.trim();
    const variants = [
      expectedHex,
      expectedHex.toUpperCase(),
      Buffer.from(expectedHex, 'hex').toString('base64'),
    ];

    return variants.some((candidate) =>
      this.compareSignatures(candidate, normalizedProvided),
    );
  }

  private compareSignatures(expectedSignature: string, providedSignature: string) {
    const expected = Buffer.from(expectedSignature.trim(), 'utf8');
    const provided = Buffer.from(providedSignature.trim(), 'utf8');

    if (expected.length === provided.length) {
      return timingSafeEqual(expected, provided);
    }

    return false;
  }
}
