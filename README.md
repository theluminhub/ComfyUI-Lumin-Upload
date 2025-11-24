# Asset Manager Custom Node

A ComfyUI custom node for managing and uploading generated outputs and node metadata to an external API.

> **Note:** This extension requires an account on [https://luminhub.io/](https://luminhub.io/) where you will need to create your API key.

## Features

### Settings Tab
- **API Configuration**: Configure your API connection
  - API Key field with show/hide functionality
  - Organization dropdown (populated from API)
  - Save Settings button to persist configuration

### Main Section
- **Upload Mode**: Switch between automatic and manual upload modes
  - **Automatic**: Uploads are triggered automatically when images are generated
  - **Manual**: Users manually select images from the captured content area
- **Project Selection**: Dropdown to select target project (populated from API)
- **Captured Content**: Visual gallery of all images in the ComfyUI output folder
  - Only active when Upload Mode is set to Manual
  - Click images to select/deselect them for upload
  - Scrollable grid layout for easy browsing

## Installation

1. Copy this folder to your ComfyUI `custom_nodes` directory
2. Restart ComfyUI
3. The "Asset Manager" button will appear in the menu bar

## Usage

1. Click the "Asset Manager" button in the menu bar
2. Go to Settings tab and configure your API credentials
3. In the Main tab, activate the extension and select your upload mode
4. Choose a project from the dropdown
5. If in Manual mode, select images from the Captured Content area
6. Images will be uploaded to your configured API endpoint

## API Integration

The following API endpoints need to be implemented:

- `GET /asset-manager/get_output_images` - Fetch images from ComfyUI output folder
- `POST /asset-manager/upload_assets` - Upload selected assets and metadata
- `GET /asset-manager/get_organizations` - Get list of organizations
- `GET /asset-manager/get_projects` - Get list of projects for selected organization

## Development

This custom node uses:
- **Frontend**: Vanilla JavaScript with ComfyUI's app and api modules
- **Backend**: Python with ComfyUI's extension system
- **Storage**: localStorage for settings persistence

## License

MIT

