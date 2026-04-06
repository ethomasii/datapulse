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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pipeline } = body;

    const command = pipeline
      ? `python -m embedded_elt_builder.cli.main sensors check --pipeline "${pipeline}"`
      : 'python -m embedded_elt_builder.cli.main sensors check';

    const { stdout, stderr } = await runCliCommand(command);

    // Parse the output to extract triggered sensors
    const lines = stdout.split('\n');
    const triggeredSensors: any[] = [];
    let currentSensor: any = null;

    for (const line of lines) {
      if (line.includes('→')) {
        // New sensor trigger
        const match = line.match(/\[bold\](.*?)\[\/bold\] → (.*)/);
        if (match) {
          if (currentSensor) {
            triggeredSensors.push(currentSensor);
          }
          currentSensor = {
            sensorName: match[1],
            pipelineName: match[2],
            message: '',
            metadata: {},
            timestamp: new Date().toISOString()
          };
        }
      } else if (currentSensor && line.includes('Metadata:')) {
        try {
          const metadataMatch = line.match(/Metadata: (.+)/);
          if (metadataMatch) {
            currentSensor.metadata = JSON.parse(metadataMatch[1]);
          }
        } catch {
          // Ignore parsing errors
        }
      } else if (currentSensor && line.trim() && !line.includes('⚡') && !line.includes('sensor(s) triggered')) {
        currentSensor.message = line.trim();
      }
    }

    if (currentSensor) {
      triggeredSensors.push(currentSensor);
    }

    return NextResponse.json({
      triggeredSensors,
      totalTriggered: triggeredSensors.length,
      output: stdout,
      hasErrors: stderr.length > 0,
      errors: stderr
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check sensors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}