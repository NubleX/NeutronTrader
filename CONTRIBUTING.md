# Contributing to NeutronTrader

First off, thank you for considering contributing to NeutronTrader! It's people like you that make this project such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct, which is to be respectful, open-minded, and collaborative.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

**Before Submitting A Bug Report:**

- Check the [issues](https://github.com/yourusername/NeutronTrader/issues) to see if the bug has already been reported
- Make sure you're using the latest version
- Check if the bug persists in different environments (OS, Node.js version, etc.)

**How to Submit A Good Bug Report:**

- Use a clear and descriptive title
- Describe the exact steps to reproduce the problem
- Provide specific examples (e.g., API keys with permissions removed)
- Describe the behavior you observed after following the steps
- Explain which behavior you expected to see instead and why
- Include screenshots if possible
- Include details about your environment:
  - OS and version
  - Node.js version
  - Electron version
  - Any relevant system information

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Create an issue and provide the following information:

- Use a clear and descriptive title
- Provide a detailed description of the suggested enhancement
- Explain why this enhancement would be useful to most NeutronTrader users
- List some other applications where this enhancement exists, if applicable
- Include mock-ups if possible

### Your First Code Contribution

Unsure where to begin contributing? Look for issues labeled with `good first issue` which are specifically designed for new contributors.

**Setting up the development environment:**

1. Fork the repository

2. Clone your fork:

   ```bash
   git clone https://github.com/your-username/NeutronTrader.git
   ```

3. Install dependencies:

   ```bash
   cd NeutronTrader
   npm install
   ```

4. Create a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

5. Start the application:

   ```bash
   npm start
   ```

### Pull Requests

The process described here has several goals:

- Maintain quality
- Fix problems that are important to users
- Engage the community
- Enable a sustainable system for maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. Follow all instructions in the PR template
2. Follow the coding standards (described below)
3. After you submit your pull request, verify that all status checks are passing
4. If a status check fails and it's not related to your change, comment on the pull request and ask for help

While the prerequisites above must be satisfied prior to having your pull request reviewed, the reviewer(s) may ask you to complete additional design work, tests, or other changes before your pull request can be ultimately accepted.

## Coding Standards

### JavaScript Style Guide

- Use ES6 syntax when possible
- Use camelCase for variable and function names
- Use PascalCase for component names
- Use meaningful variable names

### React Guidelines

- Use functional components with hooks over class components
- Keep components small and focused on a single responsibility
- Use PropTypes for type checking
- Follow the React folder structure in the project

### CSS Guidelines

- Use the existing CSS class naming conventions
- Avoid inline styles
- Use the color variables defined in the project

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://reactjs.org/docs/getting-started.html)
- [Binance API Documentation](https://binance-docs.github.io/apidocs/)

Thank you for contributing to NeutronTrader!
