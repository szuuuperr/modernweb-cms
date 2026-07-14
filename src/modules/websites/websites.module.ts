import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { WebsitesController } from './websites.controller';
import { WebsitesService } from './websites.service';

@Module({
  controllers: [WebsitesController, MembersController],
  providers: [WebsitesService, MembersService],
})
export class WebsitesModule {}
