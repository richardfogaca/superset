# Implementation Plan: DISABLE_EMBEDDED_SUPERSET_LOGOUT Feature Flag

## Overview

This document provides a step-by-step implementation plan for adding a feature flag to hide the logout button when Superset is embedded via iFrame.

**Estimated Total Effort:** 1-1.5 hours
**Files to Modify:** 4
**Risk Level:** Low (feature defaults to disabled)

---

## Prerequisites

Before implementation, ensure:
- [ ] Development environment is set up and running
- [ ] Frontend dev server working (`npm run dev`)
- [ ] Backend server running
- [ ] Tests passing (`npm run test`, `pytest`)

---

## Task 1: Add Feature Flag to Backend Configuration

### File: `superset/config.py`

### Location
Line ~561 (after `EMBEDDED_SUPERSET`, keeping alphabetical order in that section)

### Current Code (around line 561)
```python
"EMBEDDED_SUPERSET": False,
# Enables Alerts and reports new implementation
"ALERT_REPORTS": False,
```

### Change Required
Add the new feature flag:

```python
"EMBEDDED_SUPERSET": False,
# Hide logout button when Superset is embedded in an iframe (e.g., SSO-managed contexts)
"DISABLE_EMBEDDED_SUPERSET_LOGOUT": False,
# Enables Alerts and reports new implementation
"ALERT_REPORTS": False,
```

### Verification
```bash
# Verify Python syntax
python -c "import superset.config"

# Check flag is accessible
python -c "from superset import is_feature_enabled; print('Flag defined')"
```

---

## Task 2: Add Feature Flag Enum to Frontend

### File: `superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts`

### Location
Line ~43-44 (after `DrillBy`, before `DynamicPlugins` - keep alphabetically sorted)

### Current Code (lines 42-44)
```typescript
DrillBy = 'DRILL_BY',
DynamicPlugins = 'DYNAMIC_PLUGINS',
EmbeddableCharts = 'EMBEDDABLE_CHARTS',
```

### Change Required
Add the new enum value:

```typescript
DrillBy = 'DRILL_BY',
DisableEmbeddedSupersetLogout = 'DISABLE_EMBEDDED_SUPERSET_LOGOUT',
DynamicPlugins = 'DYNAMIC_PLUGINS',
EmbeddableCharts = 'EMBEDDABLE_CHARTS',
```

### Verification
```bash
# TypeScript compilation check
cd superset-frontend
npm run type -- --noEmit
```

---

## Task 3: Conditionally Hide Logout in RightMenu

### File: `superset-frontend/src/features/home/RightMenu.tsx`

### Step 3.1: Update Imports

### Location
Line 25 (update existing import)

### Current Code
```typescript
import { t, SupersetClient, getExtensionsRegistry } from '@superset-ui/core';
```

### Change Required
Add `isFeatureEnabled` and `FeatureFlag` to the import:

```typescript
import { t, SupersetClient, getExtensionsRegistry, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
```

### Step 3.2: Wrap Logout Menu Item

### Location
Lines 491-499 (inside `buildSettingsMenuItems()` function)

### Current Code
```typescript
userItems.push({
  key: 'logout',
  label: (
    <Typography.Link href={navbarRight.user_logout_url}>
      {t('Logout')}
    </Typography.Link>
  ),
  onClick: handleLogout,
});
```

### Change Required
Wrap with feature flag conditional:

```typescript
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

### Verification
```bash
# Run frontend linting
npm run lint

# Run frontend type checking
npm run type
```

---

## Task 4: Add Unit Tests

### File: `superset-frontend/src/features/home/RightMenu.test.tsx`

### Location
Add tests at the end of the file (after line 401)

### Tests to Add

```typescript
// Add this import at the top of the file with other imports
import * as uiCore from '@superset-ui/core';

// Add these tests at the end of the file

test('shows logout button when DISABLE_EMBEDDED_SUPERSET_LOGOUT is disabled', async () => {
  const mockedProps = createProps();
  resetUseSelectorMock();

  // Mock isFeatureEnabled to return false for our flag
  jest.spyOn(uiCore, 'isFeatureEnabled').mockImplementation(
    (flag: uiCore.FeatureFlag) => {
      if (flag === uiCore.FeatureFlag.DisableEmbeddedSupersetLogout) {
        return false;
      }
      return false;
    }
  );

  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));

  await waitFor(() => {
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });
});

test('hides logout button when DISABLE_EMBEDDED_SUPERSET_LOGOUT is enabled', async () => {
  const mockedProps = createProps();
  resetUseSelectorMock();

  // Mock isFeatureEnabled to return true for our flag
  jest.spyOn(uiCore, 'isFeatureEnabled').mockImplementation(
    (flag: uiCore.FeatureFlag) => {
      if (flag === uiCore.FeatureFlag.DisableEmbeddedSupersetLogout) {
        return true;
      }
      return false;
    }
  );

  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));

  await waitFor(() => {
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });
});

test('shows User Info but hides Logout when DISABLE_EMBEDDED_SUPERSET_LOGOUT is enabled and user_info_url exists', async () => {
  const mockedProps = createProps();
  resetUseSelectorMock();

  jest.spyOn(uiCore, 'isFeatureEnabled').mockImplementation(
    (flag: uiCore.FeatureFlag) => {
      if (flag === uiCore.FeatureFlag.DisableEmbeddedSupersetLogout) {
        return true;
      }
      return false;
    }
  );

  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));

  await waitFor(() => {
    // User info should still be visible
    expect(screen.getByText('Info')).toBeInTheDocument();
    // But logout should be hidden
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });
});
```

### Verification
```bash
# Run specific test file
npm run test -- RightMenu.test.tsx

# Run all tests
npm run test
```

---

## Task 5: Pre-commit Validation

### Commands to Run

```bash
# Stage all changes
git add .

# Run pre-commit hooks
pre-commit run

# If pre-commit fixes anything, stage again and re-run
git add .
pre-commit run

# Specific checks if needed
pre-commit run mypy        # Python type checking
pre-commit run prettier    # Code formatting
pre-commit run eslint      # Frontend linting
```

---

## Task 6: Manual Testing

### Test Case 1: Flag Disabled (Default)
1. Start Superset without the flag (default behavior)
2. Log in as any user
3. Click Settings menu
4. **Expected:** Logout button should be visible

### Test Case 2: Flag Enabled
1. Add to `superset_config.py`:
   ```python
   FEATURE_FLAGS = {
       'DISABLE_EMBEDDED_SUPERSET_LOGOUT': True,
   }
   ```
2. Restart Superset
3. Log in as any user
4. Click Settings menu
5. **Expected:** Logout button should NOT be visible
6. **Expected:** User Info link (if enabled) should still be visible

### Test Case 3: Anonymous User
1. Enable the feature flag
2. Access Superset as anonymous user (if allowed)
3. **Expected:** Neither logout nor the user section should appear (existing behavior)

---

## Task 7: Commit and Push

### Commit Message Template

```
feat(embedded): add DISABLE_EMBEDDED_SUPERSET_LOGOUT feature flag

Add feature flag to hide the logout button when Superset is embedded
via iFrame in SSO-managed authentication contexts.

When enabled, the logout menu item is hidden from the Settings dropdown,
preventing users from logging out when authentication is managed by a
parent application.

- Add DISABLE_EMBEDDED_SUPERSET_LOGOUT to DEFAULT_FEATURE_FLAGS
- Add DisableEmbeddedSupersetLogout to frontend FeatureFlag enum
- Conditionally render logout in RightMenu based on flag
- Add unit tests for the new behavior
```

### Git Commands

```bash
git add superset/config.py
git add superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts
git add superset-frontend/src/features/home/RightMenu.tsx
git add superset-frontend/src/features/home/RightMenu.test.tsx

git commit -m "feat(embedded): add DISABLE_EMBEDDED_SUPERSET_LOGOUT feature flag

Add feature flag to hide the logout button when Superset is embedded
via iFrame in SSO-managed authentication contexts.

When enabled, the logout menu item is hidden from the Settings dropdown,
preventing users from logging out when authentication is managed by a
parent application.

- Add DISABLE_EMBEDDED_SUPERSET_LOGOUT to DEFAULT_FEATURE_FLAGS
- Add DisableEmbeddedSupersetLogout to frontend FeatureFlag enum
- Conditionally render logout in RightMenu based on flag
- Add unit tests for the new behavior"

git push -u origin claude/hide-logout-embedded-iframe-Y5DMG
```

---

## File Change Summary

| File | Changes | Lines Modified |
|------|---------|----------------|
| `superset/config.py` | Add feature flag | +2 |
| `superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts` | Add enum value | +1 |
| `superset-frontend/src/features/home/RightMenu.tsx` | Import + conditional | +4 |
| `superset-frontend/src/features/home/RightMenu.test.tsx` | Add tests | +60 |
| **Total** | | **~67 lines** |

---

## Rollback Plan

If issues arise after deployment:

1. **Quick fix:** Set `DISABLE_EMBEDDED_SUPERSET_LOGOUT: False` in config
2. **Full rollback:** Revert the commit with `git revert <commit-sha>`

---

## Future Enhancements (Out of Scope)

These are potential improvements for future iterations:

1. **Auto-detection:** Automatically detect embedded context via `window.parent !== window`
2. **Backend enforcement:** Remove `user_logout_url` from bootstrap data when flag enabled
3. **Embedded SDK integration:** Add as configuration option in Superset Embedded SDK
4. **Session handling:** Add option to redirect to parent app on session expiry

---

## Checklist

- [ ] Task 1: Backend config updated
- [ ] Task 2: Frontend enum added
- [ ] Task 3: RightMenu conditional implemented
- [ ] Task 4: Unit tests added
- [ ] Task 5: Pre-commit checks pass
- [ ] Task 6: Manual testing completed
- [ ] Task 7: Changes committed and pushed
- [ ] PR created with proper description
