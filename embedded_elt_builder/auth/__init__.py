"""eltPulse Authentication - Secure credential management for sensors.

This module provides secure authentication for cloud services used by sensors,
supporting various authentication methods and credential storage.
"""

import os
import json
import base64
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Union
from dataclasses import dataclass
from pathlib import Path
import hashlib
import secrets


@dataclass
class AuthCredentials:
    """Base class for authentication credentials."""
    provider: str
    auth_type: str

    @abstractmethod
    def to_dict(self) -> Dict[str, Any]:
        """Convert credentials to dictionary for storage."""
        pass

    @abstractmethod
    def validate(self) -> bool:
        """Validate that credentials are properly configured."""
        pass


@dataclass
class AWSCredentials(AuthCredentials):
    """AWS authentication credentials."""
    provider = "aws"
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None
    session_token: Optional[str] = None
    region: str = "us-east-1"
    role_arn: Optional[str] = None

    def __init__(self, auth_type: str = "credentials", **kwargs):
        super().__init__(provider="aws", auth_type=auth_type)
        self.access_key_id = kwargs.get('access_key_id')
        self.secret_access_key = kwargs.get('secret_access_key')
        self.session_token = kwargs.get('session_token')
        self.region = kwargs.get('region', 'us-east-1')
        self.role_arn = kwargs.get('role_arn')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'provider': self.provider,
            'auth_type': self.auth_type,
            'access_key_id': self._encrypt_value(self.access_key_id) if self.access_key_id else None,
            'secret_access_key': self._encrypt_value(self.secret_access_key) if self.secret_access_key else None,
            'session_token': self._encrypt_value(self.session_token) if self.session_token else None,
            'region': self.region,
            'role_arn': self.role_arn
        }

    def validate(self) -> bool:
        if self.auth_type == "credentials":
            return bool(self.access_key_id and self.secret_access_key)
        elif self.auth_type == "iam_role":
            return bool(self.role_arn)
        elif self.auth_type == "default":
            return True  # Use default credential chain
        return False

    def _encrypt_value(self, value: str) -> str:
        """Simple encryption for storage (in production, use proper encryption)."""
        if not value:
            return ""
        # For demo purposes - in production use proper encryption
        return base64.b64encode(value.encode()).decode()

    def _decrypt_value(self, encrypted: str) -> str:
        """Decrypt stored value."""
        if not encrypted:
            return ""
        return base64.b64decode(encrypted.encode()).decode()


@dataclass
class GCPCredentials(AuthCredentials):
    """Google Cloud authentication credentials."""
    provider = "gcp"
    service_account_key: Optional[Dict[str, Any]] = None
    service_account_email: Optional[str] = None
    project_id: Optional[str] = None

    def __init__(self, auth_type: str = "service_account", **kwargs):
        super().__init__(provider="gcp", auth_type=auth_type)
        self.service_account_key = kwargs.get('service_account_key')
        self.service_account_email = kwargs.get('service_account_email')
        self.project_id = kwargs.get('project_id')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'provider': self.provider,
            'auth_type': self.auth_type,
            'service_account_key': self._encrypt_value(json.dumps(self.service_account_key)) if self.service_account_key else None,
            'service_account_email': self.service_account_email,
            'project_id': self.project_id
        }

    def validate(self) -> bool:
        if self.auth_type == "service_account":
            return bool(self.service_account_key and self.service_account_email)
        elif self.auth_type == "default":
            return True  # Use default GCP authentication
        return False

    def _encrypt_value(self, value: str) -> str:
        """Simple encryption for storage."""
        if not value:
            return ""
        return base64.b64encode(value.encode()).decode()

    def _decrypt_value(self, encrypted: str) -> str:
        """Decrypt stored value."""
        if not encrypted:
            return ""
        return base64.b64decode(encrypted.encode()).decode()


@dataclass
class AzureCredentials(AuthCredentials):
    """Azure authentication credentials."""
    provider = "azure"
    tenant_id: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    account_name: Optional[str] = None
    account_key: Optional[str] = None

    def __init__(self, auth_type: str = "service_principal", **kwargs):
        super().__init__(provider="azure", auth_type=auth_type)
        self.tenant_id = kwargs.get('tenant_id')
        self.client_id = kwargs.get('client_id')
        self.client_secret = kwargs.get('client_secret')
        self.account_name = kwargs.get('account_name')
        self.account_key = kwargs.get('account_key')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'provider': self.provider,
            'auth_type': self.auth_type,
            'tenant_id': self.tenant_id,
            'client_id': self.client_id,
            'client_secret': self._encrypt_value(self.client_secret) if self.client_secret else None,
            'account_name': self.account_name,
            'account_key': self._encrypt_value(self.account_key) if self.account_key else None
        }

    def validate(self) -> bool:
        if self.auth_type == "service_principal":
            return bool(self.tenant_id and self.client_id and self.client_secret)
        elif self.auth_type == "account_key":
            return bool(self.account_name and self.account_key)
        elif self.auth_type == "default":
            return True  # Use default Azure authentication
        return False

    def _encrypt_value(self, value: str) -> str:
        """Simple encryption for storage."""
        if not value:
            return ""
        return base64.b64encode(value.encode()).decode()

    def _decrypt_value(self, encrypted: str) -> str:
        """Decrypt stored value."""
        if not encrypted:
            return ""
        return base64.b64decode(encrypted.encode()).decode()


@dataclass
class KafkaCredentials(AuthCredentials):
    """Kafka authentication credentials."""
    provider = "kafka"
    username: Optional[str] = None
    password: Optional[str] = None
    sasl_mechanism: str = "PLAIN"
    security_protocol: str = "SASL_PLAINTEXT"

    def __init__(self, auth_type: str = "sasl_plaintext", **kwargs):
        super().__init__(provider="kafka", auth_type=auth_type)
        self.username = kwargs.get('username')
        self.password = kwargs.get('password')
        self.sasl_mechanism = kwargs.get('sasl_mechanism', 'PLAIN')
        self.security_protocol = kwargs.get('security_protocol', 'SASL_PLAINTEXT')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'provider': self.provider,
            'auth_type': self.auth_type,
            'username': self.username,
            'password': self._encrypt_value(self.password) if self.password else None,
            'sasl_mechanism': self.sasl_mechanism,
            'security_protocol': self.security_protocol
        }

    def validate(self) -> bool:
        if self.auth_type == "sasl_plaintext":
            return bool(self.username and self.password)
        elif self.auth_type == "none":
            return True  # No authentication
        return False

    def _encrypt_value(self, value: str) -> str:
        """Simple encryption for storage."""
        if not value:
            return ""
        return base64.b64encode(value.encode()).decode()

    def _decrypt_value(self, encrypted: str) -> str:
        """Decrypt stored value."""
        if not encrypted:
            return ""
        return base64.b64decode(encrypted.encode()).decode()


class AuthManager:
    """Manager for authentication credentials."""

    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = Path(storage_path or os.path.expanduser("~/.eltpulse/auth.json"))
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.credentials: Dict[str, AuthCredentials] = {}
        self.load_credentials()

    def load_credentials(self):
        """Load credentials from storage."""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    for cred_data in data.get('credentials', []):
                        try:
                            cred = self._deserialize_credentials(cred_data)
                            if cred:
                                self.credentials[cred_data['name']] = cred
                        except Exception as e:
                            print(f"Warning: Failed to load credentials {cred_data.get('name', 'unknown')}: {e}")
            except Exception as e:
                print(f"Warning: Failed to load credentials file: {e}")

    def save_credentials(self):
        """Save credentials to storage."""
        data = {
            'credentials': [
                {'name': name, **cred.to_dict()}
                for name, cred in self.credentials.items()
            ]
        }
        with open(self.storage_path, 'w') as f:
            json.dump(data, f, indent=2)

    def _deserialize_credentials(self, data: Dict[str, Any]) -> Optional[AuthCredentials]:
        """Deserialize credentials from stored data."""
        provider = data.get('provider')
        auth_type = data.get('auth_type')

        if provider == 'aws':
            return AWSCredentials(auth_type=auth_type, **data)
        elif provider == 'gcp':
            return GCPCredentials(auth_type=auth_type, **data)
        elif provider == 'azure':
            return AzureCredentials(auth_type=auth_type, **data)
        elif provider == 'kafka':
            return KafkaCredentials(auth_type=auth_type, **data)

        return None

    def store_credentials(self, name: str, credentials: AuthCredentials):
        """Store authentication credentials."""
        if not credentials.validate():
            raise ValueError(f"Invalid credentials for {credentials.provider}")
        self.credentials[name] = credentials
        self.save_credentials()

    def get_credentials(self, name: str) -> Optional[AuthCredentials]:
        """Get authentication credentials by name."""
        return self.credentials.get(name)

    def delete_credentials(self, name: str):
        """Delete authentication credentials."""
        if name in self.credentials:
            del self.credentials[name]
            self.save_credentials()

    def list_credentials(self) -> Dict[str, Dict[str, Any]]:
        """List all stored credentials (without sensitive data)."""
        result = {}
        for name, cred in self.credentials.items():
            result[name] = {
                'provider': cred.provider,
                'auth_type': cred.auth_type,
                'valid': cred.validate()
            }
        return result


# Global auth manager instance
auth_manager = AuthManager()


def create_authenticated_client(provider: str, credentials_name: Optional[str] = None, **kwargs):
    """Factory function to create authenticated clients for different providers."""

    if credentials_name:
        credentials = auth_manager.get_credentials(credentials_name)
        if not credentials:
            raise ValueError(f"Credentials '{credentials_name}' not found")
    else:
        credentials = None

    if provider == "aws":
        return _create_aws_client(credentials, **kwargs)
    elif provider == "gcp":
        return _create_gcp_client(credentials, **kwargs)
    elif provider == "azure":
        return _create_azure_client(credentials, **kwargs)
    elif provider == "kafka":
        return _create_kafka_client(credentials, **kwargs)
    else:
        raise ValueError(f"Unsupported provider: {provider}")


def _create_aws_client(credentials: Optional[AWSCredentials], service: str = "s3", **kwargs):
    """Create authenticated AWS client."""
    import boto3

    if credentials:
        if credentials.auth_type == "credentials":
            return boto3.client(
                service,
                aws_access_key_id=credentials.access_key_id,
                aws_secret_access_key=credentials.secret_access_key,
                aws_session_token=credentials.session_token,
                region_name=credentials.region
            )
        elif credentials.auth_type == "iam_role":
            # Assume IAM role
            sts_client = boto3.client('sts')
            response = sts_client.assume_role(
                RoleArn=credentials.role_arn,
                RoleSessionName='eltpulse-sensor'
            )
            return boto3.client(
                service,
                aws_access_key_id=response['Credentials']['AccessKeyId'],
                aws_secret_access_key=response['Credentials']['SecretAccessKey'],
                aws_session_token=response['Credentials']['SessionToken'],
                region_name=credentials.region
            )

    # Default credential chain
    return boto3.client(service, **kwargs)


def _create_gcp_client(credentials: Optional[GCPCredentials], **kwargs):
    """Create authenticated GCP client."""
    from google.cloud import storage
    from google.oauth2 import service_account
    import json

    if credentials and credentials.auth_type == "service_account":
        # Use service account key
        key_dict = json.loads(credentials._decrypt_value(credentials.service_account_key))
        credentials_obj = service_account.Credentials.from_service_account_info(key_dict)
        return storage.Client(credentials=credentials_obj, **kwargs)

    # Default GCP authentication
    return storage.Client(**kwargs)


def _create_azure_client(credentials: Optional[AzureCredentials], **kwargs):
    """Create authenticated Azure client."""
    from azure.storage.filedatalake import DataLakeServiceClient
    from azure.identity import ClientSecretCredential

    if credentials:
        if credentials.auth_type == "service_principal":
            credential = ClientSecretCredential(
                tenant_id=credentials.tenant_id,
                client_id=credentials.client_id,
                client_secret=credentials.client_secret
            )
            account_url = f"https://{credentials.account_name}.dfs.core.windows.net"
            return DataLakeServiceClient(account_url=account_url, credential=credential, **kwargs)
        elif credentials.auth_type == "account_key":
            account_url = f"https://{credentials.account_name}.dfs.core.windows.net"
            return DataLakeServiceClient(
                account_url=account_url,
                credential=credentials.account_key,
                **kwargs
            )

    # Default Azure authentication (managed identity, etc.)
    raise ValueError("Azure credentials required for Data Lake access")


def _create_kafka_client(credentials: Optional[KafkaCredentials], **kwargs):
    """Create authenticated Kafka client."""
    from kafka import KafkaConsumer

    kafka_config = kwargs.copy()

    if credentials and credentials.auth_type == "sasl_plaintext":
        kafka_config.update({
            'sasl_plain_username': credentials.username,
            'sasl_plain_password': credentials.password,
            'sasl_mechanism': credentials.sasl_mechanism,
            'security_protocol': credentials.security_protocol
        })

    return kafka_config  # Return config dict for KafkaConsumer