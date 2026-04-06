"""DataPulse Sensors - Event-driven pipeline orchestration.

This module provides sensors that monitor external systems and trigger pipelines
based on configurable conditions like file counts, data thresholds, etc.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from datetime import datetime
from pathlib import Path
import json
import os

from ..auth import AuthManager, auth_manager


class BaseSensor(ABC):
    """Base class for all DataPulse sensors."""

    def __init__(self, name: str, pipeline_name: str, config: Dict[str, Any]):
        self.name = name
        self.pipeline_name = pipeline_name
        self.config = config
        self.last_check = None
        self.auth_manager = auth_manager  # Global auth manager instance

    @abstractmethod
    def check_condition(self) -> SensorResult:
        """Check if the sensor condition is met."""
        pass

    def get_status(self) -> Dict[str, Any]:
        """Get current sensor status."""
        return {
            "name": self.name,
            "pipeline_name": self.pipeline_name,
            "type": self.__class__.__name__,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "config": self.config
        }


class S3FileCountSensor(BaseSensor):
    """Sensor that monitors S3 bucket for file count thresholds."""

    def __init__(self, name: str, pipeline_name: str, config: Dict[str, Any]):
        super().__init__(name, pipeline_name, config)
        self.bucket_name = config["bucket_name"]
        self.prefix = config.get("prefix", "")
        self.threshold = config["threshold"]
        self.region = config.get("region", "us-east-1")
        self.key_pattern = config.get("key_pattern", ".*")  # Regex pattern for keys
        self.auth_credentials = config.get("auth_credentials")  # Name of stored credentials

    def check_condition(self) -> SensorResult:
        """Check if file count meets threshold."""
        try:
            import re
            from botocore.exceptions import NoCredentialsError, ClientError

            # Get authenticated S3 client
            s3_client = self.auth_manager.get_authenticated_client("aws", self.auth_credentials)

            # List objects with prefix
            paginator = s3_client.get_paginator('list_objects_v2')
            page_iterator = paginator.paginate(Bucket=self.bucket_name, Prefix=self.prefix)

            file_count = 0
            for page in page_iterator:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        # Apply key pattern filter
                        if re.match(self.key_pattern, obj['Key']):
                            file_count += 1

            self.last_check = datetime.now()

            if file_count >= self.threshold:
                return SensorResult(
                    should_trigger=True,
                    metadata={
                        "file_count": file_count,
                        "bucket": self.bucket_name,
                        "prefix": self.prefix,
                        "key_pattern": self.key_pattern,
                        "threshold": self.threshold
                    },
                    message=f"Found {file_count} files (threshold: {self.threshold})"
                )
            else:
                return SensorResult(
                    should_trigger=False,
                    metadata={"file_count": file_count},
                    message=f"Only {file_count} files found (need {self.threshold})"
                )

        except NoCredentialsError:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message="AWS credentials not found"
            )
        except ClientError as e:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message=f"S3 error: {str(e)}"
            )
        except Exception as e:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message=f"Unexpected error: {str(e)}"
            )


class CSVRowCountSensor(BaseSensor):
    """Sensor that monitors CSV files for row count thresholds."""

    def __init__(self, name: str, pipeline_name: str, config: Dict[str, Any]):
        super().__init__(name, pipeline_name, config)
        self.file_path = config["file_path"]
        self.threshold = config["threshold"]
        self.delimiter = config.get("delimiter", ",")
        self.has_header = config.get("has_header", True)

    def check_condition(self) -> SensorResult:
        """Check if CSV row count meets threshold."""
        try:
            import csv
            import os

            if not os.path.exists(self.file_path):
                return SensorResult(
                    should_trigger=False,
                    metadata={},
                    message=f"File not found: {self.file_path}"
                )

            row_count = 0
            with open(self.file_path, 'r', newline='', encoding='utf-8') as f:
                reader = csv.reader(f, delimiter=self.delimiter)
                for row in reader:
                    row_count += 1

            # Subtract header row if present
            if self.has_header and row_count > 0:
                row_count -= 1

            self.last_check = datetime.now()

            if row_count >= self.threshold:
                return SensorResult(
                    should_trigger=True,
                    metadata={
                        "row_count": row_count,
                        "file_path": self.file_path,
                        "threshold": self.threshold,
                        "has_header": self.has_header
                    },
                    message=f"Found {row_count} rows (threshold: {self.threshold})"
                )
            else:
                return SensorResult(
                    should_trigger=False,
                    metadata={"row_count": row_count},
                    message=f"Only {row_count} rows found (need {self.threshold})"
                )

        except Exception as e:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message=f"Error reading CSV: {str(e)}"
            )


class GCSFileCountSensor(BaseSensor):
    """Sensor that monitors Google Cloud Storage bucket for file count thresholds."""

    def __init__(self, name: str, pipeline_name: str, config: Dict[str, Any]):
        super().__init__(name, pipeline_name, config)
        self.bucket_name = config["bucket_name"]
        self.prefix = config.get("prefix", "")
        self.threshold = config["threshold"]
        self.blob_pattern = config.get("blob_pattern", ".*")  # Regex pattern for blobs
        self.auth_credentials = config.get("auth_credentials")  # Name of stored credentials

    def check_condition(self) -> SensorResult:
        """Check if file count meets threshold."""
        try:
            import re

            # Get authenticated GCS client
            client = self.auth_manager.get_authenticated_client("gcp", self.auth_credentials)
            bucket = client.bucket(self.bucket_name)

            # List blobs with prefix
            blobs = bucket.list_blobs(prefix=self.prefix)
            file_count = 0

            for blob in blobs:
                # Apply blob pattern filter
                if re.match(self.blob_pattern, blob.name):
                    file_count += 1

            self.last_check = datetime.now()

            if file_count >= self.threshold:
                return SensorResult(
                    should_trigger=True,
                    metadata={
                        "file_count": file_count,
                        "bucket": self.bucket_name,
                        "prefix": self.prefix,
                        "blob_pattern": self.blob_pattern,
                        "threshold": self.threshold
                    },
                    message=f"Found {file_count} files (threshold: {self.threshold})"
                )
            else:
                return SensorResult(
                    should_trigger=False,
                    metadata={"file_count": file_count},
                    message=f"Only {file_count} files found (need {self.threshold})"
                )

        except Exception as e:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message=f"GCS error: {str(e)}"
            )


class ADLSFileCountSensor(BaseSensor):
    """Sensor that monitors Azure Data Lake Storage for file count thresholds."""

    def __init__(self, name: str, pipeline_name: str, config: Dict[str, Any]):
        super().__init__(name, pipeline_name, config)
        self.account_name = config["account_name"]
        self.container_name = config["container_name"]
        self.directory_path = config.get("directory_path", "")
        self.threshold = config["threshold"]
        self.file_pattern = config.get("file_pattern", ".*")  # Regex pattern for files
        self.auth_credentials = config.get("auth_credentials")  # Name of stored credentials

    def check_condition(self) -> SensorResult:
        """Check if file count meets threshold."""
        try:
            import re

            # Get authenticated ADLS client
            service_client = self.auth_manager.get_authenticated_client("azure", self.auth_credentials)

            file_system_client = service_client.get_file_system_client(self.container_name)
            paths = file_system_client.get_paths(path=self.directory_path)

            file_count = 0
            for path in paths:
                if not path.is_directory:
                    # Apply file pattern filter
                    if re.match(self.file_pattern, path.name):
                        file_count += 1

            self.last_check = datetime.now()

            if file_count >= self.threshold:
                return SensorResult(
                    should_trigger=True,
                    metadata={
                        "file_count": file_count,
                        "account": self.account_name,
                        "container": self.container_name,
                        "directory_path": self.directory_path,
                        "file_pattern": self.file_pattern,
                        "threshold": self.threshold
                    },
                    message=f"Found {file_count} files (threshold: {self.threshold})"
                )
            else:
                return SensorResult(
                    should_trigger=False,
                    metadata={"file_count": file_count},
                    message=f"Only {file_count} files found (need {self.threshold})"
                )

        except Exception as e:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message=f"ADLS error: {str(e)}"
            )


class KafkaMessageCountSensor(BaseSensor):
    """Sensor that monitors Kafka topic for message count thresholds."""

    def __init__(self, name: str, pipeline_name: str, config: Dict[str, Any]):
        super().__init__(name, pipeline_name, config)
        self.bootstrap_servers = config["bootstrap_servers"]
        self.topic = config["topic"]
        self.threshold = config["threshold"]
        self.group_id = config.get("group_id", f"datapulse-sensor-{name}")
        self.auto_offset_reset = config.get("auto_offset_reset", "earliest")
        self.auth_credentials = config.get("auth_credentials")  # Name of stored credentials

    def check_condition(self) -> SensorResult:
        """Check if message count meets threshold."""
        try:
            from kafka import KafkaConsumer, TopicPartition
            from kafka.errors import KafkaError

            # Get authenticated Kafka consumer
            consumer = self.auth_manager.get_authenticated_client("kafka", self.auth_credentials)

            # Get current positions
            partitions = consumer.partitions_for_topic(self.topic)
            if not partitions:
                consumer.close()
                return SensorResult(
                    should_trigger=False,
                    metadata={},
                    message=f"Topic {self.topic} not found or has no partitions"
                )

            total_messages = 0
            for partition in partitions:
                tp = TopicPartition(self.topic, partition)
                consumer.assign([tp])

                # Get beginning and end offsets
                beginning_offsets = consumer.beginning_offsets([tp])
                end_offsets = consumer.end_offsets([tp])

                beginning = beginning_offsets[tp]
                end = end_offsets[tp]
                total_messages += (end - beginning)

            consumer.close()
            self.last_check = datetime.now()

            if total_messages >= self.threshold:
                return SensorResult(
                    should_trigger=True,
                    metadata={
                        "message_count": total_messages,
                        "topic": self.topic,
                        "bootstrap_servers": self.bootstrap_servers,
                        "partitions": len(partitions),
                        "threshold": self.threshold
                    },
                    message=f"Found {total_messages} messages (threshold: {self.threshold})"
                )
            else:
                return SensorResult(
                    should_trigger=False,
                    metadata={"message_count": total_messages},
                    message=f"Only {total_messages} messages found (need {self.threshold})"
                )

        except ImportError:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message="kafka-python not installed"
            )
        except Exception as e:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message=f"Kafka error: {str(e)}"
            )


class SQSMessageCountSensor(BaseSensor):
    """Sensor that monitors SQS queue for message count thresholds."""

    def __init__(self, name: str, pipeline_name: str, config: Dict[str, Any]):
        super().__init__(name, pipeline_name, config)
        self.queue_url = config["queue_url"]
        self.threshold = config["threshold"]
        self.region = config.get("region", "us-east-1")
        self.max_messages_per_poll = config.get("max_messages_per_poll", 10)
        self.auth_credentials = config.get("auth_credentials")  # Name of stored credentials

    def check_condition(self) -> SensorResult:
        """Check if message count meets threshold."""
        try:
            from botocore.exceptions import NoCredentialsError, ClientError

            # Get authenticated SQS client
            sqs_client = self.auth_manager.get_authenticated_client("aws", self.auth_credentials)

            # Get queue attributes
            response = sqs_client.get_queue_attributes(
                QueueUrl=self.queue_url,
                AttributeNames=['ApproximateNumberOfMessages']
            )

            message_count = int(response['Attributes']['ApproximateNumberOfMessages'])

            self.last_check = datetime.now()

            if message_count >= self.threshold:
                return SensorResult(
                    should_trigger=True,
                    metadata={
                        "message_count": message_count,
                        "queue_url": self.queue_url,
                        "threshold": self.threshold
                    },
                    message=f"Found {message_count} messages (threshold: {self.threshold})"
                )
            else:
                return SensorResult(
                    should_trigger=False,
                    metadata={"message_count": message_count},
                    message=f"Only {message_count} messages found (need {self.threshold})"
                )

        except NoCredentialsError:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message="AWS credentials not found"
            )
        except ClientError as e:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message=f"SQS error: {str(e)}"
            )
        except Exception as e:
            return SensorResult(
                should_trigger=False,
                metadata={},
                message=f"Unexpected error: {str(e)}"
            )


def create_sensor(sensor_type: str, name: str, pipeline_name: str, config: Dict[str, Any]) -> BaseSensor:
    """Factory function to create sensors."""
    if sensor_type == "s3_file_count":
        return S3FileCountSensor(name, pipeline_name, config)
    elif sensor_type == "gcs_file_count":
        return GCSFileCountSensor(name, pipeline_name, config)
    elif sensor_type == "adls_file_count":
        return ADLSFileCountSensor(name, pipeline_name, config)
    elif sensor_type == "csv_row_count":
        return CSVRowCountSensor(name, pipeline_name, config)
    elif sensor_type == "kafka_message_count":
        return KafkaMessageCountSensor(name, pipeline_name, config)
    elif sensor_type == "sqs_message_count":
        return SQSMessageCountSensor(name, pipeline_name, config)
    else:
        raise ValueError(f"Unknown sensor type: {sensor_type}")


class SensorManager:
    """Manages all sensors and their execution."""

    def __init__(self):
        self.sensors: Dict[str, BaseSensor] = {}
        self.results_file = Path.home() / ".datapulse" / "sensors.json"
        self.config_file = Path.home() / ".datapulse" / "sensors_config.json"
        self.results_file.parent.mkdir(parents=True, exist_ok=True)
        self._load_sensors()

    def _load_sensors(self):
        """Load sensors from config file."""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    configs = json.load(f)

                for config in configs:
                    try:
                        sensor = create_sensor(
                            config["type"],
                            config["name"],
                            config["pipeline_name"],
                            config["config"]
                        )
                        self.sensors[sensor.name] = sensor
                    except Exception as e:
                        print(f"Warning: Failed to load sensor {config.get('name', 'unknown')}: {e}")

            except Exception as e:
                print(f"Warning: Failed to load sensor config: {e}")

    def register_sensor(self, sensor: BaseSensor):
        """Register a sensor."""
        self.sensors[sensor.name] = sensor
        self._save_config()

    def unregister_sensor(self, name: str):
        """Unregister a sensor."""
        if name in self.sensors:
            del self.sensors[name]
            self._save_config()

    def _save_config(self):
        """Save current sensor configurations to file."""
        # Map class names to type strings
        type_mapping = {
            "s3filecount": "s3_file_count",
            "csvrowcount": "csv_row_count",
        }

        configs = []
        for sensor in self.sensors.values():
            class_name = sensor.__class__.__name__.replace('Sensor', '').lower()
            sensor_type = type_mapping.get(class_name, class_name)

            configs.append({
                "name": sensor.name,
                "pipeline_name": sensor.pipeline_name,
                "type": sensor_type,
                "config": sensor.config
            })

        try:
            with open(self.config_file, 'w') as f:
                json.dump(configs, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save sensor config: {e}")

    def check_all_sensors(self) -> List[Dict[str, Any]]:
        """Check all sensors and return results."""
        results = []
        for sensor in self.sensors.values():
            result = sensor.check_condition()
            if result.should_trigger:
                results.append({
                    "sensor_name": sensor.name,
                    "pipeline_name": sensor.pipeline_name,
                    "triggered": True,
                    "metadata": result.metadata,
                    "message": result.message,
                    "timestamp": datetime.now().isoformat()
                })

        # Save results
        self._save_results(results)
        return results

    def get_sensor_status(self) -> List[Dict[str, Any]]:
        """Get status of all sensors."""
        return [sensor.get_status() for sensor in self.sensors.values()]

    def _save_results(self, results: List[Dict[str, Any]]):
        """Save sensor results to file."""
        try:
            existing = []
            if self.results_file.exists():
                with open(self.results_file, 'r') as f:
                    existing = json.load(f)

            existing.extend(results)

            # Keep only last 1000 results
            if len(existing) > 1000:
                existing = existing[-1000:]

            with open(self.results_file, 'w') as f:
                json.dump(existing, f, indent=2)

        except Exception as e:
            print(f"Warning: Could not save sensor results: {e}")


# Global sensor manager instance
sensor_manager = SensorManager()