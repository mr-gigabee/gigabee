# gigabee-cli

Command-line interface for the [Gigabee](https://gigabee.app) decentralized AI inference network.  
Features a live ASCII dashboard, interactive chat, and credit balance management.

## Install

```bash
npm install -g gigabee-cli
# or
pnpm add -g gigabee-cli
```

## Commands

```
gigabee                     Live ASCII network dashboard (default)
gigabee dashboard           Same as above
gigabee chat                Interactive chat with Bee
gigabee stats               Print network stats and exit
gigabee balance             Show your credit balance
gigabee packages            List available credit packages
gigabee config set-token    Save your API token
gigabee config set-url      Set a custom API URL
gigabee config show         Show current configuration
```

## Authentication

Get your API token from [gigabee.app](https://gigabee.app), then:

```bash
gigabee config set-token gbk_yourtoken
```

Or set the `GIGABEE_TOKEN` environment variable:

```bash
export GIGABEE_TOKEN=gbk_yourtoken
gigabee chat
```

## Dashboard

Running `gigabee` (or `gigabee dashboard`) opens a live ASCII dashboard that refreshes every 5 seconds:

```
  ██████╗ ██╗ ██████╗  █████╗ ██████╗ ███████╗███████╗
 ██╔════╝ ██║██╔════╝ ██╔══██╗██╔══██╗██╔════╝██╔════╝
 ██║  ███╗██║██║  ███╗███████║██████╔╝█████╗  █████╗  
 ██║   ██║██║██║   ██║██╔══██║██╔══██╗██╔══╝  ██╔══╝  
 ╚██████╔╝██║╚██████╔╝██║  ██║██████╔╝███████╗███████╗
  ╚═════╝ ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝

╔════════════════════════════════════════════════════════════╗
║  WORKERS LIVE   JOBS / HOUR   TOKENS (TOTAL)   HONEY PAID  ║
║       3              12           1,024,000       $10.24   ║
╠════════════════════════════════════════════════════════════╣
║  ● LIVE  ·  Updated 12:00:00  ·  Ctrl+C to exit            ║
╚════════════════════════════════════════════════════════════╝
```

## Chat

```bash
gigabee chat              # default model (bee-hover)
gigabee chat -m bee-glide # use a specific model
```

In-chat commands: `/clear` to reset context, `/exit` to quit.

## Configuration

Config is stored at `~/.config/gigabee/config.json`.  
Environment variables (`GIGABEE_TOKEN`, `GIGABEE_API_URL`) override the config file.

## License

MIT
