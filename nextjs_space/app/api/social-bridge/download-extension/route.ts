import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

// GET: Download the chrome extension as a ZIP file
export async function GET() {
  try {
    // Find the chrome-extension folder
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'chrome-extension'),
      path.join(process.cwd(), '..', 'public', 'chrome-extension'),
      path.join(__dirname, '..', '..', '..', '..', 'public', 'chrome-extension'),
    ];

    let extensionDir = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        extensionDir = p;
        break;
      }
    }

    if (!extensionDir) {
      console.error('Chrome extension folder not found. Tried:', possiblePaths);
      return NextResponse.json({ error: 'Extension files not found' }, { status: 404 });
    }

    // Create ZIP in memory
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve());
      archive.on('error', (err: Error) => reject(err));

      // Add directory contents to zip (files will be at root of zip, not inside a subfolder)
      archive.directory(extensionDir, 'octopus-social-bridge');

      archive.finalize();
    });

    const zipBuffer = Buffer.concat(chunks);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="OCTOPUS-Social-Bridge.zip"',
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Extension download error:', error);
    return NextResponse.json({ error: 'Error generating download' }, { status: 500 });
  }
}
