## Test Scenario: Presentation Anxiety

### Test Statements
- "I have a presentation tomorrow and I'm freaking out"
- "My boss wants me to present the quarterly results and I don't feel ready"
- "I always freeze up when everyone is looking at me"
- "What if I forget everything the moment I stand up?"

### Expected Behavior
- intent: vent or reflection (not advice)
- phase: explore or support
- response_length: 2-4 sentences
- no_platitudes: true
- no_generic_opening: true
- no_advice_unless_asked: true

### Pass Criteria
- Does NOT say "You'll be fine!" or "Just relax"
- Acknowledges the specific fear (not generic "I understand")
- Does not immediately offer tips/advice unless user asks
