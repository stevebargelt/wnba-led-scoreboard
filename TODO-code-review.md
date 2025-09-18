1. Favorite Team Priority Rules
- [ ] Wire up the advertised priority rules (`src/sports/aggregator.py:33` exposes `playoff_boost` and `conflict_resolution`, but `get_featured_game`/`_calculate_game_priorities` never read them, so `MANUAL`/`LIVE_FIRST` modes and playoff boosts from config are silently ignored). the aggregator still doesn't use the playoff_boost and conflict_resolution settings exposed at line 33. Consider either:
Implementing these features in _calculate_game_priorities()
Removing the unused configuration options to avoid confusion

2. Test coverage gaps:
- [ ]  The test file test_multi_sport_config.py only covers basic config loading scenarios
- [ ] Missing tests for the new null-safety logic in the aggregator
- [ ] No tests for edge cases with missing team identifiers
Consider adding tests for the authentication flow changes

3. Type safety could be improved
- [ ] The _normalize() function in aggregator could benefit from proper type hints
- [ ] Consider using Optional[str] consistently throughout the codebase

4. Silent configuration failures
- [ ] The aggregator will now silently skip None identifiers. Consider logging a warning when a favorite team has incomplete data to help users debug configuration issues.

5. Edge function authentication context
- [ ] While the web admin now sends the user token, verify that the edge function (on-action/index.ts) doesn't need modifications to properly validate authenticated requests vs anonymous ones.

6. Suggestions
- [ ] Add configuration validation: Consider adding a validation step that warns users about teams missing abbreviations or IDs


