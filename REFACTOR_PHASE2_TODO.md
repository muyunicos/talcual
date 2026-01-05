# Phase 2: Backend Refactoring - PHP / Server

## Overview
**Phase 1 (JavaScript - COMPLETED)** successfully refactored the frontend to use a unified `calculateGlobalMatches()` method from `WordEngine.js`.

Now the **server/PHP backend** must be updated to support the new minimal payload approach for `end_round` action.

---

## Changes Required in `app/actions.php`

### Current Behavior (Phase 1)
`HostController::endRound()` was sending:
```javascript
await this.client.sendAction('end_round', {
    round_results: roundResults,     // ← REMOVED
    score_deltas: scoreDeltas,       // ← REMOVED
    top_words: topWords              // ← REMOVED
});
```

### New Behavior (Phase 2 - Required)
`HostController::endRound()` now sends:
```javascript
await this.client.sendAction('end_round', {
    // Minimal payload - only the signal to end round
    // Server handles response generation
});
```

---

## Backend Handler for `end_round` Action

### Location: `app/actions.php` - `case 'end_round':`

#### Current Implementation (Before Phase 2)
```php
case 'end_round':
    $round_results = $_POST['round_results'] ?? null;      // Expects this from Host
    $score_deltas = $_POST['score_deltas'] ?? null;        // Expects this from Host
    $top_words = $_POST['top_words'] ?? null;              // Expects this from Host
    
    // Server uses Host-provided results
    updateGameStateWithResults($round_results, $score_deltas);
    // ...
    break;
```

#### Required New Implementation (Phase 2)
```php
case 'end_round':
    // No longer expect round_results from Host
    // Server independently validates and closes answer submission
    
    $gameCode = sanitizeInput($_POST['gameCode']);
    $playerId = sanitizeInput($_POST['playerId']);
    
    // Validate: Only Host can end round
    if (!isHost($playerId)) {
        sendResponse(false, 'Only host can end round');
        return;
    }
    
    // 1. Lock round: No more answers accepted
    lockRoundAnswers($gameCode);
    
    // 2. Transition state to 'round_ended'
    updateGameStatus($gameCode, 'round_ended');
    
    // 3. Return state with all player answers (no pre-calculated results)
    $state = getGameState($gameCode);
    
    sendResponse(true, 'Round ended', ['state' => $state]);
    break;
```

---

## Key Points

### ✅ What the Server Must Do
1. **Accept minimal payload** - No `round_results`, `score_deltas`, `top_words` expected
2. **Validate round is open** - Ensure round can be ended
3. **Lock answer submission** - Prevent new answers after this point
4. **Change status to `round_ended`** - Broadcast to all clients
5. **Include all player answers in returned state** - Players need `players[id].answers` to calculate matches locally

### ⚠️ Authority & Security
**Two options:**

#### Option A (Recommended): Server Still Calculates Scores
- Server calculates point deltas as before (maintains score authority)
- Server updates `players[id].score` in state
- Client uses this for display but also calculates locally for visual richness (match types, etc.)
- **Benefit:** Server maintains single source of truth for scores

```php
// After locking answers and changing status:
$scoreDeltas = calculateScoresServer($gameCode); // Server authority
updatePlayerScores($gameCode, $scoreDeltas);
$state = getGameState($gameCode); // State now has updated scores
```

#### Option B: Full Client-Side (Advanced)
- Server sends minimal state (answers only, no score updates)
- Host calculates scores using `calculateGlobalMatches()`
- Host sends `update_scores` action immediately after `end_round`
- **Benefit:** No server-side scoring logic needed
- **Risk:** If Host disconnects, scores are not saved

---

## Verification Checklist

- [ ] `end_round` handler no longer expects `$_POST['round_results']`
- [ ] `end_round` handler no longer expects `$_POST['score_deltas']`
- [ ] `end_round` handler locks answer submission for the round
- [ ] State returned by `end_round` includes all `players[id].answers`
- [ ] State includes `roundData` with `validMatches` (for player calculation)
- [ ] Scores are updated correctly (Option A: server-side, Option B: client-side)
- [ ] Host receives full state and can proceed to results display
- [ ] Player receives full state and can calculate matches locally

---

## Testing

1. **Host ends round with no payloads** - Server should accept and transition state
2. **Verify answers are locked** - No new answers accepted after `end_round`
3. **Verify state returned** - All player answers present, `roundData` available
4. **Verify score calculation** - Scores updated correctly (verify with formula)
5. **Verify UI displays correctly** - Both Host and Player should show results

---

## Notes
- This phase maintains backward compatibility if `$_POST['round_results']` is simply ignored
- No database schema changes required
- Frontend changes in Phase 1 are already deployed and compatible with this change
