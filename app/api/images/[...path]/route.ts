import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";

// Backend root (where "uploads" folder lives)
const BACKEND_DIR = resolve(process.cwd(), "..", "delivery-backend");

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  // path segments come as ["uploads", "filename.jpg"]
  const filePath = join(BACKEND_DIR, ...path);

  // Security: ensure path doesn't escape backend directory
  if (!filePath.startsWith(BACKEND_DIR)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found", tried: filePath }, { status: 404 });
  }

  try {
    const file = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase();
    const contentType = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "application/octet-stream";

    return new NextResponse(file, {
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
