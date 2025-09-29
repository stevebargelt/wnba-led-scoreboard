"""Unit tests for the ServiceContainer dependency injection system."""

import unittest
from src.core.container import ServiceContainer, get_container, register, resolve


class DummyInterface:
    """Test interface."""
    pass


class DummyImplementation(DummyInterface):
    """Test implementation."""
    def __init__(self, value=None):
        self.value = value


class AnotherInterface:
    """Another test interface."""
    pass


class AnotherImplementation(AnotherInterface):
    """Another test implementation."""
    pass


class TestServiceContainer(unittest.TestCase):
    """Test cases for ServiceContainer."""

    def setUp(self):
        """Set up test fixtures."""
        self.container = ServiceContainer()

    def test_register_and_resolve_singleton(self):
        """Test registering and resolving a singleton service."""
        instance = DummyImplementation("test_value")
        self.container.register(DummyInterface, instance, singleton=True)

        resolved = self.container.resolve(DummyInterface)
        self.assertIs(resolved, instance)
        self.assertEqual(resolved.value, "test_value")

        # Should return same instance
        resolved2 = self.container.resolve(DummyInterface)
        self.assertIs(resolved2, instance)

    def test_register_and_resolve_non_singleton(self):
        """Test registering and resolving a non-singleton service."""
        instance = DummyImplementation("test_value")
        self.container.register(DummyInterface, instance, singleton=False)

        resolved = self.container.resolve(DummyInterface)
        self.assertEqual(resolved.value, "test_value")

    def test_register_factory(self):
        """Test registering and resolving via factory function."""
        call_count = 0

        def factory():
            nonlocal call_count
            call_count += 1
            return DummyImplementation(f"factory_{call_count}")

        self.container.register_factory(DummyInterface, factory)

        resolved1 = self.container.resolve(DummyInterface)
        self.assertEqual(resolved1.value, "factory_1")

        # Factory should be called only once for singleton behavior
        resolved2 = self.container.resolve(DummyInterface)
        self.assertIs(resolved2, resolved1)
        self.assertEqual(call_count, 1)

    def test_resolve_unregistered_raises(self):
        """Test that resolving unregistered service raises ValueError."""
        with self.assertRaises(ValueError) as context:
            self.container.resolve(DummyInterface)

        self.assertIn("No service registered for DummyInterface", str(context.exception))

    def test_resolve_optional(self):
        """Test optional resolution returns None for unregistered services."""
        result = self.container.resolve_optional(DummyInterface)
        self.assertIsNone(result)

        # Register and try again
        instance = DummyImplementation()
        self.container.register(DummyInterface, instance)

        result = self.container.resolve_optional(DummyInterface)
        self.assertIs(result, instance)

    def test_has_service(self):
        """Test checking if service is registered."""
        self.assertFalse(self.container.has(DummyInterface))

        self.container.register(DummyInterface, DummyImplementation())
        self.assertTrue(self.container.has(DummyInterface))

    def test_clear(self):
        """Test clearing all services."""
        self.container.register(DummyInterface, DummyImplementation())
        self.container.register(AnotherInterface, AnotherImplementation())

        self.assertTrue(self.container.has(DummyInterface))
        self.assertTrue(self.container.has(AnotherInterface))

        self.container.clear()

        self.assertFalse(self.container.has(DummyInterface))
        self.assertFalse(self.container.has(AnotherInterface))

    def test_multiple_registrations(self):
        """Test registering multiple different services."""
        dummy = DummyImplementation("dummy")
        another = AnotherImplementation()

        self.container.register(DummyInterface, dummy)
        self.container.register(AnotherInterface, another)

        resolved_dummy = self.container.resolve(DummyInterface)
        resolved_another = self.container.resolve(AnotherInterface)

        self.assertIs(resolved_dummy, dummy)
        self.assertIs(resolved_another, another)

    def test_global_container(self):
        """Test global container functions."""
        # Clear global container first
        get_container().clear()

        instance = DummyImplementation("global")
        register(DummyInterface, instance)

        resolved = resolve(DummyInterface)
        self.assertEqual(resolved.value, "global")

        # Clean up
        get_container().clear()


if __name__ == '__main__':
    unittest.main()