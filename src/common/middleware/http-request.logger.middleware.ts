import { Injectable, Logger, NestMiddleware, LogLevel } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Logs every inbound HTTP request and its matching response.
 *
 * Fields: method, path, status, duration, user (sub/username or 'anonymous'),
 * ip. 5xx are logged as errors, 4xx as warnings, everything else as info.
 * Sensitive bodies/headers are deliberately not logged.
 */
@Injectable()
export class HttpRequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpRequestLoggerMiddleware.name);
  private readonly logLevel: LogLevel;
  private readonly enabledLevels: LogLevel[];

  constructor(logLevel?: string) {
    this.logLevel = (logLevel ?? process.env.LOG_LEVEL ?? 'log').toLowerCase() as LogLevel;
    this.enabledLevels = this.getEnabledLevels(this.logLevel);
    this.logger.log(`HttpRequestLoggerMiddleware log level: ${this.logLevel}`);
  }

  private getEnabledLevels(level: LogLevel): LogLevel[] {
    const levels: LogLevel[] = ['error', 'warn', 'log'];
    if (level === 'debug' || level === 'verbose') {
      levels.push('debug', 'verbose');
    }
    return levels;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enabledLevels.includes(level);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const user = (req as Record<string, unknown>).user
      ? String(
          (req as Record<string, unknown>).user?.['sub'] ??
            (req as Record<string, unknown>).user?.['username'] ??
            'authenticated',
        )
      : 'anonymous';
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      const message = `${method} ${originalUrl} -> ${statusCode} [${duration}ms] user=${user} ip=${ip}`;

      if (statusCode >= 500) {
        if (this.shouldLog('error')) this.logger.error(message);
      } else if (statusCode >= 400) {
        if (this.shouldLog('warn')) this.logger.warn(message);
      } else {
        if (this.shouldLog('log')) this.logger.log(message);
      }
    });

    next();
  }
}