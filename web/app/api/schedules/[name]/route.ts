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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const scheduleName = params.name;

    if (!scheduleName) {
      return NextResponse.json(
        { error: 'Schedule name is required' },
        { status: 400 }
      );
    }

    const command = `python -m embedded_elt_builder.cli.main schedules delete "${scheduleName}"`;
    const { stdout, stderr } = await runCliCommand(command);

    if (stderr && !stdout.includes('Deleted schedule')) {
      return NextResponse.json(
        { error: 'Failed to delete schedule', details: stderr },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Schedule '${scheduleName}' deleted successfully`,
      output: stdout
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete schedule', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
