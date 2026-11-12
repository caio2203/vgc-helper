import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Team,
  TeamInput,
  TeamSummary,
  TeamUpdate,
  TeamVersion,
  TeamVersionSummary,
} from '@vgc-helper/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../db/client.js';
import { teams, teamVersions } from '../db/schema.js';
import { SnapshotsService } from '../snapshots/snapshots.service.js';

type TeamRow = typeof teams.$inferSelect;

function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    gameId: row.gameId,
    formatId: row.formatId,
    regulationId: row.regulationId,
    snapshotVersion: row.snapshotVersion,
    slots: row.slots,
    notes: row.notes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Teams belong to one user; every query is scoped to that user. Each save keeps a version. */
@Injectable()
export class TeamsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly snapshots: SnapshotsService,
  ) {}

  async list(userId: string): Promise<TeamSummary[]> {
    const rows = await this.db
      .select()
      .from(teams)
      .where(and(eq(teams.userId, userId), isNull(teams.deletedAt)))
      .orderBy(desc(teams.updatedAt));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      gameId: row.gameId,
      formatId: row.formatId,
      regulationId: row.regulationId,
      snapshotVersion: row.snapshotVersion,
      species: row.slots.map((s) => s.species),
      slots: row.slots,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async get(userId: string, id: string): Promise<Team> {
    return toTeam(await this.row(userId, id));
  }

  async create(userId: string, input: TeamInput): Promise<Team> {
    await this.assertKnownRules(input);
    const now = new Date();
    const id = randomUUID();
    await this.db.batch([
      this.db
        .insert(teams)
        .values({ id, userId, ...input, version: 1, createdAt: now, updatedAt: now }),
      this.db.insert(teamVersions).values(this.versionRow(id, 1, input, now)),
    ]);
    return this.get(userId, id);
  }

  async update(userId: string, id: string, update: TeamUpdate): Promise<Team> {
    const { expectedVersion, ...input } = update;
    await this.assertKnownRules(input);
    const current = await this.row(userId, id);
    if (current.version !== expectedVersion) {
      throw new ConflictException({
        message: 'The team changed since you opened it',
        currentVersion: current.version,
      });
    }
    const now = new Date();
    const version = current.version + 1;
    await this.db.batch([
      this.db
        .update(teams)
        .set({ ...input, version, updatedAt: now })
        .where(and(eq(teams.id, id), eq(teams.userId, userId))),
      this.db.insert(teamVersions).values(this.versionRow(id, version, input, now)),
    ]);
    return this.get(userId, id);
  }

  async duplicate(userId: string, id: string, name: string): Promise<Team> {
    const source = toTeam(await this.row(userId, id));
    const { id: _id, version: _v, createdAt: _c, updatedAt: _u, ...input } = source;
    return this.create(userId, { ...input, name });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.row(userId, id);
    await this.db
      .update(teams)
      .set({ deletedAt: new Date() })
      .where(and(eq(teams.id, id), eq(teams.userId, userId)));
  }

  async versions(userId: string, id: string): Promise<TeamVersionSummary[]> {
    await this.row(userId, id);
    const rows = await this.db
      .select()
      .from(teamVersions)
      .where(eq(teamVersions.teamId, id))
      .orderBy(desc(teamVersions.version));
    return rows.map((r) => ({
      version: r.version,
      snapshotVersion: r.snapshotVersion,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async version(userId: string, id: string, version: number): Promise<TeamVersion> {
    await this.row(userId, id);
    const [row] = await this.db
      .select()
      .from(teamVersions)
      .where(and(eq(teamVersions.teamId, id), eq(teamVersions.version, version)))
      .limit(1);
    if (!row) throw new NotFoundException();
    return {
      version: row.version,
      snapshotVersion: row.snapshotVersion,
      createdAt: row.createdAt.toISOString(),
      data: row.data,
    };
  }

  private async row(userId: string, id: string): Promise<TeamRow> {
    const [row] = await this.db
      .select()
      .from(teams)
      .where(and(eq(teams.id, id), eq(teams.userId, userId), isNull(teams.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException();
    return row;
  }

  private versionRow(teamId: string, version: number, input: TeamInput, now: Date) {
    return {
      id: randomUUID(),
      teamId,
      version,
      snapshotVersion: input.snapshotVersion,
      data: input,
      createdAt: now,
    };
  }

  /** The game, format and regulation must exist in the data the API serves. */
  private async assertKnownRules(input: TeamInput): Promise<void> {
    const manifest = await this.snapshots.manifest();
    const regulation = manifest.regulations.find(
      (r) => r.gameId === input.gameId && r.id === input.regulationId,
    );
    if (!regulation?.formats.some((f) => f.formatId === input.formatId)) {
      throw new BadRequestException('Unknown game, format or regulation');
    }
  }
}
