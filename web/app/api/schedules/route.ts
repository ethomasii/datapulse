import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

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
    const body = await request.json();
    const { name, pipelineName, type, config } = body;

    if (!name || !pipelineName || !type || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: name, pipelineName, type, config' },
        { status: 400 }
      );
    }

    // Build config string — handle arrays (days_of_week) specially
    const configParts = Object.entries(config).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}=[${(value as number[]).join(',')}]`;
      }
      return `${key}=${value}`;
    });
    const configStr = configParts.join(',');

    const command = `python -m embedded_elt_builder.cli.main schedules create "${name}" "${pipelineName}" --type ${type} --config "${configStr}"`;

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
