import type { Server } from 'node:http';
import { request as httpRequest } from 'node:http';

export type HttpResponse = {
  readonly statusCode: number;
  readonly body: string;
  readonly headers: Record<string, string | string[] | undefined>;
};

export async function httpCall(
  server: Server,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<HttpResponse> {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected server to listen on a TCP port');
  }

  return await new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port: address.port,
        path,
        method,
        headers: {
          ...(body !== undefined
            ? {
                'content-type': 'application/json',
                'content-length': String(Buffer.byteLength(body)),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
          });
        });
      },
    );

    req.on('error', reject);
    if (body !== undefined) {
      req.write(body);
    }
    req.end();
  });
}

export function parseErrorBody(body: string): {
  error?: { code?: string; details?: Record<string, unknown> };
} {
  return JSON.parse(body) as { error?: { code?: string; details?: Record<string, unknown> } };
}
