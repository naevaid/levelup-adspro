import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MarketplacesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const marketplaces = await this.prisma.marketplace.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return marketplaces.map((marketplace) => ({
      id: marketplace.id,
      code: marketplace.code,
      name: marketplace.name,
    }));
  }
}
