from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

WEB_DIRECTORY = "./web"

try:
    from server import PromptServer
    from . import api_routes

    server = PromptServer.instance
    api_routes.register_routes(server)
except Exception as e:
    print(f"Warning: Could not register Asset Manager API routes: {e}")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
