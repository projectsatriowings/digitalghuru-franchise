# Digital Guru Franchise — Mobile Liquid Glass Design System

**Document:** `docs/mobile-design-system.md`  
**Branch:** `padhma-priya`  
**Date:** November 24, 2026  
**Status:** Implemented & Verified  

---

## 1. Design System Philosophy

The Digital Guru Mobile Design System is engineered around a modern, fluid **Liquid Glass** aesthetic specifically tailored for education enterprise clients. The visual design establishes distinct identities for the three mobile personas while preserving a coherent brand signature:

* **Student Experience (ChalkChamp + Studyhall):**
  - **Identity Accent:** Modern Action Blue (`#006FFF`) & Gold (`#FEDC32`)
  - **Tone:** Encouraging, vibrant, academic clarity, distraction-free study focus.
* **Parent Experience (ChalkChamp + Verve):**
  - **Identity Accent:** Deep Primary Navy (`#0F172A`) & Muted Slate (`#64748B`)
  - **Tone:** Executive, transparent, reassuring, financial and academic visibility.
* **Teacher Experience (ChalkChamp + Quillsprig):**
  - **Identity Accent:** Vibrant Teacher Orange (`#FE4D01`) & Deep Enterprise Navy (`#0A2540`)
  - **Tone:** Fast, utilitarian, action-oriented for high-efficiency roll calls and grading.

---

## 2. Token Architecture

### 2.1 Core Palette (`apps/mobile/src/theme/colors.ts`)
```typescript
export const brandColors = {
  navy: '#0F172A',         // Primary Ink / Deep Background
  deepNavy: '#0A2540',     // Enterprise Container
  blue: '#006FFF',         // Primary Action Blue (Student)
  gold: '#FEDC32',         // Highlight Yellow / Gold Accent
  orange: '#FE4D01',       // Teacher / Immediate Action Accent

  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textWhite: '#FFFFFF',

  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#006FFF',
};
```

### 2.2 Corner Radii & Elevation
- **Radii:** `sm: 6`, `md: 10`, `lg: 14`, `xl: 18`, `full: 9999`
- **Shadows:** Standardized soft multi-stop shadows (`sm`, `md`, `lg`) tuned for high-DPI Android and iOS screens with low elevation jitter.

---

## 3. Reusable Component Inventory (`apps/mobile/src/components/design-system/`)

All 17 reusable components are built with TypeScript, high-performance native-driver animations (`useNativeDriver: true`), and hardware-accelerated blur effects with translucent fallbacks.

| Component | File Path | Core Role & Behavior |
| :--- | :--- | :--- |
| **`AnimatedPressable`** | `AnimatedPressable.tsx` | Spring-scaling touch wrapper with smooth tactile feedback. |
| **`GlassSurface`** | `GlassSurface.tsx` | Base container supporting `expo-blur` with fallback translucent fill. |
| **`GlassCard`** | `GlassCard.tsx` | High-level card with glass finish, custom padding, and accent tinting. |
| **`GlassButton`** | `GlassButton.tsx` | Persona-aware buttons with loading spinner, icon slots, and spring press. |
| **`GlassBottomSheet`** | `GlassBottomSheet.tsx` | Modal sheet with blur backdrop, drag handle, and spring presentation. |
| **`RoleBadge`** | `RoleBadge.tsx` | Persona tag (Student, Parent, Teacher, Admin) with role-coded badges. |
| **`DashboardStatCard`** | `DashboardStatCard.tsx` | Metric card with circular icon wrapper, bold stat, and trend subtext. |
| **`SectionHeader`** | `SectionHeader.tsx` | Standard section heading with icon, subtitle, and action link. |
| **`EmptyState`** | `EmptyState.tsx` | Friendly illustrated empty-state container with optional call-to-action. |
| **`LoadingState`** | `LoadingState.tsx` | Branded spinner and loading feedback. |
| **`ErrorState`** | `ErrorState.tsx` | Glass error alert card with retry action. |
| **`FormField`** | `FormField.tsx` | Glass input field with focus borders, error states, and icon slots. |
| **`NotificationBadge`** | `NotificationBadge.tsx` | Bouncing counter badge for unread alerts. |
| **`AnimatedStatusCapsule`** | `AnimatedStatusCapsule.tsx` | Floating Dynamic Island capsule for live statuses (Syncing, Voice). |
| **`ConfirmDialog`** | `ConfirmDialog.tsx` | Modal confirmation dialog with glass finish. |
| **`DateTimeSelector`** | `DateTimeSelector.tsx` | Horizontal date selector pill sheet with day/month indicators. |
| **`AnimatedTabBar`** | `AnimatedTabBar.tsx` | Floating pill bottom navigation bar with active indicators and safe-area padding. |

---

## 4. Floating Animated Bottom Navigation (`AnimatedTabBar.tsx`)

The navigation bar floats 12px above the screen bottom (respecting `useSafeAreaInsets().bottom`), styled with:
- `backgroundColor: 'rgba(255, 255, 255, 0.94)'`
- `borderRadius: 9999` (full pill)
- Active indicator pill with subtle role tint (`${activeColor}18`)
- Dynamic scaling icon springs (`scale: 1.08`) on focus
- Role-specific active color mapping:
  - Student: `#006FFF`
  - Parent: `#0F172A`
  - Teacher / Staff: `#FE4D01`

---

## 5. Performance & Accessibility Compliance
1. **`useNativeDriver: true`:** All transform animations run directly on the UI thread without blocking the JS bridge.
2. **HitSlop Extensions:** All icon buttons and tab items incorporate standard 8px touch target expansion.
3. **Hardware Acceleration:** Native blur runs via `expo-blur` on supported devices, falling back gracefully to optimized RGBA translucency on older hardware.
