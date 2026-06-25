import multer from "multer";
import path from "path";
import fs from "fs";
import mime from "mime-types";
import { fileTypeFromBuffer, fileTypeFromFile } from "file-type";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const USE_S3 = process.env.NODE_ENV === "production" && !!process.env.AWS_S3_BUCKET;

let s3Client;
if (USE_S3) {
  s3Client = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
}

const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
if (!USE_S3 && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types — must match both the declared type AND the actual file bytes
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, PDF allowed"), false);
  }
  cb(null, true);
};

// Always use memory storage so we can read the bytes for magic byte check
const multerUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function validateMagicBytes(buffer, declaredMime) {
  const detected = await fileTypeFromBuffer(buffer);
  // PDF magic bytes: %PDF — file-type returns "application/pdf"
  // JPEG: "image/jpeg", PNG: "image/png"
  if (!detected) {
    // file-type couldn't detect — reject
    return false;
  }
  return detected.mime === declaredMime;
}

export const uploadSingle = (req, res, next) => {
  multerUpload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || "Upload failed" });
    if (!req.file) return next();

    // Magic byte check — verify actual file contents match declared MIME type
    const valid = await validateMagicBytes(req.file.buffer, req.file.mimetype).catch(() => false);
    if (!valid) {
      return res.status(400).json({ message: "File content does not match its declared type" });
    }

    if (USE_S3) {
      try {
        const ext = mime.extension(req.file.mimetype) || "bin";
        const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          })
        );

        req.file.location = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;
      } catch {
        return res.status(500).json({ message: "Storage upload failed" });
      }
    } else {
      // Write validated buffer to disk
      const ext = mime.extension(req.file.mimetype) || "bin";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      req.file.filename = filename;
      req.file.location = `/uploads/${filename}`;
    }

    next();
  });
};
