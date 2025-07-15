# Development Guidelines

This document contains critical information about working with the valorant-tournament-bot codebase. Follow these guidelines precisely.

## Core Development Rules

### 1. Package Management
   - **ONLY use pnpm**, NEVER npm or yarn
   - Installation: `pnpm add package`
   - Dev dependencies: `pnpm add -D package`
   - Running scripts: `pnpm run script`
   - Upgrading: `pnpm update package`
   - FORBIDDEN: `npm install`, `yarn add`

### 2. Code Quality
   - TypeScript strict mode enabled
   - All functions must have proper type annotations
   - Public APIs must have JSDoc comments
   - Functions should be small and focused
   - Follow existing patterns exactly
   - Line length: 100 chars maximum
   - Use async/await over callbacks
   - Prefer const over let

### 3. Discord.js Best Practices
   - Use slash commands only (no message commands)
   - Always use CommandInteraction types
   - Handle errors with proper Discord replies
   - Use ephemeral messages for errors
   - Implement proper permission checks

## Testing Requirements
   - Framework: `pnpm test` (when implemented)
   - Test all command handlers
   - Mock Discord.js interactions
   - Coverage: edge cases and error handling
   - New features require tests
   - Bug fixes require regression tests

## Git Commit Guidelines

### Commit Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process/auxiliary tool changes

### Examples
```bash
git commit -m "feat(commands): add tournament create command"
git commit -m "fix(match): correct score validation logic"
git commit -m "docs: update deployment instructions"
```

### Trailers
- For user-reported bugs:
  ```bash
  git commit --trailer "Reported-by:<discord-username>"
  ```
- For GitHub issues:
  ```bash
  git commit --trailer "Fixes:#<issue-number>"
  ```

## Code Formatting

### 1. ESLint
   - Check: `pnpm run lint`
   - Fix: `pnpm run lint:fix`
   - Note: Add `"type": "module"` to package.json to eliminate ESLint warning
   - Critical rules:
     - Semicolons required
     - Single quotes for strings
     - 2-space indentation
     - No console.log in production

### 2. TypeScript
   - Build: `pnpm run build`
   - Type check: `npx tsc --noEmit`
   - Requirements:
     - Strict mode enabled
     - No implicit any
     - Explicit return types
     - Null/undefined checks

### 3. Prettier (if added)
   - Format: `pnpm run format`
   - Check: `pnpm run format:check`

## Project Structure
```
src/
├── commands/       # Discord slash commands
│   ├── ping.ts     # Basic ping command
│   ├── player.ts   # Player authentication commands
│   ├── team.ts     # Team management commands
│   ├── match.ts    # Match result reporting
│   └── tournament.ts # Tournament management commands
├── services/       # Business logic services
│   ├── dataService.ts # JSON file persistence
│   ├── tournamentService.ts # Tournament operations
│   ├── matchService.ts # Match result validation
│   └── riotApiService.ts # Riot Games API integration
├── config/         # Configuration management
│   └── riotConfig.ts # Riot API configuration
├── utils/          # Utility functions
│   └── commandLoader.ts # Command loading utility
├── types/          # TypeScript type definitions
│   ├── command.ts  # Command interface
│   ├── match.ts    # Match data structure
│   ├── team.ts     # Team data structure
│   ├── tournament.ts # Tournament data structure
│   └── riot.ts     # Riot API type definitions
├── deploy-commands.ts # Slash command registration
└── index.ts        # Entry point
```

## Error Resolution

### 1. Common TypeScript Errors
   - Missing types: Install @types/package
   - Strict null checks: Use optional chaining (?.)
   - Type assertions: Avoid, use type guards instead

### 2. Discord.js Issues
   - Intent errors: Check GatewayIntentBits
   - Permission errors: Verify bot permissions
   - Rate limits: Implement proper delays

### 3. Build Issues
   - Clear dist: `rm -rf dist`
   - Rebuild: `pnpm run build`
   - Check tsconfig.json target

## Error Handling

### Discord Interactions
```typescript
try {
  await interaction.reply({ content: 'Success!' });
} catch (error) {
  console.error('Command failed:', error);
  
  const errorMessage = { 
    content: 'エラーが発生しました', 
    ephemeral: true 
  };
  
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(errorMessage);
  } else {
    await interaction.reply(errorMessage);
  }
}
```

### Async Operations
```typescript
// Always use try-catch for async operations
try {
  const result = await someAsyncOperation();
} catch (error) {
  // Log error with context
  console.error('Operation failed:', {
    operation: 'someAsyncOperation',
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  // Handle gracefully
}
```

## Environment Variables
- Always use dotenv
- Never commit .env files
- Required variables:
  - DISCORD_TOKEN
  - CLIENT_ID
  - GUILD_ID (for development)
  - RIOT_API_KEY (for player authentication)
- Validate on startup

## Deployment Checklist
- [ ] All TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Environment variables documented
- [ ] README updated
- [ ] Slash commands registered
- [ ] Error handling tested

## Best Practices

### 1. Command Design
- Keep commands simple and focused
- Use subcommands for complex operations
- Provide clear descriptions
- Validate all inputs

### 2. Performance
- Avoid blocking operations
- Use caching where appropriate
- Implement rate limiting
- Monitor memory usage

### 3. Security
- Never expose tokens
- Validate user permissions
- Sanitize user inputs
- Use ephemeral messages for sensitive data

## Development Workflow

1. Create feature branch
   ```bash
   git checkout -b feat/feature-name
   ```

2. Make changes following guidelines

3. Test thoroughly
   ```bash
   pnpm run dev
   # Test in Discord
   ```

4. Commit with proper message
   ```bash
   git add .
   git commit -m "feat: add feature"
   ```

5. Push and create PR
   ```bash
   git push origin feat/feature-name
   ```

## Quick Commands

```bash
# Development
pnpm run dev              # Start with hot reload
pnpm run build            # Build TypeScript
pnpm run start            # Run production build

# Code Quality
pnpm run lint             # Check code style
pnpm run lint:fix         # Fix code style
npx tsc --noEmit          # Type check only

# Discord Commands
pnpm run deploy           # Register slash commands
pnpm run deploy:global    # Register globally

# Maintenance
rm -rf dist node_modules  # Clean install
pnpm install              # Reinstall dependencies
```

## Current Implementation Status

### ✅ Implemented Features
- **Tournament Management**:
  - `/tournament create` - Create tournaments (4/8/16 teams)
  - `/tournament start-registration` - Open team registration
  - `/tournament start` - Generate brackets
  - `/tournament bracket` - Display bracket visualization
  - `/tournament list` - List tournaments with filtering
- **Team Management**:
  - `/team register` - Register teams to tournaments (requires player authentication)
  - `/team list` - Display participating teams with authentication status
- **Player Authentication**:
  - `/player register` - Register and verify Riot ID
  - `/player profile` - Display player profile
  - `/player verify` - Re-authenticate existing registration
  - `/player unlink` - Remove account linking
- **Match Management**:
  - `/match report` - Report match results with Valorant scoring validation
  - `/match list` - Display match status and results
- **Data Persistence**: JSON file storage for tournaments and players
- **Riot API Integration**: Player verification with automatic region detection
- **Autocomplete Support**: Tournament and match ID suggestions
- **Valorant Scoring**: Proper 13-round win validation with overtime support
- **Error Handling**: Comprehensive error handling with Japanese messages
- **Code Quality**: ESLint + TypeScript strict mode

### ✅ Production Ready Features
- **Complete Tournament Flow**: Create → Register → Start → Play → Results
- **Player Authentication**: Riot ID verification and linking
- **Data Persistence**: Survives server restarts
- **Tournament Terminology**: Proper Valorant competitive terms (Stage/Round/Home/Away)
- **UX Optimizations**: Autocomplete, clear error messages, status tracking

### ⚠️ Known Limitations
- **Riot API**: Development key only (24-hour expiration, rate limits)
- **Rank Information**: Requires Production API key
- **Team Members**: Captain-only system, no member management
- **Permissions**: No admin-only commands
- **Advanced Features**: No tournament brackets visualization, no statistics

### 🚧 Next Priority Features
1. **Production API Key**: Apply for Riot Production API access
2. **Rank Integration**: Display player ranks and statistics
3. **Team Member Management**: Add/remove team members
4. **Tournament Statistics**: Win rates, performance metrics
5. **Advanced Bracket Display**: Visual tournament brackets
6. **Administrative Commands**: Admin-only tournament management

## Notes for AI Assistants

When working on this codebase:
- Always use pnpm, never npm or yarn
- Follow TypeScript strict mode
- Implement proper error handling for Discord
- Keep functions small and focused
- Test all Discord interactions
- Use Japanese for user-facing error messages
- Never commit sensitive data
- **IMPORTANT**: Riot API key expires every 24 hours in development mode
- **TESTING**: All tournament and player features are fully functional
- **EXPANSION**: Focus on Production API key and rank integration for next phase