"""
Simple dependency injection container for managing service instances.
"""

from typing import Dict, Type, Any, Optional, Callable
from src.core.logging import get_logger


logger = get_logger(__name__)


class ServiceContainer:
    """
    Simple dependency injection container for managing services.
    """

    def __init__(self):
        """Initialize the service container."""
        self._services: Dict[Type, Any] = {}
        self._factories: Dict[Type, Callable] = {}
        self._singletons: Dict[Type, Any] = {}

    def register(self, interface: Type, implementation: Any, singleton: bool = True) -> None:
        """
        Register a service implementation.

        Args:
            interface: The interface/base class
            implementation: The concrete implementation or instance
            singleton: Whether to treat as singleton (default True)
        """
        if singleton:
            self._singletons[interface] = implementation
            logger.debug(f"Registered singleton: {interface.__name__} -> {implementation.__class__.__name__}")
        else:
            self._services[interface] = implementation
            logger.debug(f"Registered service: {interface.__name__} -> {implementation.__class__.__name__}")

    def register_factory(self, interface: Type, factory: Callable) -> None:
        """
        Register a factory function for creating service instances.

        Args:
            interface: The interface/base class
            factory: Factory function that returns an instance
        """
        self._factories[interface] = factory
        logger.debug(f"Registered factory for: {interface.__name__}")

    def resolve(self, interface: Type) -> Any:
        """
        Resolve a service by its interface.

        Args:
            interface: The interface/base class to resolve

        Returns:
            The service instance

        Raises:
            ValueError: If service is not registered
        """
        # Check singletons first
        if interface in self._singletons:
            return self._singletons[interface]

        # Check factories
        if interface in self._factories:
            instance = self._factories[interface]()
            # Cache if it's supposed to be a singleton
            if interface not in self._services:
                self._singletons[interface] = instance
            return instance

        # Check regular services
        if interface in self._services:
            return self._services[interface]

        raise ValueError(f"No service registered for {interface.__name__}")

    def resolve_optional(self, interface: Type) -> Optional[Any]:
        """
        Try to resolve a service, returning None if not found.

        Args:
            interface: The interface/base class to resolve

        Returns:
            The service instance or None
        """
        try:
            return self.resolve(interface)
        except ValueError:
            return None

    def has(self, interface: Type) -> bool:
        """
        Check if a service is registered.

        Args:
            interface: The interface/base class to check

        Returns:
            True if registered, False otherwise
        """
        return (
            interface in self._singletons or
            interface in self._services or
            interface in self._factories
        )

    def clear(self) -> None:
        """Clear all registered services."""
        self._services.clear()
        self._factories.clear()
        self._singletons.clear()
        logger.debug("Cleared all services")


# Global container instance
_container = ServiceContainer()


def get_container() -> ServiceContainer:
    """
    Get the global service container instance.

    Returns:
        The global ServiceContainer instance
    """
    return _container


def register(interface: Type, implementation: Any, singleton: bool = True) -> None:
    """
    Convenience function to register a service in the global container.

    Args:
        interface: The interface/base class
        implementation: The concrete implementation or instance
        singleton: Whether to treat as singleton (default True)
    """
    _container.register(interface, implementation, singleton)


def register_factory(interface: Type, factory: Callable) -> None:
    """
    Convenience function to register a factory in the global container.

    Args:
        interface: The interface/base class
        factory: Factory function that returns an instance
    """
    _container.register_factory(interface, factory)


def resolve(interface: Type) -> Any:
    """
    Convenience function to resolve a service from the global container.

    Args:
        interface: The interface/base class to resolve

    Returns:
        The service instance
    """
    return _container.resolve(interface)