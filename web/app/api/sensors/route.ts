import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to run CLI commands
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
    // Get list of sensors
    const { stdout, stderr } = await runCliCommand('python -m embedded_elt_builder.cli.main sensors list --json');

    if (stderr && !stdout.includes('[')) {
      // If no JSON output, try to parse the text output
      const { stdout: textOutput } = await runCliCommand('python -m embedded_elt_builder.cli.main sensors list');
      return NextResponse.json({
        sensors: [],
        message: 'No sensors found or CLI error',
        raw: textOutput
      });
    }

    try {
      const sensors = JSON.parse(stdout);
      return NextResponse.json({ sensors });
    } catch {
      // Fallback: return raw output
      return NextResponse.json({
        sensors: [],
        message: 'Could not parse sensor data',
        raw: stdout
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch sensors', details: error instanceof Error ? error.message : 'Unknown error' },
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

    // Convert config object to CLI format
    const configStr = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    const command = `python -m embedded_elt_builder.cli.main sensors create "${name}" "${pipelineName}" --type ${type} --config "${configStr}"`;

    const { stdout, stderr } = await runCliCommand(command);

    if (stderr && !stdout.includes('Created sensor')) {
      return NextResponse.json(
        { error: 'Failed to create sensor', details: stderr },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Sensor '${name}' created successfully`,
      output: stdout
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create sensor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}