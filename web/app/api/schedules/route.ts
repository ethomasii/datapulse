import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getCurrentDbUser } from '@/lib/auth/server';
import { db } from '@/lib/db/client';

const execAsync = promisify(exec);

async function runCliCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(command, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() }
    });
  } catch (error: any) {
    return { stdout: error.stdout || '', stderr: error.stderr || error.message };
  }
}

export async function GET() {
  try {
    const { stdout, stderr } = await runCliCommand('python -m embedded_elt_builder.cli.main schedules list --json');

    if (stderr && !stdout.includes('[')) {
      return NextResponse.json({
        schedules: [],
        message: 'No schedules found or CLI error',
        raw: stderr
      });
    }

    try {
      const schedules = JSON.parse(stdout);
      return NextResponse.json({ schedules });
    } catch {
      return NextResponse.json({
        schedules: [],
        message: 'Could not parse schedule data',
        raw: stdout
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch schedules', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const { name, type, config } = body;

    let pipelineNames: string[] = [];

    const rawIds = body.pipelineIds;
    if (Array.isArray(rawIds) && rawIds.length > 0) {
      const ids = rawIds
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim());
      const uniqueIds = Array.from(new Set(ids));
      const rows = await db.eltPipeline.findMany({
        where: { userId: user.id, id: { in: uniqueIds } },
        select: { id: true, name: true },
      });
      if (rows.length !== uniqueIds.length) {
        return NextResponse.json(
          { error: "One or more pipeline ids are invalid or not in your workspace" },
          { status: 400 }
        );
      }
      const byId = new Map(rows.map((r) => [r.id, r.name]));
      pipelineNames = uniqueIds.map((id) => byId.get(id)!);
    } else {
      const rawNames = body.pipelineNames;
      pipelineNames =
        Array.isArray(rawNames) && rawNames.length > 0
          ? rawNames
              .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
              .map((p) => p.trim())
          : [];
    }

    if (!name || typeof name !== "string" || !pipelineNames.length || !type || !config) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, type, config, and pipelineIds (non-empty) or pipelineNames (non-empty)",
        },
        { status: 400 }
      );
    }

    // Build config string — handle arrays (days_of_week) specially
    const configParts = Object.entries(config as Record<string, unknown>).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}=[${(value as number[]).join(",")}]`;
      }
      return `${key}=${value}`;
    });
    const configStr = configParts.join(",");

    const q = (s: string) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const pipelineArgs = pipelineNames.map(q).join(" ");
    const command = `python -m embedded_elt_builder.cli.main schedules create ${q(name)} ${pipelineArgs} --type ${type} --config ${q(configStr)}`;

    const { stdout, stderr } = await runCliCommand(command);

    if (stderr && !stdout.includes('Created schedule')) {
      return NextResponse.json(
        { error: 'Failed to create schedule', details: stderr },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Schedule '${name}' created successfully`,
      output: stdout
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create schedule', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
