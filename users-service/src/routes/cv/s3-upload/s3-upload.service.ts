import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const createS3Client = (): S3Client => {
  const region = process.env.S3_REGION;
  if (!region) {
    throw new Error("S3_REGION is missing");
  }

  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

  if (accessKeyId && secretAccessKey) {
    return new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
  });
};

let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = createS3Client();
  }
  return s3Client;
};

export const uploadCvToS3 = async (userId: string, cvBuffer: Buffer): Promise<string> => {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET is missing");
  }
  const uploadPrefix = process.env.S3_UPLOAD_PREFIX || "uploads";

  const s3 = getS3Client();
  const objectKey = `${uploadPrefix}/cv/${userId}.pdf`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: cvBuffer,
      ContentType: "application/pdf",
    }),
  );

  return `s3://${bucket}/${objectKey}`;
};
