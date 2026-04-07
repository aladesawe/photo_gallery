# Photo Gallery

A React photo gallery application with an Azure Functions backend under `api/`.

## Local development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Open http://localhost:3000 to view the app.

## Testing

Run the test suite:

```bash
npm test
```

## Build

Create a production build:

```bash
npm run build
```

The optimized output will be placed in the `build/` directory.

## Azure deployment

This repository includes Azure Functions in the `api/` folder. The provided deployment script targets Azure Static Web Apps.

### Prerequisites

- Azure CLI installed and authenticated (`az login`)
- A resource group and Azure region
- A GitHub repository for full Static Web Apps workflow support
- Cosmos DB environment values configured in Azure for the function backend

### Local environment files

Copy `.env.example` to `.env` and replace the placeholder values with your own settings for local development.

For local Azure Functions development, copy `api/local.settings.json.example` to `api/local.settings.json` and set the Cosmos values there.

### Run Azure Functions locally

Install the Azure Functions Core Tools if you do not already have them:

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

Start the local functions host from the repo root:

```bash
cd api
func start
```

Then open the application at http://localhost:3000 and call function endpoints with http://localhost:7071/api/<function-name>.

### Deploy with the script

Set the required environment variables and run the script:

```bash
AZURE_STATIC_WEBAPP_NAME=<your-app-name> \
AZURE_RESOURCE_GROUP=<your-resource-group> \
AZURE_LOCATION=<azure-region> \
./deploy-azure.sh
```

Or use the npm shortcut:

```bash
AZURE_STATIC_WEBAPP_NAME=<your-app-name> \
AZURE_RESOURCE_GROUP=<your-resource-group> \
AZURE_LOCATION=<azure-region> \
npm run azure:deploy
```

### Notes

- The deployment script builds the React app and deploys it to Azure Static Web Apps.
- The backend functions in `api/` use the following environment variables: `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE`, and `COSMOS_CONTAINER`.

## Project structure

- `src/` — React application source
- `public/` — static public assets
- `api/` — Azure Functions backend
- `build/` — production build output

## Useful commands

- `npm start` — run the app locally
- `npm run build` — create a production build
- `npm test` — run tests
- `npm run azure:deploy` — launch Azure deployment script
