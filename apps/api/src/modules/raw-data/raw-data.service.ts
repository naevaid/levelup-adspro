import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawPayloadObjectStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

type StoreRawPayloadInput = {
  ingestionBatchId: string;
  organizationId: string;
  shopId: string | null;
  payload: unknown;
  retentionDays: number;
};

@Injectable()
export class RawDataService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private bucketReadyPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const useSsl = this.configService.get<boolean>('MINIO_USE_SSL', false);
    const endpoint = this.configService.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    const port = this.configService.get<number>('MINIO_PORT', 9000);

    this.bucketName = this.configService.get<string>(
      'MINIO_BUCKET_RAW_CAPTURE',
      'raw-capture',
    );
    this.s3Client = new S3Client({
      region: 'us-east-1',
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>(
          'MINIO_ACCESS_KEY',
          'levelup',
        ),
        secretAccessKey: this.configService.get<string>(
          'MINIO_SECRET_KEY',
          'levelup123',
        ),
      },
    });
  }

  async storeRawPayload(input: StoreRawPayloadInput) {
    await this.ensureBucketReady();

    const serializedPayload = JSON.stringify(input.payload);
    const payloadHash = createHash('sha256')
      .update(serializedPayload)
      .digest('hex');
    const createdAt = new Date();
    const retentionUntil = new Date(
      createdAt.getTime() + input.retentionDays * 24 * 60 * 60 * 1000,
    );
    const storageKey = this.buildStorageKey(
      input.organizationId,
      createdAt,
      input.ingestionBatchId,
      payloadHash,
    );

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
        Body: serializedPayload,
        ContentType: 'application/json',
      }),
    );

    return this.prisma.rawPayloadObject.create({
      data: {
        organizationId: input.organizationId,
        shopId: input.shopId,
        ingestionBatchId: input.ingestionBatchId,
        storageKey,
        payloadHash,
        sizeBytes: Buffer.byteLength(serializedPayload),
        retentionUntil,
        status: RawPayloadObjectStatus.STORED,
      },
    });
  }

  async readRawPayload<T>(storageKey: string): Promise<T | null> {
    await this.ensureBucketReady();

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
        }),
      );

      const body = response.Body;
      if (!body) {
        return null;
      }

      const rawText = await body.transformToString();
      return JSON.parse(rawText) as T;
    } catch {
      return null;
    }
  }

  async deleteRawPayload(storageKey: string) {
    await this.ensureBucketReady();

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
        }),
      );
    } catch {
      return false;
    }

    return true;
  }

  private async ensureBucketReady() {
    if (!this.bucketReadyPromise) {
      this.bucketReadyPromise = this.createBucketIfNeeded();
    }

    await this.bucketReadyPromise;
  }

  private async createBucketIfNeeded() {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.bucketName,
        }),
      );
    } catch {
      await this.s3Client.send(
        new CreateBucketCommand({
          Bucket: this.bucketName,
        }),
      );
    }
  }

  private buildStorageKey(
    organizationId: string,
    createdAt: Date,
    ingestionBatchId: string,
    payloadHash: string,
  ) {
    const year = createdAt.getUTCFullYear();
    const month = `${createdAt.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${createdAt.getUTCDate()}`.padStart(2, '0');

    return `${organizationId}/${year}/${month}/${day}/${ingestionBatchId}-${payloadHash}.json`;
  }
}
