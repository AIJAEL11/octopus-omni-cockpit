import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

const s3 = createS3Client();

/**
 * Genera una URL pre-firmada para subir un archivo directamente a S3.
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic = false
): Promise<{ uploadUrl: string; cloud_storage_path: string }> {
  const { bucketName, folderPrefix } = getBucketConfig();
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return { uploadUrl, cloud_storage_path };
}

/**
 * Sube un Buffer directamente a S3 como archivo público.
 * Retorna la URL pública del objeto.
 */
export async function uploadBufferToS3Public(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<{ publicUrl: string; cloud_storage_path: string }> {
  const { bucketName, folderPrefix } = getBucketConfig();
  const cloud_storage_path = `${folderPrefix}public/uploads/${Date.now()}-${fileName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: cloud_storage_path,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: "attachment",
    })
  );

  const region = process.env.AWS_REGION || "us-west-2";
  const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;

  return { publicUrl, cloud_storage_path };
}

/**
 * Genera una URL firmada para descargar un archivo privado.
 */
export async function getSignedDownloadUrl(
  cloud_storage_path: string,
  expiresIn = 3600
): Promise<string> {
  const { bucketName } = getBucketConfig();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ResponseContentDisposition: "attachment",
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Obtiene la URL pública o firmada según el flag isPublic.
 */
export function getFileUrl(cloud_storage_path: string, isPublic: boolean): string | Promise<string> {
  if (isPublic) {
    const { bucketName } = getBucketConfig();
    const region = process.env.AWS_REGION || "us-west-2";
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;
  }
  return getSignedDownloadUrl(cloud_storage_path);
}

/**
 * Elimina un archivo de S3.
 */
export async function deleteFile(cloud_storage_path: string): Promise<void> {
  const { bucketName } = getBucketConfig();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: cloud_storage_path,
    })
  );
}
