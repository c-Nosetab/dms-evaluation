import { Module, forwardRef } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { StorageModule } from '../storage';
import { ProcessingModule } from '../processing/processing.module';

@Module({
  imports: [StorageModule, forwardRef(() => ProcessingModule)],
  providers: [FilesService],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
