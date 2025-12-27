import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SessionStrategy } from './session.strategy';
import { AuthService } from './auth.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'session' })],
  providers: [SessionStrategy, AuthService],
  exports: [AuthService],
})
export class AuthModule {}
