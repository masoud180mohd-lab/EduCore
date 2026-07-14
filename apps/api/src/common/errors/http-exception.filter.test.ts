import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from './app-error.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

describe('HttpExceptionFilter', () => {
  it('returns ACF envelope with requestId for AppError', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const filter = new HttpExceptionFilter(logger);

    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const setHeader = vi.fn();
    const getHeader = vi.fn().mockReturnValue(undefined);

    filter.catch(new AppError('UNAUTHORIZED', 'Authentication required.'), {
      switchToHttp: () => ({
        getResponse: () => ({ status, setHeader, getHeader }),
        getRequest: () => ({
          requestId: 'req-123',
          correlationId: 'corr-123',
          header: () => undefined,
        }),
      }),
    } as never);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
        requestId: 'req-123',
      },
    });
  });

  it('maps unknown errors to INTERNAL_ERROR without leaking details', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const filter = new HttpExceptionFilter(logger);

    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });

    filter.catch(new Error('secret SQL detail'), {
      switchToHttp: () => ({
        getResponse: () => ({
          status,
          setHeader: vi.fn(),
          getHeader: vi.fn().mockReturnValue(undefined),
        }),
        getRequest: () => ({
          requestId: 'req-x',
          header: () => undefined,
        }),
      }),
    } as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        requestId: 'req-x',
      },
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret SQL');
  });

  it('maps HttpException NOT_FOUND', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const filter = new HttpExceptionFilter(logger);
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });

    filter.catch(new HttpException('gone', HttpStatus.NOT_FOUND), {
      switchToHttp: () => ({
        getResponse: () => ({
          status,
          setHeader: vi.fn(),
          getHeader: vi.fn().mockReturnValue(undefined),
        }),
        getRequest: () => ({ requestId: 'r', header: () => undefined }),
      }),
    } as never);

    expect(status).toHaveBeenCalledWith(404);
    const body = json.mock.calls[0]?.[0] as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
