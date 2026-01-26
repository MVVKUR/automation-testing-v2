import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, statSync } from 'fs';
import { basename } from 'path';
import { config } from '../config.js';
import type { TestArtifact, ArtifactType } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: config.s3.forcePathStyle,
});

export async function ensureBucketExists(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'NotFound' || err.name === 'NoSuchBucket') {
      await s3Client.send(new CreateBucketCommand({ Bucket: config.s3.bucket }));
      console.log(`Created S3 bucket: ${config.s3.bucket}`);
    } else {
      throw error;
    }
  }
}

export async function uploadArtifact(
  executionId: string,
  filePath: string,
  type: ArtifactType
): Promise<TestArtifact> {
  const fileName = basename(filePath);
  const key = `executions/${executionId}/${type}/${fileName}`;
  const stats = statSync(filePath);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: config.s3.bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: getContentType(type, fileName),
    },
  });

  await upload.done();

  const artifact: TestArtifact = {
    id: uuidv4(),
    executionId,
    type,
    name: fileName,
    path: key,
    url: `${config.s3.endpoint}/${config.s3.bucket}/${key}`,
    size: stats.size,
    createdAt: new Date(),
  };

  return artifact;
}

export async function uploadBuffer(
  executionId: string,
  buffer: Buffer,
  fileName: string,
  type: ArtifactType
): Promise<TestArtifact> {
  const key = `executions/${executionId}/${type}/${fileName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: getContentType(type, fileName),
    })
  );

  const artifact: TestArtifact = {
    id: uuidv4(),
    executionId,
    type,
    name: fileName,
    path: key,
    url: `${config.s3.endpoint}/${config.s3.bucket}/${key}`,
    size: buffer.length,
    createdAt: new Date(),
  };

  return artifact;
}

export async function getArtifact(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
    })
  );

  const stream = response.Body;
  if (!stream) {
    throw new Error('Empty response body');
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteArtifact(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
    })
  );
}

export async function listArtifacts(executionId: string): Promise<string[]> {
  const prefix = `executions/${executionId}/`;
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: config.s3.bucket,
      Prefix: prefix,
    })
  );

  return response.Contents?.map((obj) => obj.Key!).filter(Boolean) ?? [];
}

export async function deleteExecutionArtifacts(executionId: string): Promise<void> {
  const keys = await listArtifacts(executionId);
  for (const key of keys) {
    await deleteArtifact(key);
  }
}

function getContentType(type: ArtifactType, fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    html: 'text/html',
    json: 'application/json',
    txt: 'text/plain',
    log: 'text/plain',
  };

  if (extension && mimeTypes[extension]) {
    return mimeTypes[extension];
  }

  switch (type) {
    case 'screenshot':
      return 'image/png';
    case 'video':
      return 'video/mp4';
    case 'report':
      return 'text/html';
    case 'log':
      return 'text/plain';
    case 'trace':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

export { s3Client };
