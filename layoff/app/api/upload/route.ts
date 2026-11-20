import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Location where uploads are stored: c:\Users\Constance\Desktop\Work\layoff\uploads
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // Ensure uploads directory exists
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const uploadedFiles = [];

    for (const file of files) {
      if (!file.name) continue;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Clean file name and prevent overwrite
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}-${safeName}`;
      const filePath = path.join(UPLOADS_DIR, uniqueFilename);

      await fs.writeFile(filePath, buffer);

      // Format file size
      const sizeKB = Math.round(file.size / 1024);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const formattedSize = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

      // Determine category (photo vs document)
      const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
      const category = isImage ? "photo" : "document";

      uploadedFiles.push({
        name: file.name,
        savedName: uniqueFilename,
        fileUrl: `/api/uploads/${uniqueFilename}`,
        size: formattedSize,
        type: file.type || (isImage ? "image/jpeg" : "application/pdf"),
        category,
      });
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file(s)" }, { status: 500 });
  }
}
