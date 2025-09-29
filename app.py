import os
import sys
from dotenv import load_dotenv

from src.core.logging import get_logger
from src.core.options import RuntimeOptions
from src.core.orchestrator import ApplicationOrchestrator
from src.core.providers import SupabaseConfigurationProvider
from src.config.supabase_config_loader import SupabaseConfigLoader
from src.sports.supabase_loader import SupabaseSportsLoader
from supabase import create_client


logger = get_logger(__name__)


def main():
    """Main entry point for the LED Scoreboard application."""
    load_dotenv()  # Load environment variables

    # Parse runtime options
    options = RuntimeOptions.from_args()

    try:
        # Validate options
        options.validate()
    except ValueError as e:
        logger.error(f"Invalid configuration: {e}")
        return 1

    # Log runtime options
    logger.info(options)

    # Initialize Supabase configuration
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    device_id = os.getenv("DEVICE_ID")

    # Initialize configuration provider
    config_provider = None

    if supabase_url and supabase_service_key and device_id:
        try:
            # Create Supabase clients
            anon_client = create_client(supabase_url, supabase_anon_key) if supabase_anon_key else None
            service_client = create_client(supabase_url, supabase_service_key)

            # Initialize sports/leagues registry
            if anon_client:
                sports_loader = SupabaseSportsLoader()
                sports_loader.initialize_registry()
                logger.info("Loaded sports and leagues from Supabase")

            # Create configuration provider
            config_loader = SupabaseConfigLoader(device_id, service_client)
            config_provider = SupabaseConfigurationProvider(config_loader)

            logger.info(f"Initialized configuration for device {device_id}")

        except Exception as e:
            logger.error(f"Failed to initialize Supabase: {e}")
            return 1
    else:
        logger.error("Missing required environment variables for Supabase")
        logger.error("Required: DEVICE_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        return 1

    # Create and run orchestrator
    orchestrator = ApplicationOrchestrator(config_provider, options)
    return orchestrator.run()


if __name__ == "__main__":
    sys.exit(main())
