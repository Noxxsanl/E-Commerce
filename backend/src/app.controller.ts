import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('System')
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'API info' })
  @ApiResponse({ status: 200, description: 'API information' })
  getInfo() {
    return {
      name: 'E-Commerce API',
      version: '1.0.0',
      description: 'NestJS 11 · MongoDB · Redis · BullMQ · Socket.IO',
      docs: '/api/docs',
    };
  }
}
