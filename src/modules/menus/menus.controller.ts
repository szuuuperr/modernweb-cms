import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  CreateMenuDto,
  CreateMenuItemDto,
  ReorderMenuDto,
  UpdateMenuDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';
import { MenusService } from './menus.service';

@ApiTags('menus')
@ApiBearerAuth()
@Controller('websites/:websiteId/menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get()
  @RequirePermissions('menus.read')
  findAll(@Param('websiteId') websiteId: string) {
    return this.menusService.findAll(websiteId);
  }

  @Get(':menuId')
  @RequirePermissions('menus.read')
  findOne(
    @Param('websiteId') websiteId: string,
    @Param('menuId') menuId: string,
  ) {
    return this.menusService.findOne(websiteId, menuId);
  }

  @Post()
  @RequirePermissions('menus.manage')
  create(@Param('websiteId') websiteId: string, @Body() dto: CreateMenuDto) {
    return this.menusService.create(websiteId, dto);
  }

  @Patch(':menuId')
  @RequirePermissions('menus.manage')
  update(
    @Param('websiteId') websiteId: string,
    @Param('menuId') menuId: string,
    @Body() dto: UpdateMenuDto,
  ) {
    return this.menusService.update(websiteId, menuId, dto);
  }

  @Delete(':menuId')
  @RequirePermissions('menus.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('menuId') menuId: string,
  ) {
    return this.menusService.remove(websiteId, menuId);
  }

  @Post(':menuId/items')
  @RequirePermissions('menus.manage')
  addItem(
    @Param('websiteId') websiteId: string,
    @Param('menuId') menuId: string,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menusService.addItem(websiteId, menuId, dto);
  }

  @Patch(':menuId/items/:itemId')
  @RequirePermissions('menus.manage')
  updateItem(
    @Param('websiteId') websiteId: string,
    @Param('menuId') menuId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menusService.updateItem(websiteId, menuId, itemId, dto);
  }

  @Delete(':menuId/items/:itemId')
  @RequirePermissions('menus.manage')
  removeItem(
    @Param('websiteId') websiteId: string,
    @Param('menuId') menuId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.menusService.removeItem(websiteId, menuId, itemId);
  }

  @HttpCode(200)
  @Put(':menuId/reorder')
  @RequirePermissions('menus.manage')
  reorder(
    @Param('websiteId') websiteId: string,
    @Param('menuId') menuId: string,
    @Body() dto: ReorderMenuDto,
  ) {
    return this.menusService.reorder(websiteId, menuId, dto);
  }
}
