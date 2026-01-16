# Version Update Log

## Version 1.6.5 (2026-01-14)

### Module Changes

1. **Updated Module Name**
   - Changed module name to "Bob:TinyCountDown"
   - Updated display name in package.json

2. **Version Update**
   - Updated version number to 1.6.5
   - Ensured consistency across all files

3. **Documentation Improvements**
   - Added comprehensive TCP command documentation
   - Included detailed error handling information
   - Added author information (Bob)

4. **Bug Fixes**
   - Fixed countdown synchronization issues
   - Improved time reset functionality

## Version 1.6.4 (2026-01-14)

- Bug fixes and performance improvements

## Version 1.6.3 (2026-01-14)

- Bug fixes and performance improvements

## Version 1.6.2 (2026-01-14)

### Protocol Changes

1. **Added Protocol Version Control**
   - Added `version` field to all JSON messages
   - Implemented version negotiation mechanism
   - Added version compatibility checking

2. **Enhanced JSON Command Support**
   - Added support for JSON format commands
   - Implemented parsing of JSON commands in TinyCountdown
   - Added JSON response format with version field

3. **Standardized Error Handling**
   - Added standard error codes
   - Implemented consistent error response format
   - Added error handling for invalid JSON

4. **Improved Command Handling**
   - Added support for new JSON commands: START, STOP, RESET, SET_TIME, PAUSE, RESUME, GET_STATUS, PING
   - Maintained backward compatibility with plain text commands
   - Added better command validation

### Technical Improvements

1. **Connection Management**
   - Enhanced heartbeat mechanism
   - Improved reconnection strategy
   - Added connection timeout handling

2. **Performance Optimization**
   - Added message size limits
   - Implemented flow control
   - Optimized command processing

3. **Security Enhancements**
   - Added basic security recommendations
   - Improved error handling for invalid inputs

### Documentation

1. **Created Comprehensive Protocol Documentation**
   - Added PROTOCOL.md with complete protocol specification
   - Documented all command formats and responses
   - Added version history and compatibility notes

2. **Updated Implementation Guidelines**
   - Added client implementation guidelines
   - Added server implementation guidelines
   - Added testing guidelines

### Compatibility

- **Backward Compatible**: Supports plain text commands from older clients
- **Forward Compatible**: Ignores unknown fields in JSON messages
- **Version Aware**: Includes version field in all JSON messages

### Migration Guide

1. **For Existing Clients**
   - Continue using plain text commands (supported)
   - Or upgrade to JSON format with version field

2. **For New Clients**
   - Use JSON format with version field "1.6.2"
   - Implement heartbeat mechanism
   - Handle both JSON and plain text responses

### Testing

- **Test Tools**: Included PowerShell scripts for testing
- **Test Cases**: Covered connection, commands, errors, and performance
- **Compatibility Testing**: Verified with older client versions

## Version 1.6.1 (2026-01-13)

- Fixed TCP connection issues
- Improved error handling
- Added heartbeat mechanism

## Version 1.6.0 (2026-01-12)

- Initial TCP protocol implementation
- Replaced simple request-response with TCP
- Added JSON command format
