# UI primitives

Small, dependency-free, accessible building blocks used throughout TaskFlow.
Each one follows the relevant [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) pattern,
shows a visible focus ring only for keyboard users (`:focus-visible`), and supports light and dark mode.

Browse them interactively with Storybook:

```bash
npm run storybook          # from the repo root → http://localhost:6006
```

Import from the barrel:

```tsx
import { Button, Dialog, DropdownMenu, useToast } from '../components/ui';
```

| Component                  | Pattern / semantics                                                                      | Keyboard                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                   | native `<button>`, `type="button"` by default                                            | Enter / Space                                                                                                                   |
| `IconButton`               | `label` prop is **required** → `aria-label`, tooltip                                     | Enter / Space                                                                                                                   |
| `Input`, `Textarea`        | `<label for>`, hint + error via `aria-describedby`, `aria-invalid`                       | native                                                                                                                          |
| `Select`                   | styled **native** `<select>` (free a11y + mobile pickers)                                | native                                                                                                                          |
| `Dialog`                   | `role="dialog"`, `aria-modal`, labelled + described                                      | focus moves in, Tab/Shift+Tab trapped, Escape closes, focus returns to opener                                                   |
| `DropdownMenu`             | menu button: `aria-haspopup`, `aria-expanded`, `role="menu"`, `menuitem`/`menuitemradio` | ↓/Enter/Space open → first item, ↑ → last item, roving tabindex, ↑↓ wrap, Home/End, typeahead, Escape returns focus, Tab closes |
| `Tooltip`                  | `role="tooltip"` referenced by `aria-describedby`                                        | shows on keyboard focus (immediately) and hover (delayed); Escape hides                                                         |
| `Badge`                    | text + optional dot — colour is never the only signal                                    | —                                                                                                                               |
| `Avatar`, `AvatarGroup`    | `role="img"` with the person's name, or `decorative`                                     | —                                                                                                                               |
| `ToastProvider`/`useToast` | persistent `aria-live` regions (polite; assertive for errors)                            | toasts pause while hovered/focused; optional action (e.g. **Undo**)                                                             |

## Examples

### Dialog

```tsx
const [open, setOpen] = useState(false);

<Button onClick={() => setOpen(true)}>Rename</Button>
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Rename board"
  description="Collaborators will see the new name immediately."
  footer={<Button variant="primary" onClick={save}>Save</Button>}
>
  <Input label="Board name" defaultValue={title} />
</Dialog>;
```

While open, the dialog marks the app root (`#root`) as `inert` and locks page scroll. Floating UI
(menus, tooltips, toasts) is portalled to `<body>`, so it stays interactive above the modal.

### DropdownMenu

The trigger is a render prop so any button can be used; spread the props you're given onto it.

```tsx
<DropdownMenu
  label="Column actions"
  align="end"
  trigger={(props) => (
    <IconButton {...props} label="Column actions">
      <Ellipsis />
    </IconButton>
  )}
  items={[
    { id: 'rename', label: 'Rename', icon: <Pencil />, onSelect: rename },
    { type: 'separator', id: 'sep' },
    { id: 'delete', label: 'Delete', icon: <Trash2 />, danger: true, onSelect: remove },
  ]}
/>
```

Items with `checked: boolean` render as `menuitemradio` (used by the board switcher).

### Toast

```tsx
const { toast } = useToast();
toast({ title: 'Card deleted', action: { label: 'Undo', onClick: undo } });
toast({ title: 'Sync failed', description: 'Retrying…', variant: 'error' }); // assertive
```

### Form controls

```tsx
<Input label="Email" hint="We never share it" error={error} />
<Select label="Priority" hideLabel options={[{ value: 'high', label: 'High' }]} />
```

`hideLabel` keeps the label for screen readers while hiding it visually.

## Positioning

`usePopoverPosition` places menus and tooltips with `position: fixed` relative to their anchor,
flipping above/below to stay on screen and following scroll/resize. Styles are written directly to
the DOM in a layout effect, so scrolling doesn't cause React re-renders.

## Tests

Behaviour is covered in [`__tests__/`](./__tests__): focus trap / Escape / focus return / inert for
`Dialog`, full keyboard model for `DropdownMenu`, and live-region semantics for `Toast`.
