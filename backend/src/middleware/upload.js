import multer from "multer";
import path from "path";
import fs from "fs";
import mime from "mime-types";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const USE_S3 = process.env.NODE_ENV === "production" && !!process.env.AWS_S3_BUCKET;

// ── S3 client ─────────────────────────────────────────────────────────────
let s3Client;
if (USE_S3) {
  s3Client = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
}

// ── Local disk (dev) ──────────────────────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
if (!USE_S3 && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, PDF allowed"), false);
  }
  cb(null, true);
};

const multerUpload = multer({
  storage: USE_S3
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
          const ext = mime.extension(file.mimetype);
          if (!ext) return cb(new Error("Invalid file type"), null);
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
        },
      }),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadSingle = (req, res, next) => {
  multerUpload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || "Upload failed" });
    if (!req.file) return next();

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
      req.file.location = `/uploads/${req.file.filename}`;
    }

    next();
  });
};
