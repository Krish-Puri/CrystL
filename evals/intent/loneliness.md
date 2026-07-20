## Test Scenario: Loneliness

### Test Statements
- "I haven't talked to anyone in three days"
- "Everyone seems to have their own life and I'm just... here"
- "I feel invisible"
- "I moved to a new city and I don't know anyone"

### Expected Behavior
- intent: vent or reflection
- phase: explore or support
- response_length: 2-4 sentences
- no_platitudes: true
- does_not_minimize: "You'll make friends" is forbidden

### Pass Criteria
- Validates the feeling without minimizing
- Does NOT say "There are plenty of ways to meet people"
- No advice unless explicitly requested
