import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('websites/:websiteId/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @RequirePermissions('media.read')
  findAll(
    @Param('websiteId') websiteId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.mediaService.findAll(websiteId, pagination);
  }

  @Post()
  @RequirePermissions('media.upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string' },
      },
      required: ['file'],
    },
  })
  upload(
    @Param('websiteId') websiteId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('alt') alt?: string,
  ) {
    return this.mediaService.upload(websiteId, file, alt);
  }

  @Delete(':mediaId')
  @RequirePermissions('media.delete')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.mediaService.remove(websiteId, mediaId);
  }
}
