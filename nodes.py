import os


class AssetManagerNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},  # No inputs needed
        }

    RETURN_TYPES = ()  # No outputs needed
    FUNCTION = "process"
    CATEGORY = "custom"

    def process(self):
        return ()

    @classmethod
    def IS_CHANGED(cls, *args, **kwargs):
        return float("nan")

    @classmethod
    def WEB_DIRECTORY(cls):
        return os.path.join(os.path.dirname(os.path.realpath(__file__)), "web")


NODE_CLASS_MAPPINGS = {
    "AssetManagerNode": AssetManagerNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AssetManagerNode": "Asset Manager",
}
