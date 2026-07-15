import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { WEBHOOK_EVENTS } from './webhook-events';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('websites/:websiteId/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /** Discoverable list of subscribable events, for the admin UI. */
  @Get('events')
  @RequirePermissions('webhooks.read')
  listEvents() {
    return { events: WEBHOOK_EVENTS };
  }

  @Get()
  @RequirePermissions('webhooks.read')
  findAll(@Param('websiteId') websiteId: string) {
    return this.webhooksService.findAll(websiteId);
  }

  @Get(':webhookId')
  @RequirePermissions('webhooks.read')
  findOne(
    @Param('websiteId') websiteId: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.findOne(websiteId, webhookId);
  }

  @Get(':webhookId/deliveries')
  @RequirePermissions('webhooks.read')
  deliveries(
    @Param('websiteId') websiteId: string,
    @Param('webhookId') webhookId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.webhooksService.deliveries(websiteId, webhookId, pagination);
  }

  @Post()
  @RequirePermissions('webhooks.manage')
  create(@Param('websiteId') websiteId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(websiteId, dto);
  }

  @Patch(':webhookId')
  @RequirePermissions('webhooks.manage')
  update(
    @Param('websiteId') websiteId: string,
    @Param('webhookId') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(websiteId, webhookId, dto);
  }

  @HttpCode(200)
  @Post(':webhookId/rotate-secret')
  @RequirePermissions('webhooks.manage')
  rotateSecret(
    @Param('websiteId') websiteId: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.rotateSecret(websiteId, webhookId);
  }

  @Delete(':webhookId')
  @RequirePermissions('webhooks.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.remove(websiteId, webhookId);
  }
}
