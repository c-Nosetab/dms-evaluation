import { Module } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { FoldersController } from './folders.controller';
import { StorageModule } from '../storage';

@Module({
  imports: [StorageModule],
  providers: [FoldersService],
  controllers: [FoldersController],
  exports: [FoldersService],
})
export class FoldersModule {}
