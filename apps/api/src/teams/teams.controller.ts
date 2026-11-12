import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  type Team,
  type TeamInput,
  type TeamSummary,
  type TeamUpdate,
  type TeamVersion,
  type TeamVersionSummary,
  teamInputSchema,
  teamUpdateSchema,
} from '@vgc-helper/shared';
import { z } from 'zod';
import { CurrentSession } from '../auth/access.js';
import type { SessionContext } from '../auth/session.service.js';
import { ZodPipe } from '../core/zod.pipe.js';
import { TeamsService } from './teams.service.js';

const duplicateSchema = z.object({ name: z.string().trim().min(1).max(80) });

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(@CurrentSession() s: SessionContext): Promise<TeamSummary[]> {
    return this.teams.list(s.user.id);
  }

  @Post()
  create(
    @CurrentSession() s: SessionContext,
    @Body(new ZodPipe(teamInputSchema)) input: TeamInput,
  ): Promise<Team> {
    return this.teams.create(s.user.id, input);
  }

  @Get(':id')
  get(@CurrentSession() s: SessionContext, @Param('id') id: string): Promise<Team> {
    return this.teams.get(s.user.id, id);
  }

  @Put(':id')
  update(
    @CurrentSession() s: SessionContext,
    @Param('id') id: string,
    @Body(new ZodPipe(teamUpdateSchema)) update: TeamUpdate,
  ): Promise<Team> {
    return this.teams.update(s.user.id, id, update);
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentSession() s: SessionContext,
    @Param('id') id: string,
    @Body(new ZodPipe(duplicateSchema)) body: z.infer<typeof duplicateSchema>,
  ): Promise<Team> {
    return this.teams.duplicate(s.user.id, id, body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentSession() s: SessionContext, @Param('id') id: string): Promise<void> {
    return this.teams.remove(s.user.id, id);
  }

  @Get(':id/versions')
  versions(
    @CurrentSession() s: SessionContext,
    @Param('id') id: string,
  ): Promise<TeamVersionSummary[]> {
    return this.teams.versions(s.user.id, id);
  }

  @Get(':id/versions/:version')
  version(
    @CurrentSession() s: SessionContext,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<TeamVersion> {
    return this.teams.version(s.user.id, id, version);
  }
}
