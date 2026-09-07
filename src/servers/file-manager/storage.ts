import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileStorage } from "@prisma/client";

export function getFileStorage() {
  const configured = process.env.FILE_MANAGER_STORAGE?.toLowerCase();
  return configured === "s3" ? FileStorage.S3 : FileStorage.LOCAL;
}

function getLocalRoot() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.FILE_MANAGER_LOCAL_ROOT ??
      path.join(process.cwd(), ".data", "files"),
  );
}

function getS3Client() {
  const endpoint = process.env.FILE_MANAGER_S3_ENDPOINT;
  return new S3Client({
    region: process.env.FILE_MANAGER_S3_REGION ?? "auto",
    endpoint: endpoint || undefined,
    forcePathStyle: process.env.FILE_MANAGER_S3_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.FILE_MANAGER_S3_ACCESS_KEY_ID &&
      process.env.FILE_MANAGER_S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.FILE_MANAGER_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.FILE_MANAGER_S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

function getLocalPath(objectKey: string) {
  const root = getLocalRoot();
  const resolved = path.resolve(root, objectKey);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid file object key");
  }
  return resolved;
}

export async function putFile(input: {
  storage: FileStorage;
  objectKey: string;
  bytes: Uint8Array;
  mimeType: string;
}) {
  if (input.storage === FileStorage.LOCAL) {
    const target = getLocalPath(input.objectKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.bytes);
    return;
  }

  const bucket = process.env.FILE_MANAGER_S3_BUCKET;
  if (!bucket) throw new Error("FILE_MANAGER_S3_BUCKET is not configured");
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      Body: input.bytes,
      ContentType: input.mimeType,
    }),
  );
}

export async function getFile(input: {
  storage: FileStorage;
  objectKey: string;
}) {
  if (input.storage === FileStorage.LOCAL) {
    return readFile(/* turbopackIgnore: true */ getLocalPath(input.objectKey));
  }

  const bucket = process.env.FILE_MANAGER_S3_BUCKET;
  if (!bucket) throw new Error("FILE_MANAGER_S3_BUCKET is not configured");
  const result = await getS3Client().send(
    new GetObjectCommand({ Bucket: bucket, Key: input.objectKey }),
  );
  if (!result.Body) throw new Error("File object has no body");
  return Buffer.from(await result.Body.transformToByteArray());
}

export async function deleteFile(input: {
  storage: FileStorage;
  objectKey: string;
}) {
  if (input.storage === FileStorage.LOCAL) {
    try {
      await unlink(getLocalPath(input.objectKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return;
  }

  const bucket = process.env.FILE_MANAGER_S3_BUCKET;
  if (!bucket) throw new Error("FILE_MANAGER_S3_BUCKET is not configured");
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: input.objectKey }),
  );
}
