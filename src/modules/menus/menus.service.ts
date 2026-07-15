import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTENT_CHANGED,
  ContentAction,
  ContentChangedEvent,
} from '../../common/events/content-changed.event';
import { MenuItem } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  CreateMenuDto,
  CreateMenuItemDto,
  ReorderMenuDto,
  UpdateMenuDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';

export interface MenuItemNode {
  id: string;
  label: string;
  url: string | null;
  pageId: string | null;
  entryId: string | null;
  target: string | null;
  order: number;
  children: MenuItemNode[];
}

@Injectable()
export class MenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Drives cache invalidation and webhook delivery. */
  private emitChanged(websiteId: string, action: ContentAction, id: string) {
    this.events.emit(
      CONTENT_CHANGED,
      new ContentChangedEvent(websiteId, 'menu', action, id),
    );
  }

  findAll(websiteId: string) {
    return this.prisma.menu.findMany({
      where: { websiteId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(websiteId: string, menuId: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, websiteId },
    });
    if (!menu) throw new NotFoundException('Menu not found');
    const items = await this.prisma.menuItem.findMany({
      where: { menuId: menu.id },
      orderBy: { order: 'asc' },
    });
    return { ...menu, items: buildTree(items) };
  }

  async create(websiteId: string, dto: CreateMenuDto) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');
    await this.ensureSlugFree(websiteId, dto.slug);
    const menu = await this.prisma.menu.create({ data: { websiteId, ...dto } });
    this.emitChanged(websiteId, 'created', menu.id);
    return menu;
  }

  async update(websiteId: string, menuId: string, dto: UpdateMenuDto) {
    const menu = await this.getMenuOrThrow(websiteId, menuId);
    if (dto.slug && dto.slug !== menu.slug) {
      await this.ensureSlugFree(websiteId, dto.slug);
    }
    const updated = await this.prisma.menu.update({
      where: { id: menuId },
      data: dto,
    });
    this.emitChanged(websiteId, 'updated', menuId);
    return updated;
  }

  async remove(websiteId: string, menuId: string) {
    await this.getMenuOrThrow(websiteId, menuId);
    await this.prisma.menu.delete({ where: { id: menuId } });
    this.emitChanged(websiteId, 'deleted', menuId);
    return { deleted: true };
  }

  async addItem(websiteId: string, menuId: string, dto: CreateMenuItemDto) {
    await this.getMenuOrThrow(websiteId, menuId);
    await this.validateItemTargets(websiteId, dto);
    if (dto.parentId) await this.getItemOrThrow(menuId, dto.parentId);

    const item = await this.prisma.menuItem.create({
      data: {
        menuId,
        label: dto.label,
        url: dto.url,
        pageId: dto.pageId,
        entryId: dto.entryId,
        target: dto.target,
        parentId: dto.parentId,
        order: dto.order ?? (await this.nextOrder(menuId, dto.parentId)),
      },
    });
    this.emitChanged(websiteId, 'updated', menuId);
    return item;
  }

  async updateItem(
    websiteId: string,
    menuId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
  ) {
    await this.getMenuOrThrow(websiteId, menuId);
    await this.getItemOrThrow(menuId, itemId);
    await this.validateItemTargets(websiteId, dto);

    if (dto.parentId !== undefined && dto.parentId !== null) {
      await this.getItemOrThrow(menuId, dto.parentId);
      await this.ensureNoCycle(menuId, itemId, dto.parentId);
    }
    const item = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: dto,
    });
    this.emitChanged(websiteId, 'updated', menuId);
    return item;
  }

  async removeItem(websiteId: string, menuId: string, itemId: string) {
    await this.getMenuOrThrow(websiteId, menuId);
    await this.getItemOrThrow(menuId, itemId);
    // Children cascade via the self-relation's onDelete: Cascade.
    await this.prisma.menuItem.delete({ where: { id: itemId } });
    this.emitChanged(websiteId, 'updated', menuId);
    return { deleted: true };
  }

  /** Applies a whole-tree reorder atomically. */
  async reorder(websiteId: string, menuId: string, dto: ReorderMenuDto) {
    await this.getMenuOrThrow(websiteId, menuId);
    const existing = await this.prisma.menuItem.findMany({
      where: { menuId },
      select: { id: true },
    });
    const known = new Set(existing.map((item) => item.id));

    for (const item of dto.items) {
      if (!known.has(item.id)) {
        throw new NotFoundException(`Menu item ${item.id} not in this menu`);
      }
      if (item.parentId && !known.has(item.parentId)) {
        throw new NotFoundException(`Parent ${item.parentId} not in this menu`);
      }
      if (item.parentId === item.id) {
        throw new BadRequestException('An item cannot be its own parent');
      }
    }
    // Validate the whole proposed shape before writing, so a cycle in the
    // payload can't be created by an intermediate write.
    ensureAcyclic(dto.items);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.menuItem.update({
          where: { id: item.id },
          data: { parentId: item.parentId ?? null, order: item.order },
        }),
      ),
    );
    this.emitChanged(websiteId, 'updated', menuId);
    return this.findOne(websiteId, menuId);
  }

  /** Public API reads menus by slug, not id. */
  async findBySlug(websiteId: string, slug: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { websiteId_slug: { websiteId, slug } },
    });
    if (!menu) throw new NotFoundException('Menu not found');
    const items = await this.prisma.menuItem.findMany({
      where: { menuId: menu.id },
      orderBy: { order: 'asc' },
    });
    return {
      name: menu.name,
      slug: menu.slug,
      items: buildTree(items),
    };
  }

  private async nextOrder(menuId: string, parentId?: string) {
    const last = await this.prisma.menuItem.findFirst({
      where: { menuId, parentId: parentId ?? null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return last ? last.order + 1 : 0;
  }

  private async validateItemTargets(
    websiteId: string,
    dto: CreateMenuItemDto | UpdateMenuItemDto,
  ) {
    if (dto.pageId) {
      const page = await this.prisma.page.findFirst({
        where: { id: dto.pageId, websiteId },
        select: { id: true },
      });
      if (!page) throw new NotFoundException('Page not found on this website');
    }
    if (dto.entryId) {
      const entry = await this.prisma.entry.findFirst({
        where: { id: dto.entryId, websiteId },
        select: { id: true },
      });
      if (!entry)
        throw new NotFoundException('Entry not found on this website');
    }
  }

  /** Walks up from the proposed parent; meeting itemId means a cycle. */
  private async ensureNoCycle(
    menuId: string,
    itemId: string,
    parentId: string,
  ) {
    if (parentId === itemId) {
      throw new BadRequestException('An item cannot be its own parent');
    }
    const items = await this.prisma.menuItem.findMany({
      where: { menuId },
      select: { id: true, parentId: true },
    });
    const parentOf = new Map(items.map((item) => [item.id, item.parentId]));
    let cursor: string | null | undefined = parentId;
    while (cursor) {
      if (cursor === itemId) {
        throw new BadRequestException(
          'Cannot move an item under one of its own descendants',
        );
      }
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  private async getMenuOrThrow(websiteId: string, menuId: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, websiteId },
    });
    if (!menu) throw new NotFoundException('Menu not found');
    return menu;
  }

  private async getItemOrThrow(menuId: string, itemId: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, menuId },
    });
    if (!item) throw new NotFoundException('Menu item not found in this menu');
    return item;
  }

  private async ensureSlugFree(websiteId: string, slug: string) {
    const existing = await this.prisma.menu.findUnique({
      where: { websiteId_slug: { websiteId, slug } },
    });
    if (existing) {
      throw new ConflictException('Menu slug already in use on this website');
    }
  }
}

/** Flat rows -> nested tree, children ordered by `order`. */
function buildTree(items: MenuItem[]): MenuItemNode[] {
  const nodes = new Map<string, MenuItemNode>();
  for (const item of items) {
    nodes.set(item.id, {
      id: item.id,
      label: item.label,
      url: item.url,
      pageId: item.pageId,
      entryId: item.entryId,
      target: item.target,
      order: item.order,
      children: [],
    });
  }
  const roots: MenuItemNode[] = [];
  for (const item of items) {
    const node = nodes.get(item.id)!;
    const parent = item.parentId ? nodes.get(item.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: MenuItemNode[]) => {
    list.sort((a, b) => a.order - b.order);
    list.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

/** Rejects a reorder payload whose parent links would form a cycle. */
function ensureAcyclic(items: { id: string; parentId?: string | null }[]) {
  const parentOf = new Map(
    items.map((item) => [item.id, item.parentId ?? null]),
  );
  for (const item of items) {
    const seen = new Set<string>([item.id]);
    let cursor = parentOf.get(item.id) ?? null;
    while (cursor) {
      if (seen.has(cursor)) {
        throw new BadRequestException(
          'Reorder payload would create a cycle in the menu tree',
        );
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor) ?? null;
    }
  }
}
