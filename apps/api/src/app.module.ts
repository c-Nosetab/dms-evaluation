import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database';
import { AuthModule, SessionAuthGuard } from './auth';
import { StorageModule } from './storage';
import { FilesModule } from './files';
import { FoldersModule } from './folders';
import { ProcessingModule } from './processing';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '../../.env.local'],
    }),
    DatabaseModule,
    AuthModule,
    StorageModule,
    FilesModule,
    FoldersModule,
    ProcessingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AppModule {}
