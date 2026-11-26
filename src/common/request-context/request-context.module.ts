import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

/** Global so any module can read the request origin (ip / user-agent). */
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class RequestContextModule {}
