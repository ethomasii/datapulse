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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pipeline } = body;

    const command = pipeline
      ? `python -m embedded_elt_builder.cli.main schedules check --pipeline "${pipeline}"`
      : 'python -m embedded_elt_builder.cli.main schedules check';

    const { stdout, stderr } = await runCliCommand(command);

    // Parse triggered schedules from CLI output
    const lines = stdout.split('\n');
    const triggeredSchedules: any[] = [];
    let current: any = null;

    for (const line of lines) {
      if (line.includes('→')) {
        const match = line.match(/\[bold\](.*?)\[\/bold\] → (.*)/) || line.match(/^(\S+)\s+→\s+(.+)/);
        if (match) {
          if (current) triggeredSchedules.push(current);
          current = {
            scheduleName: match[1].trim(),
            pipelineName: match[2].trim(),
            message: '',
            metadata: {},
            timestamp: new Date().toISOString()
          };
        }
      } else if (current && line.includes('Metadata:')) {
        try {
          const metadataMatch = line.match(/Metadata: (.+)/);
          if (metadataMatch) {
            current.metadata = JSON.parse(metadataMatch[1].replace(/'/g, '"'));
          }
        } catch {
          // ignore
        }
      } else if (current && line.trim() && !line.includes('⏰') && !line.includes('schedule(s) triggered') && !line.includes('Checking schedules')) {
        if (!current.message) current.message = line.trim();
      }
    }
    if (current) triggeredSchedules.push(current);

    return NextResponse.json({
      triggeredSchedules,
      totalTriggered: triggeredSchedules.length,
      output: stdout,
      hasErrors: stderr.length > 0,
      errors: stderr
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check schedules', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
