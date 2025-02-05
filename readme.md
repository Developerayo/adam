# Adam CLI

Adam CLI is a command-line interface (CLI) tool designed to assist developers by generating and executing commands using AI models like OpenAI and Google Gemini. It can analyze the current working directory, understand the project structure, and provide context-aware command suggestions.

## Features

- **Configuration**: Easily configure API keys and defaults.
- **AI Models**: Choose between OpenAI and Google Gemini for generating commands.
- **Project Analysis**: Analyze the current working directory to understand the project structure and dependencies.
- **Git Integration**: Understands git status and can generate git commands.
- **Dependency Management**: Scans and reports project dependencies.
- **Documentation Generation**: Generate project documentation in README and update existing documentation.

## Coming Soons

- **Voice Commands**: Use voice input for commands via AssemblyAI.
- **Chat Completions**: Use Adam as your default chatbot. Suitable for heavy terminal users.
- **Error Insights**: Undersand previous shell error messages.

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

- **Show current configuration**:
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

### Examples

- **Create a new React component**:
  ```sh
  adam "create a new react component"
  ```

- **Commit all current changes using OpenAI**:
  ```sh
  adam openai commit all current changes
  ```

- **Install pymongo using Gemini**:
  ```sh
  adam gemini install pymongo
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
