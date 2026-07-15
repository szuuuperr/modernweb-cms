import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateFormDto, UpdateFormDto } from './dto/form.dto';
import { FormsService } from './forms.service';

@ApiTags('forms')
@ApiBearerAuth()
@Controller('websites/:websiteId/forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  @RequirePermissions('forms.read')
  findAll(@Param('websiteId') websiteId: string) {
    return this.formsService.findAll(websiteId);
  }

  @Get(':formId')
  @RequirePermissions('forms.read')
  findOne(
    @Param('websiteId') websiteId: string,
    @Param('formId') formId: string,
  ) {
    return this.formsService.findOne(websiteId, formId);
  }

  @Post()
  @RequirePermissions('forms.manage')
  create(@Param('websiteId') websiteId: string, @Body() dto: CreateFormDto) {
    return this.formsService.create(websiteId, dto);
  }

  @Patch(':formId')
  @RequirePermissions('forms.manage')
  update(
    @Param('websiteId') websiteId: string,
    @Param('formId') formId: string,
    @Body() dto: UpdateFormDto,
  ) {
    return this.formsService.update(websiteId, formId, dto);
  }

  @Delete(':formId')
  @RequirePermissions('forms.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('formId') formId: string,
  ) {
    return this.formsService.remove(websiteId, formId);
  }

  @Get(':formId/submissions')
  @RequirePermissions('submissions.read')
  submissions(
    @Param('websiteId') websiteId: string,
    @Param('formId') formId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.formsService.submissions(websiteId, formId, pagination);
  }

  @Delete(':formId/submissions/:submissionId')
  @RequirePermissions('submissions.delete')
  removeSubmission(
    @Param('websiteId') websiteId: string,
    @Param('formId') formId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.formsService.removeSubmission(websiteId, formId, submissionId);
  }
}
