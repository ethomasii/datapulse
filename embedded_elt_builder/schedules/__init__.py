"""eltPulse Schedules - Cron-based pipeline orchestration.

This module provides cron-based scheduling for pipelines, allowing time-based
triggers for automated pipeline execution.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import json
import os
import croniter
import pytz


@dataclass
class ScheduleResult:
    """Result of a schedule evaluation."""
    should_trigger: bool
    next_run: datetime
    metadata: Dict[str, Any]


class BaseSchedule(ABC):
    """Base class for all eltPulse schedules."""

    def __init__(self, name: str, pipeline_name: str, cron_expression: str, timezone: str = 'UTC'):
        self.name = name
        self.pipeline_name = pipeline_name
        self.cron_expression = cron_expression
        self.timezone = timezone
        self.last_run = None
        self.next_run = None
        self._calculate_next_run()

    def _calculate_next_run(self):
        """Calculate the next run time based on cron expression."""
        try:
            tz = pytz.timezone(self.timezone)
            now = datetime.now(tz)
            cron = croniter.croniter(self.cron_expression, now)
            self.next_run = cron.get_next(datetime)
        except Exception:
            self.next_run = None

    @abstractmethod
    def should_run(self, current_time: Optional[datetime] = None) -> ScheduleResult:
        """Check if the schedule should trigger at the given time."""
        pass

    def get_status(self) -> Dict[str, Any]:
        """Get current schedule status."""
        return {
            "name": self.name,
            "pipeline_name": self.pipeline_name,
            "type": self.__class__.__name__,
            "cron_expression": self.cron_expression,
            "timezone": self.timezone,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None
        }


class CronSchedule(BaseSchedule):
    """Standard cron-based schedule."""

    def should_run(self, current_time: Optional[datetime] = None) -> ScheduleResult:
        """Check if the schedule should trigger."""
        if current_time is None:
            tz = pytz.timezone(self.timezone)
            current_time = datetime.now(tz)

        # Calculate next run if not set
        if self.next_run is None:
            self._calculate_next_run()

        should_trigger = False
        if self.next_run and current_time >= self.next_run:
            should_trigger = True
            self.last_run = current_time
            self._calculate_next_run()

        return ScheduleResult(
            should_trigger=should_trigger,
            next_run=self.next_run,
            metadata={
                "cron_expression": self.cron_expression,
                "timezone": self.timezone,
                "last_run": self.last_run.isoformat() if self.last_run else None
            }
        )


class IntervalSchedule(BaseSchedule):
    """Interval-based schedule (every N minutes/hours/days)."""

    def __init__(self, name: str, pipeline_name: str, interval_minutes: int, timezone: str = 'UTC'):
        # Convert interval to cron expression
        cron_expression = f"*/{interval_minutes} * * * *"
        super().__init__(name, pipeline_name, cron_expression, timezone)
        self.interval_minutes = interval_minutes

    def should_run(self, current_time: Optional[datetime] = None) -> ScheduleResult:
        """Check if the schedule should trigger."""
        result = super().should_run(current_time)
        result.metadata["interval_minutes"] = self.interval_minutes
        return result


class DailySchedule(BaseSchedule):
    """Daily schedule at a specific time."""

    def __init__(self, name: str, pipeline_name: str, hour: int, minute: int = 0, timezone: str = 'UTC'):
        cron_expression = f"{minute} {hour} * * *"
        super().__init__(name, pipeline_name, cron_expression, timezone)
        self.hour = hour
        self.minute = minute

    def should_run(self, current_time: Optional[datetime] = None) -> ScheduleResult:
        """Check if the schedule should trigger."""
        result = super().should_run(current_time)
        result.metadata.update({
            "hour": self.hour,
            "minute": self.minute
        })
        return result


class WeeklySchedule(BaseSchedule):
    """Weekly schedule on specific days at a specific time."""

    def __init__(self, name: str, pipeline_name: str, days_of_week: List[int], hour: int, minute: int = 0, timezone: str = 'UTC'):
        # days_of_week: 0=Monday, 6=Sunday
        dow_str = ','.join(str(d) for d in days_of_week)
        cron_expression = f"{minute} {hour} * * {dow_str}"
        super().__init__(name, pipeline_name, cron_expression, timezone)
        self.days_of_week = days_of_week
        self.hour = hour
        self.minute = minute

    def should_run(self, current_time: Optional[datetime] = None) -> ScheduleResult:
        """Check if the schedule should trigger."""
        result = super().should_run(current_time)
        result.metadata.update({
            "days_of_week": self.days_of_week,
            "hour": self.hour,
            "minute": self.minute
        })
        return result


class ScheduleManager:
    """Manager for eltPulse schedules."""

    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = Path(storage_path or os.path.expanduser("~/.datapulse/schedules.json"))
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.schedules: Dict[str, BaseSchedule] = {}
        self.load_schedules()

    def load_schedules(self):
        """Load schedules from storage."""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    for schedule_data in data.get('schedules', []):
                        try:
                            schedule = self._deserialize_schedule(schedule_data)
                            if schedule:
                                self.schedules[schedule.name] = schedule
                        except Exception as e:
                            print(f"Warning: Failed to load schedule {schedule_data.get('name', 'unknown')}: {e}")
            except Exception as e:
                print(f"Warning: Failed to load schedules file: {e}")

    def save_schedules(self):
        """Save schedules to storage."""
        data = {
            'schedules': [schedule.get_status() for schedule in self.schedules.values()]
        }
        with open(self.storage_path, 'w') as f:
            json.dump(data, f, indent=2)

    def _deserialize_schedule(self, data: Dict[str, Any]) -> Optional[BaseSchedule]:
        """Deserialize a schedule from stored data."""
        schedule_type = data.get('type', '').lower()

        if schedule_type == 'cronschedule':
            schedule = CronSchedule(
                data['name'],
                data['pipeline_name'],
                data['cron_expression'],
                data.get('timezone', 'UTC')
            )
        elif schedule_type == 'intervalschedule':
            # Extract interval from cron expression
            cron_parts = data['cron_expression'].split()
            if len(cron_parts) >= 1 and cron_parts[0].startswith('*/'):
                interval = int(cron_parts[0][2:])
                schedule = IntervalSchedule(
                    data['name'],
                    data['pipeline_name'],
                    interval,
                    data.get('timezone', 'UTC')
                )
            else:
                return None
        elif schedule_type == 'dailyschedule':
            cron_parts = data['cron_expression'].split()
            if len(cron_parts) >= 2:
                minute = int(cron_parts[0])
                hour = int(cron_parts[1])
                schedule = DailySchedule(
                    data['name'],
                    data['pipeline_name'],
                    hour,
                    minute,
                    data.get('timezone', 'UTC')
                )
            else:
                return None
        elif schedule_type == 'weeklyschedule':
            cron_parts = data['cron_expression'].split()
            if len(cron_parts) >= 5:
                minute = int(cron_parts[0])
                hour = int(cron_parts[1])
                days_str = cron_parts[4]
                days_of_week = [int(d) for d in days_str.split(',')]
                schedule = WeeklySchedule(
                    data['name'],
                    data['pipeline_name'],
                    days_of_week,
                    hour,
                    minute,
                    data.get('timezone', 'UTC')
                )
            else:
                return None
        else:
            return None

        # Restore last run time
        if data.get('last_run'):
            try:
                schedule.last_run = datetime.fromisoformat(data['last_run'])
            except:
                pass

        return schedule

    def register_schedule(self, schedule: BaseSchedule):
        """Register a new schedule."""
        self.schedules[schedule.name] = schedule
        self.save_schedules()

    def unregister_schedule(self, name: str):
        """Unregister a schedule."""
        if name in self.schedules:
            del self.schedules[name]
            self.save_schedules()

    def get_schedule_status(self) -> List[Dict[str, Any]]:
        """Get status of all schedules."""
        return [schedule.get_status() for schedule in self.schedules.values()]

    def check_all_schedules(self, current_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """Check all schedules and return triggered ones."""
        triggered = []
        for schedule in self.schedules.values():
            result = schedule.should_run(current_time)
            if result.should_trigger:
                triggered.append({
                    'schedule_name': schedule.name,
                    'pipeline_name': schedule.pipeline_name,
                    'message': f"Scheduled run triggered by {schedule.__class__.__name__}",
                    'metadata': result.metadata,
                    'timestamp': datetime.now().isoformat()
                })

        # Save updated schedule states
        self.save_schedules()

        return triggered


# Global schedule manager instance
schedule_manager = ScheduleManager()


def create_schedule(schedule_type: str, name: str, pipeline_name: str, config: Dict[str, Any]) -> BaseSchedule:
    """Factory function to create schedules."""
    schedule_type = schedule_type.lower()

    if schedule_type == 'cron':
        return CronSchedule(
            name,
            pipeline_name,
            config['cron_expression'],
            config.get('timezone', 'UTC')
        )
    elif schedule_type == 'interval':
        return IntervalSchedule(
            name,
            pipeline_name,
            config['interval_minutes'],
            config.get('timezone', 'UTC')
        )
    elif schedule_type == 'daily':
        return DailySchedule(
            name,
            pipeline_name,
            config['hour'],
            config.get('minute', 0),
            config.get('timezone', 'UTC')
        )
    elif schedule_type == 'weekly':
        return WeeklySchedule(
            name,
            pipeline_name,
            config['days_of_week'],
            config['hour'],
            config.get('minute', 0),
            config.get('timezone', 'UTC')
        )
    else:
        raise ValueError(f"Unknown schedule type: {schedule_type}")