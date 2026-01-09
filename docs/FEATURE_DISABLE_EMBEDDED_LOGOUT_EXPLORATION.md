# Feature Exploration: Hide Logout Button in Embedded Contexts

## Executive Summary

This document explores the implementation of a feature flag (`DISABLE_EMBEDDED_SUPERSET_LOGOUT`) to hide the logout button when Superset is embedded via iFrame. This is a **small, focused feature** that follows existing Superset patterns and requires changes in 4-5 files.

---

## How Superset Feature Flags Work

### Backend (Python)

**Location:** `superset/config.py`

Feature flags are defined in `DEFAULT_FEATURE_FLAGS` dictionary (lines 527-659). The pattern is:

```python
DEFAULT_FEATURE_FLAGS: dict[str, bool] = {
    "EMBEDDED_SUPERSET": False,
    "MENU_HIDE_USER_INFO": False,  # Similar feature - hides user info
    # ... other flags
}
```

Feature flags can also be set via environment variables with `SUPERSET_FEATURE_` prefix (lines 684-689):
```python
# Environment variable SUPERSET_FEATURE_MY_FLAG=true becomes MY_FLAG: True
```

**Feature Flag Manager:** `superset/utils/feature_flag_manager.py`
- Merges `DEFAULT_FEATURE_FLAGS` with user's `FEATURE_FLAGS` from `superset_config.py`
- Provides `is_feature_enabled()` function for backend checks

### Frontend (TypeScript)

**Location:** `superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts`

1. **FeatureFlag Enum** (lines 23-70): Defines all available feature flags
   ```typescript
   export enum FeatureFlag {
     EmbeddedSuperset = 'EMBEDDED_SUPERSET',
     // ... other flags (KEEP SORTED ALPHABETICALLY)
   }
   ```

2. **initFeatureFlags()** (line 96): Initializes `window.featureFlags` from bootstrap data

3. **isFeatureEnabled()** (line 102): Checks if a flag is enabled
   ```typescript
   export function isFeatureEnabled(feature: FeatureFlag): boolean {
     return !!window.featureFlags[feature];
   }
   ```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. config.py: DEFAULT_FEATURE_FLAGS                            │
│  2. superset_config.py: User's FEATURE_FLAGS (overrides)        │
│  3. views/base.py: get_feature_flags() → bootstrap_data         │
│                                                                  │
│  Line 512: "feature_flags": get_feature_flags()                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Bootstrap Data (JSON)                         │
├─────────────────────────────────────────────────────────────────┤
│  {                                                               │
│    "common": {                                                   │
│      "feature_flags": {                                         │
│        "EMBEDDED_SUPERSET": false,                              │
│        "DISABLE_EMBEDDED_SUPERSET_LOGOUT": false  // NEW        │
│      }                                                          │
│    }                                                            │
│  }                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  1. preamble.ts (line 87):                                      │
│     initFeatureFlags(bootstrapData.common.feature_flags)        │
│                                                                  │
│  2. Components use:                                              │
│     isFeatureEnabled(FeatureFlag.DisableEmbeddedSupersetLogout) │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Logout Implementation

### Location: `superset-frontend/src/features/home/RightMenu.tsx`

The logout button is rendered in the `buildSettingsMenuItems()` function (lines 477-506):

```typescript
if (!navbarRight.user_is_anonymous) {
  items.push({ type: 'divider', key: 'user-divider' });

  const userItems: MenuItem[] = [];
  if (navbarRight.user_info_url) {
    userItems.push({
      key: 'info',
      label: (
        <Typography.Link href={navbarRight.user_info_url}>
          {t('Info')}
        </Typography.Link>
      ),
    });
  }
  // LOGOUT BUTTON - Lines 491-499
  userItems.push({
    key: 'logout',
    label: (
      <Typography.Link href={navbarRight.user_logout_url}>
        {t('Logout')}
      </Typography.Link>
    ),
    onClick: handleLogout,
  });

  items.push({
    type: 'group',
    label: t('User'),
    key: 'user-section',
    children: userItems,
  });
}
```

### Key Observations

1. The logout is unconditionally added when user is not anonymous
2. Similar feature flag `MENU_HIDE_USER_INFO` hides user info URL on the **backend** (`views/base.py:307`)
3. The logout URL comes from `navbarRight.user_logout_url` (set in `views/base.py:309`)

---

## Implementation Tasks

### Task 1: Add Feature Flag to Backend Config

**File:** `superset/config.py`

**Changes:**
- Add `"DISABLE_EMBEDDED_SUPERSET_LOGOUT": False` to `DEFAULT_FEATURE_FLAGS` dictionary
- Place it alphabetically near other embedded-related flags

**Location in file:** Around line 561 (near `EMBEDDED_SUPERSET`)

```python
DEFAULT_FEATURE_FLAGS: dict[str, bool] = {
    # ... existing flags ...
    "DISABLE_EMBEDDED_SUPERSET_LOGOUT": False,  # NEW - Hide logout in embedded iframes
    "EMBEDDED_SUPERSET": False,
    # ... existing flags ...
}
```

**Effort:** Minimal (~2 lines)

---

### Task 2: Add Feature Flag Enum to Frontend

**File:** `superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts`

**Changes:**
- Add new enum value to `FeatureFlag` enum (keep alphabetically sorted)

**Location in file:** Around line 44 (after `DrillBy`, before `DynamicPlugins`)

```typescript
export enum FeatureFlag {
  // ... existing flags ...
  DisableEmbeddedSupersetLogout = 'DISABLE_EMBEDDED_SUPERSET_LOGOUT',  // NEW
  DynamicPlugins = 'DYNAMIC_PLUGINS',
  // ... existing flags ...
}
```

**Effort:** Minimal (~1 line)

---

### Task 3: Conditionally Hide Logout in RightMenu

**File:** `superset-frontend/src/features/home/RightMenu.tsx`

**Changes:**
1. Import `isFeatureEnabled` and `FeatureFlag` from `@superset-ui/core`
2. Wrap logout menu item in conditional based on feature flag

**Implementation approach:**

```typescript
// Add to imports (if not already present)
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';

// In buildSettingsMenuItems(), modify the logout section (around line 491):
if (!isFeatureEnabled(FeatureFlag.DisableEmbeddedSupersetLogout)) {
  userItems.push({
    key: 'logout',
    label: (
      <Typography.Link href={navbarRight.user_logout_url}>
        {t('Logout')}
      </Typography.Link>
    ),
    onClick: handleLogout,
  });
}
```

**Effort:** Small (~5-10 lines)

---

### Task 4: Add Unit Tests

**File:** `superset-frontend/src/features/home/RightMenu.test.tsx`

**Changes:**
- Add test case: "When DISABLE_EMBEDDED_SUPERSET_LOGOUT is enabled, logout button is hidden"
- Add test case: "When DISABLE_EMBEDDED_SUPERSET_LOGOUT is disabled, logout button is visible"

**Test pattern (from existing tests):**

```typescript
// Mock feature flags
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn((flag) => {
    if (flag === 'DISABLE_EMBEDDED_SUPERSET_LOGOUT') return true;
    return false;
  }),
}));

test('hides logout when DISABLE_EMBEDDED_SUPERSET_LOGOUT is enabled', async () => {
  // ... render component
  // ... navigate to Settings menu
  expect(screen.queryByText('Logout')).not.toBeInTheDocument();
});
```

**Effort:** Moderate (~30-50 lines)

---

### Task 5: Update Documentation (Optional)

**Potential files:**
- `docs/configuration/configuring-superset.mdx` - Document the new feature flag
- `UPDATING.md` - If this is considered a notable change

**Effort:** Small

---

## Alternative Implementation Approaches

### Approach A: Frontend-Only (Recommended)
- Check feature flag in `RightMenu.tsx` using `isFeatureEnabled()`
- Pros: Simple, follows existing patterns
- Cons: Logout URL still exposed in bootstrap data (minor security consideration)

### Approach B: Backend + Frontend
- Also remove `user_logout_url` from `navbarRight` when flag is enabled
- Similar to how `MENU_HIDE_USER_INFO` works in `views/base.py:307`
- Pros: More secure, logout URL not exposed
- Cons: More complex, requires backend changes

### Approach C: Auto-Detection
- Automatically detect embedded context (via `window.parent !== window`)
- Hide logout without requiring explicit configuration
- Pros: Zero configuration needed
- Cons: May have unintended effects, less explicit control

**Recommendation:** Start with Approach A (frontend-only) as it's simplest and matches the requirement. Approach B can be added later if security is a concern.

---

## Related Code References

| Purpose | File | Line(s) |
|---------|------|---------|
| Feature flag definitions | `superset/config.py` | 527-659 |
| Feature flag manager | `superset/utils/feature_flag_manager.py` | 22-58 |
| Frontend FeatureFlag enum | `superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts` | 23-70 |
| isFeatureEnabled function | `superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts` | 102-109 |
| Bootstrap data with feature_flags | `superset/views/base.py` | 512 |
| RightMenu component | `superset-frontend/src/features/home/RightMenu.tsx` | 93-795 |
| Logout menu item | `superset-frontend/src/features/home/RightMenu.tsx` | 491-499 |
| Similar feature: MENU_HIDE_USER_INFO | `superset/config.py` | 612 |
| MENU_HIDE_USER_INFO usage | `superset/views/base.py` | 307 |

---

## Estimated Effort

| Task | Effort | Files Changed |
|------|--------|---------------|
| Task 1: Backend config | ~5 min | 1 |
| Task 2: Frontend enum | ~5 min | 1 |
| Task 3: RightMenu conditional | ~15 min | 1 |
| Task 4: Unit tests | ~30 min | 1 |
| Task 5: Documentation | ~15 min | 1-2 |
| **Total** | **~1-1.5 hours** | **4-5 files** |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing logout | Low | High | Feature flag defaults to `false` |
| TypeScript compilation errors | Low | Low | Simple string enum addition |
| Test failures | Low | Low | New tests, no changes to existing |
| Missing edge cases | Low | Medium | Test with anonymous users |

---

## Conclusion

This is a **small, low-risk feature** that follows established Superset patterns. The implementation:

1. Uses existing feature flag infrastructure
2. Requires minimal code changes (~20 lines of production code)
3. Has clear testing strategy
4. Defaults to disabled (no breaking changes)

The feature can be implemented in a single PR and should not require extensive review beyond standard code review practices.
