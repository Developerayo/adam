# Adam CLI

[![npm version](https://badge.fury.io/js/adam-ai.svg)](https://badge.fury.io/js/adam-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Adam CLI is a command-line interface (CLI) tool designed to assist developers by generating and executing commands using AI models like OpenAI and Google Gemini. It can analyze the current working directory, understand the project structure, and provide context-aware command suggestions.

## System Requirements

```sh
- Node.js >= 16.x
- npm >= 8.x
- OpenAI API key and/or Google Gemini API key
```

## Features

- **AI Models**: Seamlessly choose between OpenAI and Google Gemini for generating commands.
- **Project Analysis**: In-dept understanding of the current working directory for the project structure and dependencies.
- **Git Integration**: Understands git status and can generate git commands.
- **Configuration**: Easily configure API keys and defaults.
- **Dependency Management**: Scans and reports project dependencies.
- **Voice Commands**: Voice input support powered by whisper [Beta]
- **OS Support**: Works fine on Unix-based systems and Windows.

## Roadmap

- **Voice Commands**: Use voice input for commands via AssemblyAI, additionally to whisper.
- **Error Insights**: Understand previous shell error messages without leaving your terminal.

## Installation

1. Install Adam globally using NPM:

   ```sh
   npm install -g adam-ai
   ```

2. Call Adam:

   ```sh
   adam
   ```

## Usage

### Basic Commands

- **Show Help**:

  ```sh
  adam --help
  ```

- **Show Version**:

  ```sh
  adam --version
  ```

### Configuration Commands

- **Configure API keys and defaults**:

  ```sh
  adam config
  ```

- **Open config file in your default editor**:

  ```sh
  adam open-config
  ```

- **Show current configuration in shell**:

  ```sh
  adam show-config
  ```

### AI Model Commands

- **Force using OpenAI for the next command**:

  ```sh
  adam openai <your-command>
  ```

- **Force using Gemini for the next command**:

  ```sh
  adam gemini <your-command>
  ```

### Debug Mode

Run any command with `DEBUG=true` to see details on what's happening:

```sh
DEBUG=true adam "install express"
```

### Examples

- **Create a new React project**:

  ```sh
  adam create a new react project called project-57 with typescript, tailwind, and chakra ui, then install @chakra-ui/react @emotion/react @emotion/styled framer-motion and configure tailwind.
  ```

- **Commit all current changes using OpenAI specifically**:

> This generates a commit message using OpenAI from your git status/diff.

```sh
adam openai commit all current changes
```

- **Install pymongo using Gemini specifcally**:

  ```sh
  adam gemini install pymongo
  ```

## Configuration Schema

Adam configurations are stored in `~/.adam-cli.json`:

```json
{
  {
  "openaiApiKey": "sk-GbKnOWMMEA",
  "assemblyaiApiKey": "8835d6",
  "defaultPromptMethod": "text",
  "enableVoiceDetection": true,
  "geminiApiKey": "AIzywY",
  "defaultModel": "openai",
  "userName": "Ayo",
  }
}
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make your changes.
4. Commit your changes (`git commit -m 'Add some feature'`).
5. Push to the branch (`git push origin feature-branch`).
6. Open a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Authors

- **Shodipo Ayomide** - [@developerayo](https://x.com/developerayo)

## Contributors

- **Emeka Orji** - [@thecoderabbi](https://x.com/thecoderabbi)

## Acknowledgments

- Special thanks to all contributors and the open-source community.
